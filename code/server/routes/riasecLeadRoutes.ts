import type { Express } from "express";
import crypto from "node:crypto";
import { httpSelectSafe, neonSql } from "../db";
import { CV_LEAD_QUOTA_SCHEMA, publicCvClientKey } from "../lib/cvLeadAdmission";
import {
  configuredLimit,
  createLeadRefusals,
  PUBLIC_LEAD_QUOTA_FUNCTION,
  PUBLIC_LEAD_REFUSAL_SCHEMA,
  reserveQuotas,
  type Quota,
} from "../lib/publicLeadLimits";
import { isCompleteRiasec, RIASEC_QUESTIONS, scoreRiasec } from "../../shared/riasec";
import { interpretRiasec, publicRiasecPreview } from "../services/riasecLeadInterpretation";
import { getUserId, isAuthenticated } from "../auth/session";

/**
 * Lead magnet « test RIASEC ». Les 48 réponses arrivent d'un coup en fin de test ;
 * scores et code Holland se calculent ici, l'IA ne rédige que l'interprétation.
 * Résultat public en entier pour l'instant (pas de floutage ni de connexion).
 */

const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const query = (sql: string, params: any[]) => neonSql.query(sql, params);
const reject = createLeadRefusals(query, "riasec");
let schemaReady: Promise<void> | null = null;

function quotas(key: string): Quota[] {
  return [
    { key: `riasec-ip-hour:${key}`, limit: configuredLimit("RIASEC_LEAD_IP_HOUR_LIMIT", 5), seconds: 3600, reason: "ip_hour" },
    { key: "riasec-global-hour", limit: configuredLimit("RIASEC_LEAD_GLOBAL_HOUR_LIMIT", 500), seconds: 3600, reason: "global_hour" },
  ];
}

function resultRows(result: any): any[] {
  return Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await neonSql.query(`
        CREATE TABLE IF NOT EXISTS riasec_lead_results (
          id uuid PRIMARY KEY,
          ip_hash text NOT NULL,
          answers jsonb NOT NULL,
          report jsonb NOT NULL,
          expires_at timestamptz NOT NULL,
          claimed_user_id varchar,
          claimed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await neonSql.query(`CREATE INDEX IF NOT EXISTS riasec_lead_results_expiry_idx ON riasec_lead_results (expires_at)`);
      await neonSql.query(CV_LEAD_QUOTA_SCHEMA);
      await neonSql.query(PUBLIC_LEAD_QUOTA_FUNCTION);
      await neonSql.query(PUBLIC_LEAD_REFUSAL_SCHEMA);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function cleanupExpired(): Promise<void> {
  try {
    await neonSql.query(`
      DELETE FROM riasec_lead_results WHERE id IN (
        SELECT id FROM riasec_lead_results
        WHERE expires_at <= now() AND claimed_user_id IS NULL
        ORDER BY expires_at LIMIT 50
      )
    `);
  } catch {
    console.warn("[RIASEC Lead] expired result cleanup failed");
  }
}

export async function initializeRiasecLeadRoutes(): Promise<void> {
  await ensureSchema();
  void cleanupExpired();
  const cleanupTimer = setInterval(() => void cleanupExpired(), 60 * 60 * 1000);
  cleanupTimer.unref();
}

export function registerRiasecLeadRoutes(app: Express): void {
  app.use(["/test-riasec/questions", "/test-riasec/resultat"], (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/public/riasec-lead", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.post("/api/public/riasec-lead/result", async (req, res) => {
    const answers = req.body?.answers;
    if (!isCompleteRiasec(answers)) {
      return res.status(400).json({ error: `Il manque des réponses : les ${RIASEC_QUESTIONS.length} questions sont nécessaires pour calculer votre profil.` });
    }
    res.locals.leadRequestId = crypto.randomUUID();
    try {
      try { await ensureSchema(); } catch { reject(res, "quota_unavailable"); return; }
      const clientKey = publicCvClientKey(req);
      const decision = await reserveQuotas(query, "riasec", quotas(clientKey), true);
      if (!decision.allowed) { reject(res, decision.reason, decision.retryAfter, decision.limit, decision.windowSeconds); return; }
      const clean = Object.fromEntries(RIASEC_QUESTIONS.map(({ order }) => [order, answers[order]]));
      const report = await interpretRiasec(scoreRiasec(clean));
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + REPORT_TTL_MS).toISOString();
      // Un membre connecté reçoit tout de suite le résultat complet, rattaché à son compte.
      const userId = req.isAuthenticated?.() ? getUserId(req) : null;
      await neonSql.query(
        `INSERT INTO riasec_lead_results (id, ip_hash, answers, report, expires_at, claimed_user_id, claimed_at)
         VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::timestamptz, $6::varchar, CASE WHEN $6::varchar IS NULL THEN NULL ELSE now() END)`,
        [id, clientKey, JSON.stringify(clean), JSON.stringify(report), expiresAt, userId],
      );
      res.status(201).json({ id, expiresAt, report: userId ? report : publicRiasecPreview(report), unlocked: Boolean(userId) });
      void cleanupExpired();
    } catch {
      console.error("[RIASEC Lead] result unavailable");
      if (!res.headersSent) res.status(503).json({ error: "Le calcul de votre profil est momentanément indisponible. Vos réponses sont gardées : réessayez dans un instant." });
    }
  });

  // Débloquer : rattache le résultat au compte connecté (une seule fois) et le renvoie en entier.
  app.post("/api/riasec-lead/:id/claim", isAuthenticated, async (req: any, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant de résultat invalide." });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      await ensureSchema();
      const rows = await httpSelectSafe(async () => resultRows(await neonSql.query(`
        WITH claimed AS (
          UPDATE riasec_lead_results
          SET claimed_user_id = $2::varchar, claimed_at = COALESCE(claimed_at, now())
          WHERE id = $1::uuid
            AND (claimed_user_id IS NULL OR claimed_user_id = $2::varchar)
            AND (expires_at > now() OR claimed_user_id = $2::varchar)
          RETURNING id, report, expires_at
        )
        SELECT (SELECT json_build_object('id', id, 'report', report, 'expiresAt', expires_at) FROM claimed) AS result
      `, [req.params.id, userId])));
      if (!rows[0]?.result) return res.status(404).json({ error: "Résultat introuvable, expiré ou déjà rattaché à un autre compte." });
      res.json({ ...rows[0].result, unlocked: true });
    } catch {
      console.error("[RIASEC Lead] claim unavailable");
      res.status(500).json({ error: "Impossible de récupérer ce résultat." });
    }
  });

  app.get("/api/public/riasec-lead/:id", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant de résultat invalide." });
    try {
      await ensureSchema();
      const rows = await httpSelectSafe(async () => resultRows(await neonSql.query(
        `SELECT (SELECT json_build_object('id', id, 'report', report, 'expiresAt', expires_at)
         FROM riasec_lead_results WHERE id = $1::uuid AND expires_at > now()) AS result`,
        [req.params.id],
      )));
      if (!rows[0]?.result) return res.status(404).json({ error: "Ce résultat a expiré. Repassez le test, il prend une dizaine de minutes." });
      res.json({ ...rows[0].result, report: publicRiasecPreview(rows[0].result.report), unlocked: false });
    } catch {
      console.error("[RIASEC Lead] report unavailable");
      res.status(500).json({ error: "Impossible de récupérer ce résultat." });
    }
  });
}
