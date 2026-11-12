import type { Express, Request } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { isAuthenticated, getUserId } from "../auth/session";
import { objectStorageClient, parseObjectPath } from "../objectStorage";
import { httpSelectSafe, neonSql, pool } from "../db";
import { CV_LEAD_AXES, buildCvLeadMirrorPrompt, CV_LEAD_MIRROR_RESPONSE_FORMAT, axisPrompt, axisResponseFormat, type CvLeadAxisKey, type CvLeadAxisDefinition } from "../prompts/cvLeadDetailed";
import { mistralJson } from "../lib/mistralJson";
export { mistralJson } from "../lib/mistralJson";
import { parseCV, parseCVFromImage, parseCVFromPDF } from "../openai";
import { storage } from "../storage";
import { cvAnalysisFailureDetails } from "../utils/cvAnalysisDiagnostics";
import { createPublicCvAdmission, CV_LEAD_QUOTA_SCHEMA } from "../lib/cvLeadAdmission";
import { configuredLimit, createAnalysisCapacity, PUBLIC_LEAD_QUOTA_FUNCTION, PUBLIC_LEAD_REFUSAL_SCHEMA } from "../lib/publicLeadLimits";
import { cvChronologyContradiction, cvChronologyEvidence } from "../utils/cvChronology";
import { createCvDiagnostic, CV_DIAGNOSTIC_SCHEMA, CvDiagnosticFailure, type DiagnosticFile } from "../lib/cvDiagnostic";
import { ensureCvLibrarySchema, finishLibraryExtraction, recoverLegacyLibraryCv } from "../services/cvLibrary";
import { db } from "../db";
import { userCvDocuments } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { reserveAnalysis, settleAnalysis, heartbeatAnalysis, analysisErrorResponse } from "../services/analysisQuotaService";
import { PaywallError } from "../services/paywallService";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const REPORT_TTL_MS = 60 * 60 * 1000;
const CV_DIAGNOSTIC_RANDOM_SEED = 42;
const MAX_CONCURRENT = configuredLimit("CV_LEAD_MAX_CONCURRENT", 12);

const MAX_PUBLIC_CONCURRENT = Math.min(MAX_CONCURRENT, configuredLimit("CV_LEAD_PUBLIC_MAX_CONCURRENT", 8));
const AXES = [
  { key: "clarity", label: "Clarté et lisibilité" },
  { key: "impact", label: "Impact des réalisations" },
  { key: "coherence", label: "Cohérence du parcours" },
  { key: "targeting", label: "Adéquation au projet" },
] as const;
type AxisKey = typeof AXES[number]["key"];
let schemaReady: Promise<void> | null = null;
const publicCvAdmission = createPublicCvAdmission((sql, parameters) => neonSql.query(sql, parameters));

function resultRows(result: any): any[] {
  return Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
}

async function readReportRows(sql: string, parameters: any[]): Promise<any[]> {
  // A missing report is expected. Guard only the HTTP driver's known
  // empty-result defect; connection, permission and SQL errors still propagate.
  return httpSelectSafe(async () => resultRows(await neonSql.query(sql, parameters)));
}

type ProfileAnalysisLockQuery = (sql: string, parameters: any[]) => Promise<any>;

const queryProfileAnalysisLock: ProfileAnalysisLockQuery = (sql, parameters) =>
  neonSql.query(sql, parameters);

export async function acquireProfileAnalysisLease(
  userId: string,
  query: ProfileAnalysisLockQuery = queryProfileAnalysisLock,
): Promise<string | null> {
  const requestedToken = crypto.randomUUID();
  // Return one row even when another owner holds the lease, avoiding the
  // HTTP driver's empty-result defect without hiding a failed lock operation.
  const rows = resultRows(await query(
    `WITH acquired AS (
      INSERT INTO cv_lead_profile_analysis_locks (user_id, locked_at, owner_token)
     VALUES ($1, now(), $2)
     ON CONFLICT (user_id) DO UPDATE
     SET locked_at = now(),
         owner_token = EXCLUDED.owner_token
     WHERE cv_lead_profile_analysis_locks.locked_at < now() - interval '5 minutes'
     RETURNING owner_token
     )
     SELECT (SELECT owner_token FROM acquired) AS owner_token`,
    [userId, requestedToken],
  ));
  return typeof rows[0]?.owner_token === "string" ? rows[0].owner_token : null;
}

export async function releaseProfileAnalysisLease(
  userId: string,
  ownerToken: string,
  query: ProfileAnalysisLockQuery = queryProfileAnalysisLock,
): Promise<void> {
  // An already released/replaced lease must also return a non-empty result.
  await query(
    `WITH released AS (
       DELETE FROM cv_lead_profile_analysis_locks
       WHERE user_id = $1 AND owner_token = $2
       RETURNING user_id
     )
     SELECT count(*)::int AS released FROM released`,
    [userId, ownerToken],
  );
}

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
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ].includes(file.mimetype)),
});

type Report = {
  overallScore: number;
  detectedRole: string;
  experienceYears: number | null;
  mirror: { originalExcerpt: string; recruiterReads: string; severity: "faible" | "moyenne" | "forte"; headline: string };
  axes: DetailedAxis[];
  firstRecommendation: string;
  recommendations: string[];
  actionPlan: ActionPlanItem[];
};

type LegacyReport = {
  overallScore: number;
  detectedRole: string;
  mirror: { originalExcerpt: string; recruiterReads: string };
  axes: Array<{ key: AxisKey; label: string; score: number; summary: string }>;
  firstRecommendation: string;
  recommendations: string[];
  actionPlan: Array<{ title: string; description: string }>;
};

type DetailedMarker = { key: string; label: string; score: number | null; finding: string; fix: string };
type DetailedAxis = {
  key: CvLeadAxisKey;
  label: string;
  question: string;
  weight: number;
  score: number | null;
  verdict: string;
  markers: DetailedMarker[];
};
type ActionPlanItem = {
  rank: number;
  axis: CvLeadAxisKey;
  title: string;
  finding: string;
  fix: string;
};

export class CvLeadOutputError extends Error {
  readonly code?: string;
  constructor(message = "L’analyse n’a pas produit un diagnostic complet. Aucun score n’a été enregistré. Réessayez dans un instant.", options?: ErrorOptions & { code?: string }) {
    super(message, options);
    this.name = "CvLeadOutputError";
    this.code = options?.code;
  }
}

export function hashCvContents(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function claimReportContentHash(existingHash: string | null | undefined, privateStoredContents: Buffer): string {
  return existingHash || hashCvContents(privateStoredContents);
}

export function profileCvReportMatches(
  currentFileName: string,
  requestedFileName: string,
  currentContentHash: string,
  reportContentHash: string | null | undefined,
): boolean {
  return currentFileName === requestedFileName &&
    Boolean(reportContentHash) &&
    currentContentHash === reportContentHash;
}

export function privateReportCvMatches(currentContents: Buffer, privateStoredContents: Buffer): boolean {
  return hashCvContents(currentContents) === hashCvContents(privateStoredContents);
}

export function deterministicOverallScore(markers: Record<AxisKey, number>): number {
  const values = AXES.map(({ key }) => clampMarker(markers[key]));
  return Math.round((values.reduce((sum, value) => sum + value, 0) / (AXES.length * 3)) * 100);
}

function clampMarker(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(3, Math.round(number)));
}

function opaqueId(): string {
  return crypto.randomUUID();
}

function ipHash(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const address = typeof forwarded === "string"
    ? forwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "unknown";
  return crypto.createHash("sha256").update(`${process.env.CV_LEAD_IP_SALT || "rebond-cv-lead"}:${address}`).digest("hex");
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await neonSql.query(CV_LEAD_QUOTA_SCHEMA);
      await neonSql.query(PUBLIC_LEAD_QUOTA_FUNCTION);
      await neonSql.query(PUBLIC_LEAD_REFUSAL_SCHEMA);
      await neonSql.query(CV_DIAGNOSTIC_SCHEMA);
      await ensureCvLibrarySchema();
      await neonSql.query(`CREATE INDEX IF NOT EXISTS cv_lead_public_quotas_expiry_idx ON cv_lead_public_quotas (expires_at)`);
      await neonSql.query(`
        CREATE TABLE IF NOT EXISTS cv_lead_analyses (
          id uuid PRIMARY KEY,
          ip_hash text NOT NULL,
          storage_key text NOT NULL,
          original_filename text NOT NULL,
          mime_type text NOT NULL,
          file_size integer NOT NULL,
          report jsonb NOT NULL,
          parsed_cv_data jsonb,
          expires_at timestamptz NOT NULL,
          claimed_user_id varchar,
          claimed_at timestamptz,
          cv_document_id varchar,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      // Neon HTTP prepares each query and rejects multiple SQL commands in one
      // prepared statement. Keep compatibility DDL as individual calls.
      await neonSql.query(
        `ALTER TABLE cv_lead_analyses ADD COLUMN IF NOT EXISTS original_filename text`,
      );
      await neonSql.query(
        `ALTER TABLE cv_lead_analyses ADD COLUMN IF NOT EXISTS cv_document_id varchar`,
      );
      await neonSql.query(
        `ALTER TABLE cv_lead_analyses ADD COLUMN IF NOT EXISTS parsed_cv_data jsonb`,
      );
      await neonSql.query(
        `ALTER TABLE cv_lead_analyses ADD COLUMN IF NOT EXISTS content_hash text`,
      );
      await neonSql.query(
        `CREATE INDEX IF NOT EXISTS cv_lead_analyses_expiry_idx ON cv_lead_analyses (expires_at)`,
      );
      await neonSql.query(`
        CREATE TABLE IF NOT EXISTS cv_lead_profile_analysis_locks (
          user_id varchar PRIMARY KEY,
          locked_at timestamptz NOT NULL DEFAULT now(),
          owner_token text NOT NULL
        )
      `);
      await neonSql.query(
        `ALTER TABLE cv_lead_profile_analysis_locks ADD COLUMN IF NOT EXISTS owner_token text`,
      );
      await neonSql.query(`
        CREATE INDEX IF NOT EXISTS cv_lead_analyses_profile_content_idx
        ON cv_lead_analyses (claimed_user_id, original_filename, content_hash)
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function detectCvMimeType(buffer: Buffer, declared: string): string | null {
  const inferred = declared === "application/octet-stream";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return inferred || declared === "application/pdf" ? "application/pdf" : null;
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && (inferred || declared === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && (inferred || declared === "image/png")) return "image/png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && (inferred || declared === "image/jpeg")) return "image/jpeg";
  if (buffer.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) && (inferred || declared === "image/gif")) return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" && (inferred || declared === "image/webp")) return "image/webp";
  // HEIC/HEIF files use the ISO Base Media File Format. The ftyp box starts
  // after a 4-byte size and has a four-byte major brand at offset 8.
  if ((inferred || declared === "image/heic" || declared === "image/heif") && buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brands = [buffer.subarray(8, 12).toString("ascii"), ...Array.from({ length: Math.floor(Math.min(buffer.length, 128) / 4) }, (_, i) => buffer.subarray(16 + i * 4, 20 + i * 4).toString("ascii"))];
    if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand))) return declared === "image/heif" ? "image/heif" : "image/heic";
  }
  if (declared === "text/plain" && !buffer.includes(0) && buffer.length > 0) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
    const controls = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length;
    if (controls / sample.length < 0.01) return declared;
  }
  return null;
}

export async function extractText(buffer: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const { pdf: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    return (parsed.text || "").slice(0, 30000);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value.slice(0, 30000);
  }
  return buffer.toString("utf8").slice(0, 30000);
}

export async function parseStructuredCv(buffer: Buffer, mime: string): Promise<Record<string, any>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      parseStructuredCvContents(buffer, mime),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Extraction interrompue. Réessayez.")), 240_000);
        timer.unref();
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

async function parseStructuredCvContents(buffer: Buffer, mime: string): Promise<Record<string, any>> {
  if (mime === "application/pdf") {
    return parseCVFromPDF(buffer);
  }
  if (mime.startsWith("image/")) {
    const visionMime = mime === "image/heic" || mime === "image/heif" ? "image/jpeg" : mime;
    return parseCVFromImage(buffer, visionMime);
  }
  const text = await extractText(buffer, mime);
  if (text.trim().length < 50) throw new Error("Le CV ne contient pas assez de texte exploitable.");
  return parseCV(text);
}

export function normalizeReport(axesRaw: any, mirrorRaw: any): LegacyReport {
  const readableText = (value: unknown, maxLength: number): string => {
    if (typeof value === "string") return value.trim().slice(0, maxLength);
    if (!value || typeof value !== "object") return "";
    const parts: string[] = [];
    const visit = (entry: unknown): void => {
      if (parts.join(" · ").length >= maxLength) return;
      if (typeof entry === "string" && entry.trim()) {
        parts.push(entry.trim());
      } else if (Array.isArray(entry)) {
        entry.forEach(visit);
      } else if (entry && typeof entry === "object") {
        Object.values(entry as Record<string, unknown>).forEach(visit);
      }
    };
    visit(value);
    return parts.join(" · ").slice(0, maxLength);
  };
  const rawAxis = (key: AxisKey, index: number): any => {
    if (Array.isArray(axesRaw.axes)) {
      return axesRaw.axes.find((axis: any) => axis?.key === key || axis?.name === key || axis?.id === key)
        ?? axesRaw.axes[index];
    }
    const value = axesRaw.axes?.[key];
    if (typeof value === "number") {
      return {
        score: value,
        summary: axesRaw.axisSummaries?.[key] ?? axesRaw.summaries?.[key],
      };
    }
    return value;
  };
  const markers: Record<AxisKey, number> = Object.fromEntries(AXES.map(({ key }, index) => [key, clampMarker(rawAxis(key, index)?.score)])) as Record<AxisKey, number>;
  const axes = AXES.map(({ key, label }, index) => ({
    key,
    label,
    score: markers[key],
    summary: typeof rawAxis(key, index)?.summary === "string" ? rawAxis(key, index).summary.slice(0, 500) : "Aucun résumé disponible.",
  }));
  const recommendations = Array.isArray(axesRaw.recommendations)
    ? axesRaw.recommendations.filter((item: unknown): item is string => typeof item === "string").slice(0, 8)
    : [];
  const actionPlan = Array.isArray(axesRaw.actionPlan)
    ? axesRaw.actionPlan.slice(0, 6).map((item: any) => ({
      title: typeof item?.title === "string" ? item.title.slice(0, 160) : "Prochaine amélioration",
      description: typeof item?.description === "string" ? item.description.slice(0, 700) : "",
    }))
    : [];
  return {
    overallScore: deterministicOverallScore(markers),
    detectedRole: typeof axesRaw.detectedRole === "string" ? axesRaw.detectedRole.slice(0, 160) : "Profil professionnel",
    mirror: {
      originalExcerpt: readableText(mirrorRaw.originalExcerpt, 500),
      recruiterReads: readableText(mirrorRaw.recruiterReads, 700),
    },
    axes,
    firstRecommendation: recommendations[0] || "",
    recommendations,
    actionPlan,
  };
}

export function publicPreview(report: Report) {
  return {
    overallScore: report.overallScore,
    detectedRole: report.detectedRole,
    experienceYears: report.experienceYears,
    mirror: report.mirror,
    axes: report.axes.map((axis) => {
      const sorted = [...axis.markers].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      return {
        ...axis,
        markers: sorted.slice(0, 2),
        lockedMarkerCount: Math.max(0, sorted.length - 2),
      };
    }),
    firstRecommendation: report.firstRecommendation,
  };
}

function trimText(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

function detailedAxisScore(markers: DetailedMarker[]): number | null {
  const scores = markers.map((marker) => marker.score).filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / (scores.length * 3)) * 100);
}

function validateDetailedAxis(raw: any, definition: typeof CV_LEAD_AXES[number]): DetailedAxis {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CvLeadOutputError(`L’axe « ${definition.label} » n’a pas fourni de réponse exploitable. Aucun score n’a été enregistré.`);
  }
  if (raw.status !== "assessable" && raw.status !== "[unassessable]") {
    throw new CvLeadOutputError(`Le statut de l’axe « ${definition.label} » est manquant ou invalide. Aucun score n’a été enregistré.`);
  }
  if (!Array.isArray(raw.markers) || raw.markers.length !== definition.markers.length) {
    throw new CvLeadOutputError(`Les marqueurs de l’axe « ${definition.label} » sont incomplets. Aucun score n’a été enregistré.`);
  }

  const byKey = new Map<string, any>();
  for (const marker of raw.markers) {
    const key = marker?.key ?? marker?.cle;
    if (typeof key !== "string" || byKey.has(key)) {
      throw new CvLeadOutputError(`Les marqueurs de l’axe « ${definition.label} » sont invalides. Aucun score n’a été enregistré.`);
    }
    byKey.set(key, marker);
  }

  const markers: DetailedMarker[] = definition.markers.map((marker) => {
    const value = byKey.get(marker.key);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CvLeadOutputError(`Le marqueur « ${marker.label} » est absent. Aucun score n’a été enregistré.`);
    }
    const rawScore = Object.prototype.hasOwnProperty.call(value, "score") ? value.score : value.note;
    if (rawScore !== null && (!Number.isInteger(rawScore) || rawScore < 0 || rawScore > 3)) {
      throw new CvLeadOutputError(`Le score du marqueur « ${marker.label} » est invalide. Aucun score global n’a été enregistré.`);
    }
    const rawFinding = value.finding ?? value.constat;
    const rawFix = value.fix ?? value.correctif;
    if (typeof rawFinding !== "string" || !rawFinding.trim() || typeof rawFix !== "string") {
      throw new CvLeadOutputError(`Le constat ou le correctif du marqueur « ${marker.label} » est incomplet. Aucun score n’a été enregistré.`);
    }
    if (rawScore === null && !/non\s+d[ée]tectable|non\s+évaluable|impossible\s+à\s+évaluer/i.test(rawFinding)) {
      throw new CvLeadOutputError(`Le constat du marqueur « ${marker.label} » ne justifie pas son absence de score. Aucun score n’a été enregistré.`);
    }
    if (rawScore !== null && rawScore < 3 && !rawFix.trim()) {
      throw new CvLeadOutputError(`Le correctif du marqueur « ${marker.label} » est absent. Aucun score n’a été enregistré.`);
    }
    return {
      key: marker.key,
      label: marker.label,
      score: rawScore,
      finding: trimText(rawFinding, 160),
      fix: trimText(rawFix, 180),
    };
  });

  const hasAssessableMarker = markers.some((marker) => marker.score !== null);
  const statusIsUnassessable = raw.status === "[unassessable]";
  if (statusIsUnassessable === hasAssessableMarker) {
    throw new CvLeadOutputError(`Le statut de l’axe « ${definition.label} » contredit ses marqueurs. Aucun score n’a été enregistré.`);
  }
  if (typeof raw.verdict !== "string" || !raw.verdict.trim()) {
    throw new CvLeadOutputError(`La synthèse de l’axe « ${definition.label} » est absente. Aucun score n’a été enregistré.`);
  }

  return {
    key: definition.key,
    label: definition.label,
    question: definition.question,
    weight: definition.weight,
    score: detailedAxisScore(markers),
    verdict: trimText(raw.verdict, 220),
    markers,
  };
}

function validateDetailedMirror(raw: any): Report["mirror"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CvLeadOutputError("Le retour recruteur n’a pas fourni de réponse exploitable. Aucun rapport n’a été enregistré.");
  }
  const originalExcerpt = raw.originalExcerpt ?? raw.ecrit;
  const recruiterReads = raw.recruiterReads ?? raw.percu;
  const severity = raw.severity ?? raw.severite;
  const headline = raw.headline ?? raw.phrase;
  if (
    typeof originalExcerpt !== "string" || !originalExcerpt.trim() ||
    typeof recruiterReads !== "string" || !recruiterReads.trim() ||
    typeof headline !== "string" || !headline.trim() ||
    !["faible", "moyenne", "forte"].includes(severity)
  ) {
    throw new CvLeadOutputError("Le retour recruteur est incomplet ou invalide. Aucun rapport n’a été enregistré.");
  }
  return {
    originalExcerpt: trimText(originalExcerpt, 300),
    recruiterReads: trimText(recruiterReads, 400),
    severity,
    headline: trimText(headline, 160),
  };
}

function isInvalidJson(error: unknown): boolean {
  return error instanceof SyntaxError || (
    error instanceof Error && ["Invalid Mistral JSON response", "Invalid Mistral JSON object"].includes(error.message)
  );
}

function validateDetectedProfile(raw: Record<string, any>): void {
  const role = raw.detectedRole ?? raw.metierDetecte;
  const years = raw.experienceYears ?? raw.anneesExperience;
  if (raw.status === "assessable" && (typeof role !== "string" || !role.trim())) {
    throw new CvLeadOutputError("Le métier détecté est absent. Aucun rapport n’a été enregistré.");
  }
  if ((years !== null && years !== undefined &&
    (typeof years !== "number" || !Number.isFinite(years) || years < 0)) ||
    (years === undefined && !Object.prototype.hasOwnProperty.call(raw, "experienceYears") &&
      !Object.prototype.hasOwnProperty.call(raw, "anneesExperience"))) {
    throw new CvLeadOutputError("Les années d’expérience détectées sont invalides. Aucun rapport n’a été enregistré.");
  }
}

async function analyzeDetailedAxis(
  definition: CvLeadAxisDefinition,
  source: any,
  vision: boolean,
  request: typeof mistralJson,
  now: Date,
  evidence: string,
): Promise<{ raw: Record<string, any>; axis: DetailedAxis }> {
  const prompt = axisPrompt(definition) + evidence;
  let chronologyError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: Record<string, any>;
    try {
      raw = await request([
        { role: "system", content: attempt === 0 ? prompt : `${prompt}
La précédente réponse était incomplète ou ne respectait pas le contrat.
Régénère uniquement cet axe depuis le CV original, avec chaque marqueur demandé exactement une fois.
Choisis un seul statut : "assessable" ou "[unassessable]", jamais les deux réunis.
N'invente aucun score ni constat pour compléter les champs manquants.
${chronologyError ?? ""}` },
        { role: "user", content: source },
      ], vision, axisResponseFormat(definition));
    } catch (cause) {
      if (attempt === 0 && isInvalidJson(cause)) continue;
      // Network failures, throttling and timeouts are not paid retries.
      throw new CvLeadOutputError("Une partie de l’analyse du CV est indisponible. Aucun score n’a été enregistré. Réessayez dans un instant.", { cause });
    }
    try {
      chronologyError = cvChronologyContradiction(raw, now);
      if (chronologyError) {
        throw new CvLeadOutputError("La chronologie du CV n’a pas pu être vérifiée. Aucun score n’a été enregistré.");
      }
      const axis = validateDetailedAxis(raw, definition);
      if (definition.key === "completude") validateDetectedProfile(raw);
      return { raw, axis };
    } catch (cause) {
      if (!(cause instanceof CvLeadOutputError)) throw cause;
      if (attempt === 0) continue;
      throw new CvLeadOutputError(cause.message, {
        cause, code: `CV_AXIS_${definition.key.toUpperCase()}_INVALID`,
      });
    }
  }
  throw new CvLeadOutputError();
}

async function analyzeRecruiterMirror(
  source: any,
  vision: boolean,
  request: typeof mistralJson,
  now: Date,
): Promise<Report["mirror"]> {
  // Retry only malformed output, once, without repeating the four scoring
  // agents or substituting made-up text/severity for missing fields.
  let chronologyError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const mirrorPrompt = buildCvLeadMirrorPrompt() + cvChronologyEvidence(source, now);
    const prompt = attempt === 0 ? mirrorPrompt : `${mirrorPrompt}
La précédente réponse était incomplète ou ne respectait pas le format demandé.
Régénère uniquement les quatre champs requis depuis le CV original.
Vérifie les trois chaînes non vides et une seule severity : faible, moyenne ou forte.
${chronologyError ?? ""}`;
    let raw: Record<string, any>;
    try {
      raw = await request([
        { role: "system", content: prompt },
        { role: "user", content: source },
      ], vision, CV_LEAD_MIRROR_RESPONSE_FORMAT);
    } catch (cause) {
      if (attempt === 0 && isInvalidJson(cause)) continue;
      throw new CvLeadOutputError("Le retour recruteur est indisponible. Aucun score ni rapport n’a été enregistré. Réessayez dans un instant.", { cause });
    }
    try {
      chronologyError = cvChronologyContradiction(raw, now);
      if (chronologyError) throw new CvLeadOutputError("La chronologie du retour recruteur n’a pas pu être vérifiée. Aucun rapport n’a été enregistré. Réessayez.");
      return validateDetailedMirror(raw);
    } catch (error) {
      if (attempt === 0 && error instanceof CvLeadOutputError) continue;
      throw error;
    }
  }
  throw new CvLeadOutputError("Le retour recruteur est incomplet ou invalide. Aucun rapport n’a été enregistré.");
}

export async function analyzeDetailedReport(
  source: any,
  vision: boolean,
  // Only the unified CV diagnostic is seeded; other transport consumers keep
  // their sampling parameters. Every axis/mirror repair uses this same request.
  request: typeof mistralJson = (messages, vision, responseFormat) =>
    mistralJson(messages, vision, responseFormat, undefined, CV_DIAGNOSTIC_RANDOM_SEED),
): Promise<Report> {
  const now = new Date();
  const evidence = cvChronologyEvidence(source, now);
  // Keep the four scoring agents parallel, then run the mirror separately.
  // A fifth simultaneous Mistral request can be throttled while the four axes
  // still succeed, leaving the report without its most important public hook.
  const settledAxes = await Promise.allSettled(CV_LEAD_AXES.map(definition =>
    analyzeDetailedAxis(definition, source, vision, request, now, evidence)));
  // Do not release a diagnostic's paid-work lease while sibling requests are
  // still running after one axis fails.
  const failedAxis = settledAxes.find((item) => item.status === "rejected");
  if (failedAxis?.status === "rejected") throw failedAxis.reason;
  const validatedAxes = settledAxes.map(item =>
    (item as PromiseFulfilledResult<{ raw: Record<string, any>; axis: DetailedAxis }>).value);
  const axisResults = validatedAxes.map(item => item.raw);
  const axes = validatedAxes.map(item => item.axis);
  const mirror = await analyzeRecruiterMirror(source, vision, request, now);
  const assessableAxes = axes.filter((axis) => axis.score !== null);
  if (!assessableAxes.length) {
    throw new CvLeadOutputError("Aucun axe du CV n’a pu être évalué. Aucun score n’a été enregistré. Vérifiez que le fichier contient un CV lisible, puis réessayez.");
  }
  const totalWeight = assessableAxes.reduce((sum, axis) => sum + axis.weight, 0);
  const weightedScore = Math.round(
    assessableAxes.reduce((sum, axis) => sum + (axis.score as number) * axis.weight, 0) / totalWeight,
  );
  const candidates = axes.flatMap((axis) => axis.markers
    .filter((marker) => marker.score !== null && marker.score < 3 && marker.fix)
    .map((marker) => ({
      axis: axis.key,
      title: marker.label,
      finding: marker.finding,
      fix: marker.fix,
      gain: (3 - (marker.score as number)) * axis.weight,
    })))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);
  const actionPlan = candidates.map(({ gain: _gain, ...item }, index) => ({ rank: index + 1, ...item }));
  const completeness = axisResults[0] || {};
  const firstRecommendation = actionPlan[0]?.fix || "";
  const rawDetectedRole = completeness.detectedRole ?? completeness.metierDetecte;
  const rawExperienceYears = completeness.experienceYears ?? completeness.anneesExperience;

  return {
    overallScore: weightedScore,
    detectedRole: trimText(typeof rawDetectedRole === "string" ? rawDetectedRole : "", 160),
    experienceYears: typeof rawExperienceYears === "number"
      ? Math.max(0, Math.round(rawExperienceYears))
      : null,
    mirror,
    axes,
    firstRecommendation,
    recommendations: actionPlan.map((item) => item.fix),
    actionPlan,
  };
}

async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    const { bucketName, objectName } = parseObjectPath(storageKey);
    await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn("[CV Lead] temporary file cleanup failed", error instanceof Error ? error.message : "unknown error");
  }
}

async function cleanupExpired(): Promise<void> {
  try {
    await neonSql.query(`
      DELETE FROM cv_lead_public_quotas WHERE quota_key IN (
        SELECT quota_key FROM cv_lead_public_quotas WHERE expires_at <= now()
        ORDER BY expires_at LIMIT 500
      ) AND expires_at <= now()
    `);
    const rows = resultRows(await neonSql.query(
        `DELETE FROM cv_lead_analyses
         WHERE id IN (
           SELECT id FROM cv_lead_analyses
           WHERE expires_at <= now() AND claimed_user_id IS NULL
           ORDER BY expires_at LIMIT 50
         )
         RETURNING storage_key`,
    ) as any);
    for (const row of rows) await deleteStoredFile(row.storage_key);
  } catch (error) {
    console.warn("[CV Lead] expired report cleanup failed", error instanceof Error ? error.message : "unknown error");
  }
}

export async function initializeCvLeadRoutes(): Promise<void> {
  await ensureSchema();
  void cleanupExpired();
}

export async function resolveDiagnosticFile(userId: string, documentId?: string): Promise<DiagnosticFile> {
  if (documentId !== undefined) {
    const doc = await storage.getCvDocumentForUser(userId, documentId);
    if (!doc) throw new Error("CV introuvable ou inaccessible.");
    const { bucketName, objectName } = parseObjectPath(doc.storageKey);
    const [buffer] = await objectStorageClient.bucket(bucketName).file(objectName).download();
    return { buffer, fileName: doc.originalFilename, mimeType: doc.mimeType, documentId: doc.id, storageKey: doc.storageKey };
  }
  await recoverLegacyLibraryCv(userId);
  const primary = await storage.getPrimaryCvDocument(userId);
  if (primary) return resolveDiagnosticFile(userId, primary.id);
  throw new Error("Aucun CV de référence enregistré dans votre bibliothèque.");
}

export const cvDiagnostic = createCvDiagnostic({
  commercialReason: error => error instanceof PaywallError && error.reason === "cvAnalyses" ? error.reason : undefined,
  admit: async (userId, key) => {
    const reservation = await reserveAnalysis(userId,key,"cvAnalyses");
    if (!reservation) throw new PaywallError("busy","Cette analyse est déjà terminée. Actualisez le rapport.");
    const stop = heartbeatAnalysis(reservation);
    return async success => { stop(); await settleAnalysis(reservation,success); };
  },
  query: readReportRows,
  resolve: resolveDiagnosticFile,
  reuse: async (userId, file, reportId) => {
    if (!file.documentId || !file.storageKey) return;
    const doc = await storage.getCvDocumentForUser(userId, file.documentId);
    if (!doc || doc.storageKey !== file.storageKey || doc.parseStatus === "completed") return;
    const [report] = await readReportRows(
      `SELECT parsed_cv_data FROM cv_lead_analyses WHERE id=$1 AND claimed_user_id=$2`,
      [reportId, userId]);
    await finishLibraryExtraction(userId, file.documentId, file.storageKey, report?.parsed_cv_data);
  },
  failed: async (userId, file) => {
    if (file.documentId && file.storageKey) {
      const doc = await storage.getCvDocumentForUser(userId, file.documentId);
      if (doc?.parseStatus !== "completed") await finishLibraryExtraction(userId, file.documentId, file.storageKey, null);
    }
  },
  legacy: async (userId, file, hash) => {
    const candidates = await readReportRows(
      `SELECT id::text AS id, report->>'overallScore' AS score, storage_key
       FROM cv_lead_analyses WHERE claimed_user_id = $1 AND content_hash IS NULL
         AND (original_filename = $2 OR cv_document_id = $3)
       ORDER BY created_at DESC LIMIT 20`,
      [userId, file.fileName, file.documentId ?? null],
    );
    for (const candidate of candidates) {
      let contents: Buffer;
      try {
        const { bucketName, objectName } = parseObjectPath(candidate.storage_key);
        [contents] = await objectStorageClient.bucket(bucketName).file(objectName).download();
      } catch { continue; }
      if (!privateReportCvMatches(file.buffer, contents)) continue;
      await neonSql.query(
        `UPDATE cv_lead_analyses SET content_hash = $3
         WHERE id = $1 AND claimed_user_id = $2 AND content_hash IS NULL`,
        [candidate.id, userId, hash],
      );
      return { id: candidate.id, score: Number(candidate.score) };
    }
    return null;
  },
  run: async (userId, file, contentHash) => {
    if (file.mimeType === "application/msword") {
      throw new CvDiagnosticFailure("Le format DOC n’est pas pris en charge. Convertissez ce CV en PDF, DOCX ou TXT, puis remplacez le fichier.");
    }
    if (!file.buffer.length || file.buffer.length > MAX_FILE_SIZE || !detectCvMimeType(file.buffer, file.mimeType)) {
      throw new CvDiagnosticFailure("Ce fichier est vide, trop volumineux ou illisible. Votre CV reste enregistré.");
    }
    const token = await acquireProfileAnalysisLease(userId);
    if (!token) throw new CvDiagnosticFailure("Une autre analyse est en cours. Votre CV est enregistré ; réessayez dans une minute.");
    const heartbeat = setInterval(() => {
      void neonSql.query(
        `UPDATE cv_lead_profile_analysis_locks SET locked_at = now() WHERE user_id = $1 AND owner_token = $2`,
        [userId, token],
      ).catch(() => {});
    }, 30_000);
    heartbeat.unref();
    try {
      let result: any;
      const sourceDocument = file.documentId ? await storage.getCvDocumentForUser(userId, file.documentId) : null;
      let status = 200;
      const response = {
        status(code: number) { status = code; return this; },
        json(value: any) { result = value; return this; },
      };
      await analyze({
        file: { buffer: file.buffer, size: file.buffer.length, mimetype: file.mimeType, originalname: file.fileName },
        headers: {}, socket: {},
      }, response, { claimedUserId: userId, contentHash, fileName: file.fileName, documentId: file.documentId, storageKey: file.storageKey,
        parsedSnapshot: sourceDocument?.storageKey === file.storageKey && sourceDocument?.parseStatus === "completed" ? sourceDocument.parsedSnapshot : undefined });
      if (status >= 400 || !result?.id) throw new CvDiagnosticFailure(result?.error || "Analyse indisponible. Réessayez.");
      return { id: result.id as string, score: result.score as number };
    } finally {
      clearInterval(heartbeat);
      await releaseProfileAnalysisLease(userId, token);
    }
  },
});

/** Persistence has succeeded before this is called; errors must not undo upload. */
export async function startAutomaticCvDiagnostic(userId: string, documentId?: string, file?: DiagnosticFile) {
  try {
    await ensureSchema();
    const resolved = file ?? await resolveDiagnosticFile(userId, documentId);
    const diagnostic = await cvDiagnostic.startFile(userId, resolved, true);
    if (diagnostic.status === "blocked" && resolved.documentId && resolved.storageKey) {
      // Extraction is not a scored analysis. Preserve the library's editable
      // content when commercial admission refuses the automatic diagnostic.
      const doc = await storage.getCvDocumentForUser(userId,resolved.documentId);
      if (doc && doc.parseStatus !== "completed") {
        // Admission is awaited before startFile returns, even in background
        // mode. Finish the independent extraction before returning the refusal
        // so the saved library record is immediately editable, not pending.
        await (async () => {
          let snapshot: any = null;
          try { snapshot = await parseStructuredCv(resolved.buffer,resolved.mimeType); } catch { /* Separate extraction state. */ }
          await finishLibraryExtraction(userId,doc.id,resolved.storageKey!,snapshot);
        })().catch(() => { console.warn("[CV Lead] independent extraction could not be saved"); });
      }
    }
    return diagnostic;
  } catch {
    // An outage before a durable claim remains visible as absent, with a manual
    // start action. Never retry paid work in a background loop.
    console.warn("[CV Lead] automatic diagnostic could not start");
    if (documentId) {
      const doc = await storage.getCvDocumentForUser(userId, documentId).catch(() => undefined);
      if (doc && doc.parseStatus !== "completed") await finishLibraryExtraction(userId, doc.id, doc.storageKey, null).catch(() => {});
    }
    return { status: "failed" as const, error: "CV enregistré. Analyse indisponible ; relancez-la depuis Scores." };
  }
}

export function registerCvLeadRoutes(app: Express): void {
  // Extraction retries never call the scoring engine or retry a paid report.
  app.post("/api/profile/cvs/:id/extract", isAuthenticated, async (req, res) => {
    try {
    const userId = getUserId(req)!;
    await ensureSchema();
    const doc = await storage.getCvDocumentForUser(userId, req.params.id);
    if (!doc) return res.status(404).json({ error: "CV introuvable ou inaccessible." });
    const claimed = await db.update(userCvDocuments).set({
      parseStatus: "processing", parseError: null, lastParsedAt: new Date(),
    }).where(and(eq(userCvDocuments.id, doc.id), eq(userCvDocuments.userId, userId), eq(userCvDocuments.storageKey, doc.storageKey),
      sql`(${userCvDocuments.parseStatus} = 'failed' OR
        COALESCE(${userCvDocuments.lastParsedAt}, ${userCvDocuments.uploadedAt}) < now() - interval '5 minutes')`
    )).returning();
    if (!claimed.length) return res.status(202).json({ status: "processing" });
    try {
      const file = await resolveDiagnosticFile(userId, doc.id);
      if (file.storageKey !== doc.storageKey) return res.status(409).json({ error: "Le fichier a été remplacé. Actualisez la bibliothèque." });
      const snapshot = await parseStructuredCv(file.buffer, file.mimeType);
      await finishLibraryExtraction(userId, doc.id, file.storageKey!, snapshot);
      res.json(await storage.getCvDocumentForUser(userId, doc.id));
    } catch {
      await finishLibraryExtraction(userId, doc.id, doc.storageKey, null);
      res.status(422).json({ error: "Extraction impossible. Vous pouvez réessayer." });
    }
    } catch {
      res.status(503).json({ error: "Extraction indisponible. Réessayez plus tard." });
    }
  });
  app.get("/api/cv-lead/documents/diagnostics", isAuthenticated, async (req, res) => {
    try {
      await ensureSchema();
      const userId = getUserId(req)!;
      // Library reads never start work or download every private file. Storage
      // keys are immutable upload versions, not labels editable by the user.
      const rows = await readReportRows(
        `SELECT d.id, r.id::text AS report_id, r.report->>'overallScore' AS score,
          j.status, j.error,
          CASE WHEN j.updated_at < now() - interval '5 minutes' THEN 'expired' ELSE 'active' END AS lease
         FROM user_cv_documents d
         LEFT JOIN LATERAL (
           SELECT a.id, a.report FROM cv_lead_analyses a
           WHERE a.claimed_user_id = d.user_id AND (
             (a.storage_key = d.storage_key AND a.cv_document_id = d.id)
             OR EXISTS (SELECT 1 FROM cv_document_diagnostics linked
               WHERE linked.user_id = d.user_id
                 AND linked.scope = 'document:' || d.id || ':' || d.storage_key
                 AND linked.content_hash = a.content_hash)
           ) ORDER BY a.created_at DESC LIMIT 1
         ) r ON true
         LEFT JOIN LATERAL (
           SELECT status, error, updated_at FROM cv_document_diagnostics
           WHERE user_id = d.user_id AND scope = 'document:' || d.id || ':' || d.storage_key
           ORDER BY updated_at DESC LIMIT 1
         ) j ON true WHERE d.user_id = $1`,
        [userId],
      );
      res.json(Object.fromEntries(rows.map(row => [row.id, row.report_id
        ? { status: "completed", id: row.report_id, score: row.score == null ? null : Number(row.score) }
        : row.status === "processing" && row.lease === "active" ? { status: "processing" }
        : row.status === "blocked" ? {status:"blocked",reason:"cvAnalyses"}
        : row.status ? { status: "failed", error: row.error || "Analyse interrompue. Réessayez." }
        : { status: "absent" }])));
    } catch {
      res.status(503).json({ error: "Impossible de charger les diagnostics." });
    }
  });
  for (const endpoint of ["/api/cv-lead/profile/diagnostic", "/api/cv-lead/documents/:documentId/diagnostic"]) {
    app.get(endpoint, isAuthenticated, async (req, res) => {
      try {
        await ensureSchema();
        res.json(await cvDiagnostic.read(getUserId(req)!, req.params.documentId));
      } catch {
        res.status(404).json({ error: "Diagnostic indisponible ou CV inaccessible." });
      }
    });
    app.post(endpoint, isAuthenticated, async (req, res) => {
      try {
        await ensureSchema();
        const diagnostic = await cvDiagnostic.start(getUserId(req)!, req.params.documentId);
        if (diagnostic.status === "blocked") return res.status(402).json({error:"paywall_required",reason:"cvAnalyses",diagnostic});
        res.json(diagnostic);
      } catch (error) {
        if (analysisErrorResponse(res,error)) return;
        res.status(503).json({ error: "Diagnostic indisponible ou CV inaccessible." });
      }
    });
  }
  app.post("/api/public/cv-lead/analyze", async (req, res) => {
    let release: (() => void) | null = null;
    res.locals.leadRequestId = crypto.randomUUID();
    try {
      try { await ensureSchema(); } catch { publicCvAdmission.reject(res, "quota_unavailable"); return; }
      release = await publicCvAdmission.acquire(req, res);
      if (!release) return;
      await new Promise<void>((resolve, reject) => {
        upload.single("cv")(req, res, (error) => {
          if (error) {
            res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Fichier CV invalide ou trop volumineux." });
            resolve();
            return;
          }
          // Do not consume the shared paid-work budget for invalid uploads.
          if (!req.file) {
            res.status(400).json({ error: "Veuillez joindre votre CV." });
            resolve();
            return;
          }
          if (!detectCvMimeType(req.file.buffer, req.file.mimetype)) {
            res.status(415).json({ error: "Le type réel du fichier ne correspond pas à son extension." });
            resolve();
            return;
          }
          void (async () => {
            const userId = req.isAuthenticated?.() ? getUserId(req) : null;
            if (userId) {
              const reused = await readReportRows("SELECT id FROM cv_lead_analyses WHERE claimed_user_id=$1 AND content_hash=$2 LIMIT 1",
                [userId,hashCvContents(req.file!.buffer)]);
              if (!reused.length && !await publicCvAdmission.admitPaidWork(res)) return;
              const diagnostic = await cvDiagnostic.startFile(userId,{
                buffer:req.file!.buffer, fileName:req.file!.originalname, mimeType:req.file!.mimetype,
              });
              if (diagnostic.status === "blocked") { res.status(402).json({error:"paywall_required",reason:"cvAnalyses"}); return; }
              if (diagnostic.status !== "completed") { res.status(503).json({error:"Analyse indisponible. Réessayez."}); return; }
              const [saved] = await readReportRows("SELECT report,expires_at FROM cv_lead_analyses WHERE id=$1 AND claimed_user_id=$2",[diagnostic.id,userId]);
              res.status(201).json({pendingAnalysisId:diagnostic.id,expiresAt:saved.expires_at,preview:publicPreview(saved.report)});
              return;
            }
            const releaseCapacity = await analysisCapacity.acquire(true);
            if (!releaseCapacity) {
              publicCvAdmission.reject(res, "capacity", 60, MAX_PUBLIC_CONCURRENT);
              return;
            }
            try {
              if (req.aborted || res.destroyed) return;
              if (await publicCvAdmission.admitPaidWork(res)) await analyze(req, res, undefined, { requestId: res.locals.leadRequestId, startedAt: Date.now() }, true);
            } finally { releaseCapacity(); }
          })().then(resolve, reject);
        });
      });
    } catch (error) {
      // Quota outages must never fall through to paid AI.
      if (analysisErrorResponse(res,error)) return;
      if (!res.headersSent) res.status(503).json({ error: "Le service d’analyse est temporairement indisponible. Réessayez dans quelques instants." });
    } finally {
      // Keep the slot until work ends, even if the client disconnects early.
      release?.();
    }
  });

  app.post("/api/cv-lead/analyze-profile", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    // Compatibility endpoint: all authenticated starts use the durable common
    // coordinator, including older dashboard/Agent clients.
    const diagnostic = await startAutomaticCvDiagnostic(userId);
    if (diagnostic.status === "blocked") return res.status(402).json({error:"paywall_required",reason:"cvAnalyses",diagnostic});
    return res.status(diagnostic.status === "failed" ? 503 : 200).json(diagnostic);
  });

  app.post("/api/public/cv-lead/:id/signup-seed", async (req, res) => {
    try {
      await ensureSchema();
      const rows = await readReportRows(
        `SELECT storage_key, original_filename, mime_type, parsed_cv_data
         FROM cv_lead_analyses
         WHERE id = $1
           AND ip_hash = $2
           AND expires_at > now()
           AND claimed_user_id IS NULL`,
        [req.params.id, ipHash(req)],
      );
      const row = rows[0];
      if (!row?.parsed_cv_data) {
        return res.status(404).json({ error: "Les données préparées pour cette analyse sont introuvables." });
      }
      const { bucketName, objectName } = parseObjectPath(row.storage_key);
      const [contents] = await objectStorageClient.bucket(bucketName).file(objectName).download();
      res.json({
        data: row.parsed_cv_data,
        file: {
          name: row.original_filename,
          content: contents.toString("base64"),
          mimeType: row.mime_type,
        },
      });
    } catch (error) {
      console.error("[CV Lead] signup seed failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Impossible de préparer l’inscription." });
    }
  });

  app.post("/api/cv-lead/:id/claim", isAuthenticated, async (req: any, res) => {
    const client = await pool.connect().catch(() => null);
    if (!client) return res.status(503).json({ error: "Impossible de récupérer cette analyse pour le moment." });
    try {
      await ensureSchema();
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      await client.query("BEGIN");
      const result = await client.query(
         `SELECT report, expires_at, storage_key, original_filename, mime_type, file_size, parsed_cv_data,
                 content_hash, claimed_user_id, cv_document_id
         FROM cv_lead_analyses
         WHERE id = $1::uuid
           AND (claimed_user_id IS NULL OR claimed_user_id = $2::varchar)
           AND (expires_at > now() OR claimed_user_id = $2::varchar)
         FOR UPDATE`,
        [req.params.id, userId],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Analyse introuvable, expirée ou déjà réclamée." });
      }
      if (!row.content_hash) {
        const { bucketName, objectName } = parseObjectPath(row.storage_key);
        const [privateCv] = await objectStorageClient.bucket(bucketName).file(objectName).download();
        row.content_hash = claimReportContentHash(row.content_hash, privateCv);
        await client.query(
          `UPDATE cv_lead_analyses
           SET content_hash = COALESCE(content_hash, $2)
           WHERE id = $1::uuid`,
          [req.params.id, row.content_hash],
        );
      }
      let cvDocumentId = row.cv_document_id as string | null;
      if (!cvDocumentId) {
        const existingDocument = await client.query(
          `SELECT id FROM user_cv_documents WHERE user_id = $1::varchar AND storage_key = $2::varchar LIMIT 1`,
          [userId, row.storage_key],
        );
        cvDocumentId = existingDocument.rows[0]?.id || null;
      }
      if (!cvDocumentId) {
        const label = row.original_filename?.replace(/\.[^.]+$/, "") || "CV importé";
        const insertedDocument = await client.query(
          `INSERT INTO user_cv_documents
             (user_id, label, storage_key, original_filename, mime_type, file_size, is_primary,
              parse_status, parsed_snapshot, last_parsed_at)
           VALUES
             ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::integer,
              NOT EXISTS (SELECT 1 FROM user_cv_documents WHERE user_id = $1::varchar),
               CASE
                 WHEN $7::jsonb IS NULL THEN 'pending'::cv_parse_status
                 ELSE 'completed'::cv_parse_status
               END,
               $7::jsonb,
               CASE WHEN $7::jsonb IS NULL THEN NULL ELSE now() END)
           RETURNING id`,
          [
            userId,
            label,
            row.storage_key,
            row.original_filename || "CV importé",
            row.mime_type,
            row.file_size,
            row.parsed_cv_data ? JSON.stringify(row.parsed_cv_data) : null,
          ],
        );
        cvDocumentId = insertedDocument.rows[0].id;
      } else if (row.parsed_cv_data) {
        await client.query(
          `UPDATE user_cv_documents
           SET parse_status = 'completed',
               parsed_snapshot = $2::jsonb,
               last_parsed_at = COALESCE(last_parsed_at, now())
           WHERE id = $1`,
          [cvDocumentId, JSON.stringify(row.parsed_cv_data)],
        );
      }
      await client.query(
        `UPDATE cv_lead_analyses
         SET claimed_user_id = $2,
             claimed_at = COALESCE(claimed_at, now()),
             cv_document_id = $3
         WHERE id = $1::uuid`,
        [req.params.id, userId, cvDocumentId],
      );
      await client.query("COMMIT");
      res.json({ report: row.report, expiresAt: row.expires_at, cvDocumentId });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[CV Lead] claim failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Impossible de récupérer cette analyse." });
    } finally {
      client.release();
    }
  });

  app.get("/api/cv-lead/latest", isAuthenticated, async (req: any, res) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    let stage = "schema-init";
    try {
      await ensureSchema();
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const filename = typeof req.query.filename === "string" ? req.query.filename : "";
      if (!filename) return res.status(400).json({ error: "Nom du CV manquant." });
      stage = "profile-load";
      const user = await storage.getUserById(userId);
      const currentFileName = user?.cvFileName;
      if (!user?.cvFileContent || !currentFileName || currentFileName !== filename) return res.json(null);
      const currentCv = Buffer.from(user.cvFileContent, "base64");
      if (!currentCv.length) return res.json(null);
      const contentHash = hashCvContents(currentCv);

      stage = "latest-report-lookup";
      const exactMatch = (await readReportRows(
        `SELECT id::text AS id, report->>'overallScore' AS score, content_hash
         FROM cv_lead_analyses
         WHERE claimed_user_id = $1
           AND original_filename = $2
           AND content_hash = $3
         ORDER BY claimed_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [userId, filename, contentHash],
      ))[0];
      if (exactMatch?.id && profileCvReportMatches(currentFileName, filename, contentHash, exactMatch.content_hash)) {
        return res.json({ id: exactMatch.id, score: exactMatch.score === null ? null : Number(exactMatch.score) });
      }

      // Older claimed reports predate content_hash. Reuse one only after
      // comparing its private stored file with the current profile CV bytes;
      // a filename alone must never select a stale score after replacement.
      stage = "legacy-report-lookup";
      const legacyMatches = await readReportRows(
        `SELECT id::text AS id, report->>'overallScore' AS score, storage_key
         FROM cv_lead_analyses
         WHERE claimed_user_id = $1
           AND original_filename = $2
           AND content_hash IS NULL
         ORDER BY claimed_at DESC NULLS LAST, created_at DESC
         LIMIT 20`,
        [userId, filename],
      );
      for (const legacyMatch of legacyMatches) {
        if (!legacyMatch?.id || !legacyMatch.storage_key) continue;
        stage = "legacy-file-lookup";
        const { bucketName, objectName } = parseObjectPath(legacyMatch.storage_key);
        const [legacyCv] = await objectStorageClient.bucket(bucketName).file(objectName).download();
        if (privateReportCvMatches(currentCv, legacyCv)) {
          return res.json({
            id: legacyMatch.id,
            score: legacyMatch.score === null ? null : Number(legacyMatch.score),
          });
        }
      }
      res.json(null);
    } catch (error) {
      console.error("[CV Lead] latest report failed", cvAnalysisFailureDetails(error, {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        httpStatus: 500,
      }));
      res.status(500).json({ error: "Impossible de retrouver l’analyse du CV." });
    }
  });

  app.get("/api/cv-lead/:id", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSchema();
      const userId = getUserId(req);
      const result = await readReportRows(
        `SELECT report, expires_at FROM cv_lead_analyses WHERE id = $1 AND claimed_user_id = $2`,
        [req.params.id, userId],
      );
      const row = result[0];
      if (!row) return res.status(404).json({ error: "Analyse introuvable." });
      res.json({ report: row.report, expiresAt: row.expires_at });
    } catch (error) {
      console.error("[CV Lead] report failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Impossible de récupérer cette analyse." });
    }
  });
}

async function analyze(
  req: any,
  res: any,
  profileAnalysis?: { claimedUserId: string; contentHash: string; fileName: string; documentId?: string; storageKey?: string; parsedSnapshot?: any },
  diagnostics: { requestId: string; startedAt: number } = { requestId: crypto.randomUUID(), startedAt: Date.now() },
  capacityReserved = false,
): Promise<void> {
  const releaseCapacity = capacityReserved ? () => {} : await analysisCapacity.acquire(!profileAnalysis);
  if (!releaseCapacity) {
    res.locals.leadRequestId = diagnostics.requestId;
    publicCvAdmission.reject(res, "capacity", 60, MAX_CONCURRENT);
    return;
  }
  let storageKey: string | null = null;
  let stage = "schema-init";
  try {
    await ensureSchema();
    stage = "validate-file";
    if (!req.file) return res.status(400).json({ error: "Veuillez joindre votre CV." });
    const mime = detectCvMimeType(req.file.buffer, req.file.mimetype);
    if (!mime) return res.status(415).json({ error: "Le type réel du fichier ne correspond pas à son extension." });
    const contentHash = hashCvContents(req.file.buffer);
    if (profileAnalysis && profileAnalysis.contentHash !== contentHash) {
      throw new Error("The profile CV changed before its analysis started");
    }
    const id = opaqueId();
    stage = "store-file";
    // PRIVATE_OBJECT_DIR may still point at a bucket inherited from a fork and
    // therefore be read-only. CMS_ASSETS_BUCKET_ID is this repl's writable
    // bucket; keep lead files private by storing them under .private/.
    const writableBucketId = process.env.CMS_ASSETS_BUCKET_ID || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!writableBucketId) throw new Error("Writable object storage is not configured");
    storageKey = `/${writableBucketId}/.private/cv-lead/${id}`;
    const { bucketName, objectName } = parseObjectPath(storageKey);
    await objectStorageClient.bucket(bucketName).file(objectName).save(req.file.buffer, { contentType: mime, resumable: false });

    stage = "extract-text";
    const isImage = mime.startsWith("image/");
    const visionMime = mime === "image/heic" || mime === "image/heif" ? "image/jpeg" : mime;
    const source = isImage
      ? [{ type: "text", text: "Analyse ce CV image. Réponds uniquement en JSON selon le schéma demandé." }, { type: "image_url", image_url: { url: `data:${visionMime};base64,${req.file.buffer.toString("base64")}` } }]
      : [{ type: "text", text: req.file.mimetype === "application/pdf" ? await extractText(req.file.buffer, mime) : (await extractText(req.file.buffer, mime)).slice(0, 30000) }];
    // Authenticated dashboard users already have their CV parsed during the
    // profile upload. Do not invoke the profile parser (or its paid fallback)
    // a second time just to create a score; the detailed lead analysis is the
    // same analysis used for the free CV diagnostic.
    stage = "score-and-parse";
    const [scoring, parsing] = await Promise.allSettled([
      analyzeDetailedReport(source, isImage),
      profileAnalysis
        ? profileAnalysis.documentId
          ? profileAnalysis.parsedSnapshot
            ? Promise.resolve(profileAnalysis.parsedSnapshot)
            : parseStructuredCv(req.file.buffer, mime).catch(() => null)
          : Promise.resolve(null)
        : parseStructuredCv(req.file.buffer, mime),
    ] as const);
    if (profileAnalysis?.documentId) {
      // Extraction and scoring have independent outcomes. Even a score failure
      // must retain a successfully extracted CV for the agent.
      await finishLibraryExtraction(profileAnalysis.claimedUserId, profileAnalysis.documentId, profileAnalysis.storageKey!,
        parsing.status === "fulfilled" ? parsing.value : null);
    }
    if (scoring.status === "rejected") throw scoring.reason;
    if (parsing.status === "rejected") throw parsing.reason;
    const report = scoring.value;
    const parsedCvData = parsing.value;
    const expiresAt = new Date(Date.now() + REPORT_TTL_MS);
    const claimedAt = profileAnalysis ? new Date() : null;
    stage = "persist-report";
    await neonSql.query(
      `INSERT INTO cv_lead_analyses
         (id, ip_hash, storage_key, original_filename, mime_type, file_size, report, parsed_cv_data, expires_at,
          content_hash, claimed_user_id, claimed_at, cv_document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        id,
        ipHash(req),
        profileAnalysis?.storageKey ?? storageKey,
        req.file.originalname,
        mime,
        req.file.size,
        JSON.stringify(report),
        JSON.stringify(parsedCvData),
        expiresAt.toISOString(),
        contentHash,
        profileAnalysis?.claimedUserId ?? null,
        claimedAt?.toISOString() ?? null,
        profileAnalysis?.documentId ?? null,
      ],
    );
    if (profileAnalysis) {
      stage = "cleanup-file";
      await deleteStoredFile(storageKey);
      storageKey = null;
      res.status(201).json({ id, score: report.overallScore, fileName: profileAnalysis.fileName });
    } else {
      storageKey = null;
      res.status(201).json({ pendingAnalysisId: id, expiresAt: expiresAt.toISOString(), preview: publicPreview(report) });
      void cleanupExpired();
    }
  } catch (error) {
    console.error("[CV Lead] analysis failed", cvAnalysisFailureDetails(error, {
      requestId: diagnostics.requestId,
      stage,
      elapsedMs: Date.now() - diagnostics.startedAt,
      httpStatus: error instanceof CvLeadOutputError ? 502 : 503,
    }));
    if (storageKey) await deleteStoredFile(storageKey);
    if (error instanceof CvLeadOutputError) {
      return res.status(502).json({ error: error.message });
    }
    res.status(503).json({ error: "Le service d’analyse est temporairement indisponible. Réessayez dans quelques instants." });
  } finally {
    releaseCapacity();
  }
}

const analysisCapacity = createAnalysisCapacity(MAX_CONCURRENT, MAX_PUBLIC_CONCURRENT, configuredLimit("CV_LEAD_CAPACITY_WAIT_MS", 20_000));
