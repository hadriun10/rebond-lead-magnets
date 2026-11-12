import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import multer from "multer";
import { httpSelectSafe, neonSql } from "../db";
import { getUserId, isAuthenticated } from "../auth/session";
import { CV_LEAD_QUOTA_SCHEMA, publicCvClientKey } from "../lib/cvLeadAdmission";
import {
  configuredLimit,
  createAnalysisCapacity,
  createLeadRefusals,
  PUBLIC_LEAD_QUOTA_FUNCTION,
  PUBLIC_LEAD_REFUSAL_SCHEMA,
  reserveQuotas,
  type Quota,
} from "../lib/publicLeadLimits";
import { detectCvMimeType, extractText } from "./cvLeadRoutes";
import { buildProfileDossier } from "../services/linkedinLeadAnalysis";
import { fetchProfile, HarvestError, publicIdentifierFrom, searchProfiles } from "../services/linkedinLeadHarvest";
import { extractSalaryProfile, SalaryLeadOutputError } from "../services/salaryLeadExtraction";
import { estimateSalary, publicSalaryPreview } from "../services/salaryLeadEngine";

/**
 * Lead magnet « Quel salaire puis-je prétendre ? ».
 *
 * Entrée : un CV (multipart, champ `cv`) ou un profil LinkedIn (JSON `{ profile }`).
 * Pour l'instant le rapport est public en entier : pas de floutage ni de connexion.
 * Quand le floutage arrivera, il devra se faire ici (aperçu tronqué côté serveur),
 * jamais seulement en CSS.
 */

const REPORT_TTL_MS = 60 * 60 * 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNAVAILABLE = "Le service d’estimation est temporairement indisponible. Réessayez dans quelques instants.";

const query = (sql: string, params: any[]) => neonSql.query(sql, params);
const reject = createLeadRefusals(query, "salary");
const analysisLimit = configuredLimit("SALARY_LEAD_ANALYZE_MAX_CONCURRENT", 4);
const analyses = createAnalysisCapacity(analysisLimit, analysisLimit, configuredLimit("SALARY_LEAD_CAPACITY_WAIT_MS", 20_000));
const searchLimit = configuredLimit("SALARY_LEAD_SEARCH_MAX_CONCURRENT", 10);
const searches = createAnalysisCapacity(searchLimit, searchLimit, configuredLimit("SALARY_LEAD_CAPACITY_WAIT_MS", 20_000));
const activeClients = new Set<string>();
let schemaReady: Promise<void> | null = null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => cb(null, [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/octet-stream",
    "image/jpeg",
    "image/png",
    "image/webp",
  ].includes(file.mimetype)),
});

function quotas(key: string): Quota[] {
  return [
    { key: `salary-ip-hour:${key}`, limit: configuredLimit("SALARY_LEAD_IP_HOUR_LIMIT", 3), seconds: 3600, reason: "ip_hour" },
    { key: `salary-ip-day:${key}`, limit: configuredLimit("SALARY_LEAD_IP_DAY_LIMIT", 5), seconds: 86400, reason: "ip_day" },
    { key: "salary-global-hour", limit: configuredLimit("SALARY_LEAD_GLOBAL_HOUR_LIMIT", 200), seconds: 3600, reason: "global_hour" },
    { key: "salary-global-day", limit: configuredLimit("SALARY_LEAD_GLOBAL_DAY_LIMIT", 1000), seconds: 86400, reason: "global_day" },
  ];
}

function resultRows(result: any): any[] {
  return Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await neonSql.query(`
        CREATE TABLE IF NOT EXISTS salary_lead_analyses (
          id uuid PRIMARY KEY,
          ip_hash text NOT NULL,
          source text NOT NULL,
          report jsonb NOT NULL,
          expires_at timestamptz NOT NULL,
          claimed_user_id varchar,
          claimed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await neonSql.query(`CREATE INDEX IF NOT EXISTS salary_lead_analyses_expiry_idx ON salary_lead_analyses (expires_at)`);
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
      DELETE FROM salary_lead_analyses WHERE id IN (
        SELECT id FROM salary_lead_analyses
        WHERE expires_at <= now() AND claimed_user_id IS NULL
        ORDER BY expires_at LIMIT 50
      )
    `);
  } catch {
    console.warn("[Salary Lead] expired report cleanup failed");
  }
}

export async function initializeSalaryLeadRoutes(): Promise<void> {
  await ensureSchema();
  void cleanupExpired();
  const cleanupTimer = setInterval(() => void cleanupExpired(), 15 * 60 * 1000);
  cleanupTimer.unref();
}

/** Lit le multipart s'il y en a un ; renvoie false si une réponse d'erreur est déjà partie. */
function readUpload(req: Request, res: Response): Promise<boolean> {
  if (!req.is("multipart/form-data")) return Promise.resolve(true);
  return new Promise((resolve) => {
    upload.single("cv")(req, res, (error: any) => {
      if (error) {
        res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Fichier invalide ou trop lourd : 10 Mo au maximum, en PDF, Word ou image." });
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

const CONTRACTS: Record<string, string> = {
  Internship: "stage", Apprenticeship: "alternance", "Work Study": "alternance", Volunteer: "bénévolat", "Full-time": "CDI temps plein", Permanent: "CDI",
  "Part-time": "temps partiel", Contract: "CDD", "Contract Part-time": "CDD temps partiel", Freelance: "freelance",
  "Self-employed": "indépendant", Seasonal: "saisonnier",
};

/** Le dossier LinkedIn ne dit pas si un poste était un stage : on l'écrit dans l'intitulé. */
export function withContractTypes(profile: any): any {
  if (!Array.isArray(profile?.experience)) return profile;
  return {
    ...profile,
    experience: profile.experience.map((exp: any) => {
      const type = typeof exp?.employmentType === "string" ? CONTRACTS[exp.employmentType] ?? exp.employmentType : "";
      return type && exp?.position ? { ...exp, position: `${exp.position} [${type}]` } : exp;
    }),
  };
}

type Input =
  | { source: "cv"; read: () => Promise<Parameters<typeof extractSalaryProfile>[0]> }
  | { source: "linkedin"; read: () => Promise<Parameters<typeof extractSalaryProfile>[0]> };

function inputOf(req: Request, res: Response): Input | null {
  if (req.file) {
    const mime = detectCvMimeType(req.file.buffer, req.file.mimetype);
    if (!mime) {
      res.status(415).json({ error: "Ce fichier n’est pas lisible : envoyez votre CV en PDF, Word ou image." });
      return null;
    }
    const buffer = req.file.buffer;
    return {
      source: "cv",
      read: async () => {
        if (mime.startsWith("image/")) return { kind: "image", dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
        const content = await extractText(buffer, mime);
        if (content.trim().length < 80) {
          throw new SalaryLeadOutputError("Ce CV ne contient presque pas de texte lisible (PDF scanné ?). Envoyez-le en photo ou en Word.");
        }
        return { kind: "text", content };
      },
    };
  }
  if (req.body?.profile !== undefined) {
    const publicIdentifier = publicIdentifierFrom(req.body.profile);
    if (!publicIdentifier) {
      res.status(400).json({ error: "Cette adresse de profil LinkedIn n’est pas reconnue. Elle ressemble à linkedin.com/in/votre-nom." });
      return null;
    }
    return {
      source: "linkedin",
      read: async () => ({ kind: "text", content: buildProfileDossier(withContractTypes(await fetchProfile(publicIdentifier)), []) }),
    };
  }
  res.status(400).json({ error: "Ajoutez votre CV ou l’adresse de votre profil LinkedIn." });
  return null;
}

export function registerSalaryLeadRoutes(app: Express): void {
  app.use(["/estimation-salaire/resultat", "/estimation-salaire/chargement"], (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/public/salary-lead", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Même recherche que le lead magnet LinkedIn : on retrouve son profil par prénom et nom.
  app.post("/api/public/salary-lead/search", async (req, res) => {
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
      return res.status(400).json({ error: "Indiquez votre prénom et votre nom." });
    }
    res.locals.leadRequestId = crypto.randomUUID();
    const release = await searches.acquire(true);
    if (!release) { reject(res, "capacity", 60, searchLimit); return; }
    try {
      res.json({ profiles: await searchProfiles(firstName, lastName) });
    } catch {
      console.error("[Salary Lead] search unavailable");
      res.status(503).json({ error: "La recherche est momentanément indisponible. Collez l’adresse de votre profil LinkedIn à la place." });
    } finally {
      release();
    }
  });

  app.post("/api/public/salary-lead/analyze", async (req, res) => {
    res.locals.leadRequestId = crypto.randomUUID();
    let clientKey: string | null = null;
    let releaseCapacity: (() => void) | null = null;
    try {
      try { await ensureSchema(); } catch { reject(res, "quota_unavailable"); return; }
      clientKey = publicCvClientKey(req);
      if (activeClients.has(clientKey)) { clientKey = null; reject(res, "already_running", 60, 1); return; }
      activeClients.add(clientKey);
      const check = await reserveQuotas(query, "salary", quotas(clientKey), false);
      if (!check.allowed) { reject(res, check.reason, check.retryAfter, check.limit, check.windowSeconds); return; }

      if (!await readUpload(req, res)) return;
      const input = inputOf(req, res);
      if (!input) return;

      releaseCapacity = await analyses.acquire(true);
      if (!releaseCapacity) { reject(res, "capacity", 60, analysisLimit); return; }
      if (req.aborted || res.destroyed) return;
      // Les compteurs ne bougent qu'une fois l'entrée valide : un fichier refusé ne coûte rien.
      const spend = await reserveQuotas(query, "salary", quotas(clientKey), true);
      if (!spend.allowed) { reject(res, spend.reason, spend.retryAfter, spend.limit, spend.windowSeconds); return; }

      const profile = await extractSalaryProfile(await input.read());
      const report = estimateSalary(profile, input.source);
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + REPORT_TTL_MS).toISOString();
      // Un membre connecté reçoit tout de suite le rapport complet, rattaché à son compte.
      const userId = req.isAuthenticated?.() ? getUserId(req) : null;
      await neonSql.query(
        `INSERT INTO salary_lead_analyses (id, ip_hash, source, report, expires_at, claimed_user_id, claimed_at)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5::timestamptz, $6::varchar, CASE WHEN $6::varchar IS NULL THEN NULL ELSE now() END)`,
        [id, clientKey, input.source, JSON.stringify(report), expiresAt, userId],
      );
      res.status(201).json({ id, expiresAt, report: userId ? report : publicSalaryPreview(report), unlocked: Boolean(userId) });
      void cleanupExpired();
    } catch (error) {
      if (res.headersSent) return;
      // Ne jamais journaliser le contenu du CV ni la réponse brute du fournisseur.
      console.error("[Salary Lead] analysis failed", error instanceof HarvestError ? error.diagnostic() : error instanceof SalaryLeadOutputError ? "invalid AI output" : "unavailable");
      if (error instanceof HarvestError && error.httpStatus === 404) {
        return res.status(404).json({ error: "Ce profil LinkedIn est introuvable ou n’est pas public. Vérifiez l’adresse et réessayez." });
      }
      if (error instanceof SalaryLeadOutputError) return res.status(422).json({ error: error.message });
      res.status(503).json({ error: UNAVAILABLE });
    } finally {
      if (clientKey) activeClients.delete(clientKey);
      releaseCapacity?.();
    }
  });

  // Débloquer : rattache l'estimation au compte connecté (une seule fois) et renvoie le rapport complet.
  app.post("/api/salary-lead/:id/claim", isAuthenticated, async (req: any, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant d’estimation invalide." });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      await ensureSchema();
      const rows = await httpSelectSafe(async () => resultRows(await neonSql.query(`
        WITH claimed AS (
          UPDATE salary_lead_analyses
          SET claimed_user_id = $2::varchar, claimed_at = COALESCE(claimed_at, now())
          WHERE id = $1::uuid
            AND (claimed_user_id IS NULL OR claimed_user_id = $2::varchar)
            AND (expires_at > now() OR claimed_user_id = $2::varchar)
          RETURNING id, report, expires_at
        )
        SELECT (SELECT json_build_object('id', id, 'report', report, 'expiresAt', expires_at) FROM claimed) AS result
      `, [req.params.id, userId])));
      if (!rows[0]?.result) return res.status(404).json({ error: "Estimation introuvable, expirée ou déjà rattachée à un autre compte." });
      res.json({ ...rows[0].result, unlocked: true });
    } catch {
      console.error("[Salary Lead] claim unavailable");
      res.status(500).json({ error: "Impossible de récupérer cette estimation." });
    }
  });

  // L'identifiant est un UUID aléatoire et le rapport expire au bout d'une heure.
  app.get("/api/public/salary-lead/:id", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant d’estimation invalide." });
    try {
      await ensureSchema();
      const rows = await httpSelectSafe(async () => resultRows(await neonSql.query(
        `SELECT (SELECT json_build_object('id', id, 'report', report, 'expiresAt', expires_at)
         FROM salary_lead_analyses WHERE id = $1::uuid AND expires_at > now()) AS result`,
        [req.params.id],
      )));
      if (!rows[0]?.result) return res.status(404).json({ error: "Cette estimation a expiré. Relancez-la, c’est gratuit." });
      res.json({ ...rows[0].result, report: publicSalaryPreview(rows[0].result.report), unlocked: false });
    } catch {
      console.error("[Salary Lead] report unavailable");
      res.status(500).json({ error: "Impossible de récupérer cette estimation." });
    }
  });
}
