import { respondIfApecPaused } from "./services/apecAccessPolicy";
import { isInternalAnalyticsUser } from "./lib/internalAnalyticsUser";
import { isPreviewAnalyticsRequest } from "./lib/analyticsOrigin";
import { registerEmailPreferenceAnalyticsRoutes } from "./routes/emailPreferenceAnalyticsRoutes";
import { registerSitemapFamilies, getSitemapFamilies, FAMILY_PAGE_SIZE } from "./seo/sitemapFamilies";
import { createSitemapIndexSnapshot } from "./seo/sitemapIndexSnapshot";
import { registerUserJourneyRoutes } from "./routes/userJourneyRoutes";
import { registerDiscoveryRoutes } from "./routes/discoveryRoutes";
import { registerModuleFeedbackRoutes } from "./routes/moduleFeedbackRoutes";
import { registerEmploymentAdminRoutes } from "./routes/employmentAdminRoutes";
import { registerGoogleReviewsRoutes } from "./routes/googleReviewsRoutes";
import { registerAdminUserDeletionRoute } from "./routes/adminUserDeletion";
import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { classifyWatchdogRun } from "./services/syncWatchdogRun";
import { readSourceObservation } from "./services/sourceSyncObservationService";
import { request as httpsRequest } from "https";
import { randomUUID } from "crypto";
import DOMPurify from "isomorphic-dompurify";
import { buildSeoHtml } from "./seo-prerender";
import { cvAnalysisInitialHtml } from "./cvAnalysisSeoHtml";
import { linkedinAnalysisInitialHtml } from "./linkedinAnalysisSeoHtml";
import { salaryEstimateInitialHtml } from "./salaryEstimateSeoHtml";
import { PUBLIC_PAGE_META, PUBLIC_SITEMAP_PAGES, PUBLIC_IMAGE_SITEMAP_PAGES } from "@shared/serverPublicPages";
import { promises as dnsPromises } from "dns";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { AI_MODELS } from './ai/models';
import { buildCvCoachSystemPrompt } from "./prompts/cvCoachPrompt";
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { buildDocument } from './ssr/document';
import { MetiersHubSSR } from './ssr/components';
import { storage } from "./storage";
import { db, pool, httpDb, httpSelectSafe } from "./db";
import { sql, inArray, eq, and, count, gte, lt, isNotNull, desc, asc, or } from "drizzle-orm";
import { users, nudges, inAppNotifications, modules as modulesTable, classes as classesTable, masterclasses as masterclassesTable, moduleRatings, userLearningProgress as userLearningProgressTable, cvTemplates, cvGeneratedDocuments, userLearningArtifacts, profileArtifactSlots, learningInputs, globalJobPool, emailTemplateOverrides, jobOpportunities, applications as applicationsTable, helpSections, helpSubsections, helpArticles, cmsAssets } from "@shared/schema";
import { 
  insertUserProgressSchema,
  insertBadgeSchema,
  insertBounceActivitySchema,
  insertJobOpportunitySchema,
  insertApplicationSchema,
  insertNudgeSchema,
  insertMasterclassSchema,
  insertClassSchema,
  insertModuleSchema,
  insertModuleAssetSchema,
  insertUserSubmissionSchema,
  insertModuleProgressSchema,
  insertContactSchema,
  insertInterviewSchema,
  insertActionSchema,
  insertOnboardingScreenSchema,
  updateOnboardingScreenSchema,
  insertOffboardingScreenSchema,
  updateOffboardingScreenSchema,
  bloomStages,
  type Contact,
  insertMessageTemplateSchema,
  insertAutomationWorkflowSchema,
  insertWorkflowActionSchema,
  insertUserProgramSchema,
  insertProgramRecommendationRuleSchema,
  insertLearningInputSchema,
  updateLearningInputSchema,
  insertProfileArtifactSlotSchema,
  insertLearningInputProfileMapSchema,
  insertUserLearningArtifactSchema,
  insertModuleRatingSchema,
  insertBlogCategorySchema,
  insertBlogPostSchema,
  insertCompanySchema,
  companyTypeLabels,
  companySizeLabels,
  companyStatusLabels,
  STARTUP_CHECKLIST_ITEMS,
  type StartupChecklistItemId,
  insertMentorInviteSchema,
  insertMentorProfileSchema,
  insertMentorRelationshipSchema,
  insertMentorMessageSchema,
  insertMentorNoteSchema,
  insertMentoringSessionSchema,
  voiceChatAnalysisResultSchema,
  blockAnalysisConfigSchema,
  type BlockAnalysisOutputField,
  type User,
} from "@shared/schema";
import { requireAdmin } from "./middleware";
import { registerAdminAnalyticsRoutes } from "./routes/adminAnalyticsRoutes";
import { registerBootcampRoutes } from "./routes/bootcampRoutes";
import { registerActivationRoutes } from "./routes/activationRoutes";
import { registerAiLogsRoutes } from "./routes/aiLogsRoutes";
import { registerStripeRoutes } from "./routes/stripeRoutes";
import { registerPaywallRoutes } from "./routes/paywallRoutes";
import { projectAdminTestPersona } from "./services/adminPlanTestService";
import { registerNotificationsRoutes } from "./routes/notificationsRoutes";
import { registerContactsRoutes } from "./routes/contactsRoutes";
import { registerCommunityRoutes } from "./routes/communityRoutes";
import { registerCandidatureAiRoutes } from "./routes/candidatureAiRoutes";
import { registerMicrolearningRoutes } from "./routes/microlearningRoutes";
import { registerInterviewRoutes } from "./routes/interviewRoutes";
import { registerOnboardingRoutes } from "./routes/onboardingRoutes";
import { registerAiCoachingRoutes } from "./routes/aiCoachingRoutes";
import { registerRebondIaV2Routes } from "./routes/rebondIaV2Routes";
import { registerBlogRoutes } from "./routes/blogRoutes";
import { registerPressRoutes } from "./routes/pressRoutes";
import { registerJobPoolRoutes } from "./routes/jobPoolRoutes";
import { registerApplicationRoutes } from "./routes/applicationRoutes";
import { registerExtensionJobRoutes } from "./routes/extensionJobRoutes";
import { createChromeApplication } from "./services/chromeApplicationSaveService";
import { registerCvStudioRoutes } from "./routes/cvStudioRoutes";
import { initializeCvLeadRoutes, registerCvLeadRoutes } from "./routes/cvLeadRoutes";
import { initializeLinkedinLeadRoutes, registerLinkedinLeadRoutes } from "./routes/linkedinLeadRoutes";
import { initializeSalaryLeadRoutes, registerSalaryLeadRoutes } from "./routes/salaryLeadRoutes";
import { initializeRiasecLeadRoutes, registerRiasecLeadRoutes } from "./routes/riasecLeadRoutes";
import { riasecTestInitialHtml } from "./riasecTestSeoHtml";
import { registerReferralRoutes } from "./routes/referralRoutes";
import { FT_STOCK_MAX_DAYS, ftStockDays, retiredFtHistory } from './routes/franceTravailMaintenance';
import { ensureReferralSchema, attachAttribution } from "./services/referralService";
import { registerAutomationAdminRoutes } from "./routes/automationAdminRoutes";
import { tryAutoComplete as tryAutoCompleteBootcamp, tryAutoCompleteByModule as tryAutoCompleteBootcampByModule } from "./services/bootcampService";
import { buildCvProfileUpdates } from "./services/cvProfileImportPolicy";
import {
  createCvEnhancementPersistence,
  enhanceCvDocumentInBackground,
} from "./services/cvGenerationService";
import { setupSession, isAuthenticated, getUserId } from "./auth/session";
import { requireUser, handleRouteError, safePercent, CACHE } from "./lib/routeHelpers";
import { buildUserProfileContext } from "./utils/userProfileContext";
import {
  BOUNCE_LEVELS,
  DEFAULT_MATCH_SCORE,
  MAX_PROFILE_IMAGE_BYTES,
  NOREPLY_EMAIL,
  SENDER_ALERTS,
  SENDER_DEFAULT,
  SITEMAP_PAGE_SIZE,
} from "./lib/constants";
import { setupLinkedInAuth } from "./auth/linkedinAuth";
import { startupPhase } from "./startupPhase";
import { optionalStartupFeature } from "./startupLifecycle";
import { setupGoogleAuth } from "./auth/googleAuth";
import { setupLocalAuth } from "./auth/localAuth";
import { setupPasswordResetRoutes } from "./auth/passwordResetRoutes";
import { setupCheckinRoutes } from "./checkinRoutes";
import { parseCV, parseCVForProfileUpdate, parseCVFromPDF, parseCVFromImage, streamChatWithRebondIA, chatWithRebondIA, adaptCVToJob } from "./openai";
import { composeContext, invalidateLearningCache } from "./contextOrchestrator";
import { ObjectStorageService, ObjectNotFoundError, ObjectAclAccessDeniedError, objectStorageClient, signObjectURL, getSidecarGCSToken, parseObjectPath } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";
import { triggerWorkflow } from "./automation";
import { automationEventService } from "./services/automationEventService";
import multer from "multer";
import { z } from "zod";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
import { importCMSData } from "./migrate-cms-api";
import { exportElearningCMSData } from "./migrate-elearning-api";
import { csrfProtection, conditionalCsrfProtection, csrfErrorHandler } from "./auth/csrf";
import { jobAggregatorService } from "./services/jobAggregator";
import { jobMatchingService } from "./services/jobMatching";
import { emailTemplates, emailWrapper, heading, paragraph, greeting, button, smallText, list, alertBox, divider } from "./email/templates";
import { sendEmail } from "./resendService";
import { workflowTriggerService, invalidateOverrideCache, invalidateAutomationCache } from "./services/workflowTriggerService";
import { companyScrapeService } from "./services/companyScrapeService";
import { globalJobPoolService } from "./services/globalJobPoolService";
import { currentPoolOperation, ensureJobPoolJournal, journalPoolOperation, poolLimit, poolOutcome, transitionPoolJobs, withPoolTrigger } from "./services/jobPoolJournal";
import { scheduledOperation } from "./services/scheduledOperation";
import { batchComputeEmbeddings, checkEmbeddingCoverage, backfillEmbeddingsChunk, isEmbeddingBackfillRunning, isEmbeddingBackfillPaused, setEmbeddingBackfillPaused, setNightMode } from "./services/jobEmbeddingService";
import { syncHealthService } from "./services/syncHealthService";
import { sealNightlyEnrollment } from "./services/jobPoolNightlyCycle";
import { startNightlyCronParticipant } from "./routes/jobPoolNightlyStart";
import { poolError } from "./services/jobPoolJournal";
import { measureEmbeddingDrain } from "./services/jobEmbeddingService";
import { getCompanyNews } from "./services/googleNewsService";
import { companyEnrichmentService } from "./services/companyEnrichmentService";
import { iscoMappingService } from "./services/iscoMappingService";
import * as quizService from "./services/quizService";
import { schedulerService } from "./services/schedulerService";
import { aiAuditService } from "./ai/auditService";
import { cvAnalysisService } from "./services/cvAnalysisService";
import { CV_IMAGE_MIME_TYPES, getCvStorageExtension, resolveCvMimeType } from "./lib/cvFile";
import { startAutomaticCvDiagnostic } from "./routes/cvLeadRoutes";
import { importLibraryFile, recoverLegacyLibraryCv, finishLibraryExtraction } from "./services/cvLibrary";


// Helper function to calculate level based on total bounces
function calculateLevel(totalBounces: number): string {
  return BOUNCE_LEVELS.find((l) => totalBounces >= l.min)?.label ?? "Starting Jump";
}

async function autoImportSignupCv(userId: string): Promise<void> {
  try { await recoverLegacyLibraryCv(userId); } catch (err) {
    console.error(`[AutoImport] Échec import CV signup pour userId=${userId}:`, err);
  }
}

// Build a raw, no-AI prefill of a CV's generatedContent JSON from the user
// profile. Used when a CV document is created so the user sees actual content
// immediately while the (slower) AI enhancement runs in the background.
// Mirrors the JSON shape produced by /api/cv-studio/documents/:id/generate.
// Never throws — field-level failures are logged individually; callers always
// get a valid (possibly empty) object so the CV document is always created.
function buildRawCvPrefill(user: User): Record<string, unknown> {
  let experience: any[] = [];
  try {
    experience = (Array.isArray(user.workExperience) ? user.workExperience : []).map((exp: any, i: number) => {
      try {
        const start = exp?.startDate || '';
        const end = exp?.current ? 'Présent' : (exp?.endDate || '');
        const dates = [start, end].filter(Boolean).join(' - ');
        const desc = typeof exp?.description === 'string' ? exp.description : '';
        const achievements = desc
          .split(/\r?\n|•|\u2022/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        return {
          title: typeof exp?.title === 'string' ? exp.title : String(exp?.title ?? ''),
          company: typeof exp?.company === 'string' ? exp.company : String(exp?.company ?? ''),
          dates,
          achievements: achievements.length > 0 ? achievements : (desc ? [desc] : []),
        };
      } catch (expErr) {
        console.error(`[buildRawCvPrefill] workExperience[${i}] mapping failed:`, expErr, JSON.stringify(exp));
        return { title: '', company: '', dates: '', achievements: [] };
      }
    });
  } catch (err) {
    console.error('[buildRawCvPrefill] workExperience section failed:', err);
  }

  let education: any[] = [];
  try {
    education = (Array.isArray(user.education) ? user.education : []).map((edu: any, i: number) => {
      try {
        const start = edu?.startDate || '';
        const end = edu?.endDate || '';
        const dates = [start, end].filter(Boolean).join(' - ');
        return {
          degree: [edu?.degree, edu?.field].filter(Boolean).join(' — ') || edu?.degree || '',
          school: edu?.institution || edu?.school || '',
          dates,
        };
      } catch (eduErr) {
        console.error(`[buildRawCvPrefill] education[${i}] mapping failed:`, eduErr, JSON.stringify(edu));
        return { degree: '', school: '', dates: '' };
      }
    });
  } catch (err) {
    console.error('[buildRawCvPrefill] education section failed:', err);
  }

  let skillNames: string[] = [];
  try {
    const skills = Array.isArray(user.skills) ? user.skills : [];
    skillNames = skills
      .map((s: any) => (typeof s === 'string' ? s : s?.name))
      .filter((s: any) => typeof s === 'string' && s.length > 0);
  } catch (err) {
    console.error('[buildRawCvPrefill] skills section failed:', err);
  }

  let languageList: string[] = [];
  try {
    const languages = Array.isArray((user as any).languages) ? (user as any).languages : [];
    languageList = languages
      .map((l: any) => {
        if (typeof l === 'string') return l;
        const name = l?.name || l?.language;
        const level = l?.level || l?.cefr;
        return [name, level ? `(${level})` : ''].filter(Boolean).join(' ');
      })
      .filter((s: string) => typeof s === 'string' && s.length > 0);
  } catch (err) {
    console.error('[buildRawCvPrefill] languages section failed:', err);
  }

  let certifications: any[] = [];
  try {
    certifications = (Array.isArray(user.certifications) ? user.certifications : []).map((c: any, i: number) => {
      try {
        return {
          name: c?.name || '',
          issuer: c?.issuer || c?.organization || '',
          year: c?.year || c?.date || '',
        };
      } catch (certErr) {
        console.error(`[buildRawCvPrefill] certifications[${i}] mapping failed:`, certErr, JSON.stringify(c));
        return { name: '', issuer: '', year: '' };
      }
    });
  } catch (err) {
    console.error('[buildRawCvPrefill] certifications section failed:', err);
  }

  return {
    summary: typeof user.summary === 'string' ? user.summary : '',
    experience,
    education,
    skills: {
      technical: skillNames,
      soft: [],
      languages: languageList,
    },
    certifications,
    improvements: [],
    _prefillFromProfile: true,
  };
}

/** Minimal blank CV document content used as a fallback when buildRawCvPrefill fails. */
function buildBlankCvPrefill(): Record<string, unknown> {
  return {
    summary: '',
    experience: [],
    education: [],
    skills: { technical: [], soft: [], languages: [] },
    certifications: [],
    improvements: [],
    _prefillFromProfile: true,
    _prefillBlankFallback: true,
  };
}

// Helper function to create nudges based on events
async function createNudgeForEvent(userId: string, eventType: string, details?: any): Promise<void> {
  const nudgeMessages: Record<string, { message: string; subMessage: string; isPositive: boolean }> = {
    "first_application": {
      message: "Great job on your first jump!",
      subMessage: "You've taken the first step toward your next opportunity. Keep the momentum going!",
      isPositive: true,
    },
    "application_milestone_5": {
      message: "5 applications already! You're building serious momentum",
      subMessage: "Each application is a step closer to your ideal role. Your persistence is paying off!",
      isPositive: true,
    },
    "application_milestone_10": {
      message: "Double digits! 10 applications submitted",
      subMessage: "You're putting yourself out there consistently. This dedication will lead to results!",
      isPositive: true,
    },
    "interview_scheduled": {
      message: "Interview scheduled! Time to prepare",
      subMessage: "Your efforts are being noticed! Take time to research the company and practice your pitch.",
      isPositive: true,
    },
    "offer_received": {
      message: "You got an offer! Outstanding work!",
      subMessage: "All those bounces led to this moment. You've proven your value!",
      isPositive: true,
    },
    "rejection_received": {
      message: "One door closes, another opens",
      subMessage: "This isn't a reflection of your worth. Every 'no' gets you closer to the right 'yes'. Keep bouncing!",
      isPositive: false,
    },
    "no_activity_7_days": {
      message: "We miss your momentum!",
      subMessage: "It's been a week since your last bounce. Even small steps count—check out today's opportunities!",
      isPositive: false,
    },
    "no_activity_14_days": {
      message: "Your next opportunity is waiting",
      subMessage: "Two weeks without a bounce. Let's get back on track—start with one small action today!",
      isPositive: false,
    },
    "level_up": {
      message: `Level up! You've reached ${details?.level || 'a new level'}!`,
      subMessage: "Your consistent effort is showing real results. Keep bouncing toward your goals!",
      isPositive: true,
    },
  };

  const nudgeData = nudgeMessages[eventType];
  if (nudgeData) {
    await storage.createNudge({
      userId,
      nudgeType: eventType,
      message: nudgeData.message,
      subMessage: nudgeData.subMessage,
      isPositive: nudgeData.isPositive,
      isDismissed: false,
      relatedEntityId: details?.relatedEntityId,
    });
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // Mobile image uploads (photo of CV from camera roll or camera)
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif',
    ];
    // Some mobile browsers (iOS Safari) send PDFs as application/octet-stream.
    // Fall back to checking the file extension in that case.
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    const allowedExts = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif'];
    if (allowedMimes.includes(file.mimetype) ||
        (file.mimetype === 'application/octet-stream' && allowedExts.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, and image files are allowed.'));
    }
  }
});

/**
 * Wrap a multer middleware so that upload errors (wrong MIME type, file too
 * large, etc.) are returned as JSON instead of letting Express fall back to
 * its default HTML error page, which causes `response.json()` to throw on
 * the client side.
 */
function wrapMulter(multerMiddleware: any) {
  return (req: any, res: any, next: any) => {
    (multerMiddleware as any)(req, res, (err: any) => {
      if (!err) return next();
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        message: err.message || 'File upload error',
        error: err.code || 'UPLOAD_ERROR',
      });
    });
  };
}

// Configure multer for profile image uploads
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for profile images
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'));
    }
  }
});

// Configure multer for CMS asset uploads (admin image/video picker)
const cmsAssetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit — images only; videos use chunked upload
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier invalide. Images uniquement via ce chemin (JPEG, PNG, GIF, WEBP, SVG). Les vidéos utilisent le chemin chunked.'));
    }
  }
});

// Configure multer for chunked video upload. Replit proxy effective body limit is ~16 MB;
// keeping chunks at 8 MB (client) → accept up to 12 MB server-side for multipart overhead.
const videoChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

// In-memory store for active video upload sessions (admin only).
// Chunks are accumulated server-side then saved to GCS in one file.save() call —
// avoids createResumableUpload() which makes an outgoing HTTPS call that can
// fail in some environments ("fetch failed"). Keyed by uploadId (UUID).
const videoUploadSessions = new Map<string, {
  bucketId: string;
  objectPath: string;
  filename: string;
  label?: string;
  fileSize: number;
  contentType: string;
  chunks: Buffer[];
}>();

// DO NOT ADD NEW ROUTES HERE — use server/routes/<domain>.ts instead.
// See server/routes/bootcampRoutes.ts for the pattern.
export function registerAiQuotaRoute(
  app: Express,
  authMiddleware: RequestHandler = isAuthenticated,
): void {
  // GET /api/ai-quota — quota IA de l'utilisateur connecté
  app.get("/api/ai-quota", authMiddleware, async (req: any, res) => {
    try {
      const { checkAiQuota } = await import("./services/aiCostService");
      const quota = await checkAiQuota(req.user.id);
      res.json(quota);
    } catch (err: any) {
      // A quota read failure is temporary infrastructure trouble, not an
      // active quota. Keep the log useful without serialising req/headers,
      // which could include cookies or other credentials.
      console.error("[AI Quota] Failed to load quota", {
        method: req.method,
        path: req.path,
        userId: req.user?.id ?? "unknown",
        error: err instanceof Error ? err.message : String(err),
      });
      res.setHeader("Retry-After", "5");
      return res.status(503).json({
        error: "AI_QUOTA_UNAVAILABLE",
        message: "AI quota is temporarily unavailable. Please try again shortly.",
        retryable: true,
      });
    }
  });
}

const cvLeadStartup = optionalStartupFeature('cv_lead_initialize', initializeCvLeadRoutes);
const linkedinLeadStartup = optionalStartupFeature('linkedin_lead_initialize', initializeLinkedinLeadRoutes);
const salaryLeadStartup = optionalStartupFeature('salary_lead_initialize', initializeSalaryLeadRoutes);
const riasecLeadStartup = optionalStartupFeature('riasec_lead_initialize', initializeRiasecLeadRoutes);
const journalStartup = optionalStartupFeature('job_pool_journal', ensureJobPoolJournal);

export function startRouteWarmups() {
  journalStartup.start();
  cvLeadStartup.start();
  linkedinLeadStartup.start();
  salaryLeadStartup.start();
  riasecLeadStartup.start();
}

export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  app.use('/api/admin', (_req, _res, next) => {
    void withPoolTrigger('manual', async () => next());
  });
  // Setup authentication system
  setupSession(app);

  // CSRF protection — mounted right after session so it can read/write req.session._csrf.
  // Applies to all /api/* mutating requests except an explicit exempt list (public,
  // waitlist, unsubscribe, extension session creation). See server/auth/csrf.ts.
  app.use(conditionalCsrfProtection);
  app.use(csrfErrorHandler);
  app.use(['/api/public/cv-lead', '/api/cv-lead'], cvLeadStartup.guard);
  app.use(['/api/public/linkedin-lead', '/api/linkedin-lead'], linkedinLeadStartup.guard);
  app.use(['/api/public/salary-lead', '/api/salary-lead'], salaryLeadStartup.guard);
  app.use(['/api/public/riasec-lead', '/api/riasec-lead'], riasecLeadStartup.guard);
  app.use('/api/job-pool', journalStartup.guard);
  registerAdminAnalyticsRoutes(app);
  registerPaywallRoutes(app);
  registerUserJourneyRoutes(app);
  registerDiscoveryRoutes(app);
  registerModuleFeedbackRoutes(app);
  registerEmploymentAdminRoutes(app);
  registerGoogleReviewsRoutes(app);

  setupLinkedInAuth(app);
  setupGoogleAuth(app);
  setupLocalAuth(app);
  setupPasswordResetRoutes(app);
  setupCheckinRoutes(app);
  // Referral tables are safe to create repeatedly and must be present before
  // public click attribution or any signup flow receives traffic.
  ensureReferralSchema().catch((error) => console.warn("[Referral] schema setup deferred:", error.message));
  registerReferralRoutes(app);
  
  // ── Listings sitemap arrays ────────────────────────────────────────────────
  const { LISTINGS_METIERS, LISTINGS_VILLES } = await import('./constants/listingsSlugs');
  const _LISTINGS_METIERS_COUNT = LISTINGS_METIERS.length;
  const _LISTINGS_VILLES_COUNT  = LISTINGS_VILLES.length;
  const _LISTINGS_TOTAL_PAGES   = Math.ceil((_LISTINGS_METIERS_COUNT * _LISTINGS_VILLES_COUNT) / SITEMAP_PAGE_SIZE);

  // Sitemap.xml route — compact, shared snapshot with at most 60s freshness.
  // ── Sitemap index — points to evergreen content + jobs sitemap ────────────
  const GOOGLEBOT_UA_RE = /googlebot/i;
  registerSitemapFamilies(app);
  const loadSitemapIndex = createSitemapIndexSnapshot(
    async () => {
      const { publicJobSearchService } = await import("./services/publicJobSearchService");
      return publicJobSearchService.countIndexableJobs();
    },
    getSitemapFamilies,
    SITEMAP_PAGE_SIZE,
    FAMILY_PAGE_SIZE,
  );

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = 'https://rebond.pro';
      const { totalIndexable, jobPageCount, familyPages, listingsPageCount } = await loadSitemapIndex();

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      xml += `  <sitemap><loc>${baseUrl}/sitemap-pages.xml</loc></sitemap>\n`;
      for (const { family, pages } of familyPages) {
        for (let page=1; page<=pages;page++) {
          xml += `<sitemap><loc>${baseUrl}/sitemap-${family}${page === 1 ? "" : `-${page}`}.xml</loc></sitemap>\n`;
        }
      }
      xml += `  <sitemap><loc>${baseUrl}/sitemap-images.xml</loc></sitemap>\n`;
      xml += `  <sitemap><loc>${baseUrl}/sitemap-news.xml</loc></sitemap>\n`;
      for (let p = 1; p <= jobPageCount; p++) {
        xml += `  <sitemap><loc>${baseUrl}/sitemap-jobs-${p}.xml</loc></sitemap>\n`;
      }
      // Legacy listing endpoints remain usable but are no longer submitted as
      // a duplicate family in the index.
      xml += '</sitemapindex>';

      const ua = req.headers['user-agent'] || '';
      if (GOOGLEBOT_UA_RE.test(ua)) {
        console.log(
          `[SitemapIndex] Googlebot crawled sitemap index — ${jobPageCount} job page(s), ${listingsPageCount} listings page(s), ${totalIndexable} indexable jobs`
        );
      }

      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.set("Cache-Control", CACHE.HOUR);
      res.send(xml);
    } catch (error: any) {
      console.error('Error generating sitemap index:', error);
      res.status(500).send('Error generating sitemap index');
    }
  });

  // ── Evergreen pages: landing, blog, masterclasses, legal ──────────────────
  app.get('/sitemap-pages.xml', async (req, res) => {
    try {
      const [posts] = await Promise.all([
        storage.getAllBlogPosts(true, "fr", false),
      ]);

      const baseUrl = 'https://rebond.pro';
      const today = new Date().toISOString().split('T')[0];

      let urlsServed = 0;
      const url = (loc: string, opts: { lastmod?: string; changefreq: string; priority: string }) => {
        urlsServed++;
        return `  <url>\n    <loc>${loc}</loc>\n${opts.lastmod ? `    <lastmod>${opts.lastmod}</lastmod>\n` : ""}    <changefreq>${opts.changefreq}</changefreq>\n    <priority>${opts.priority}</priority>\n  </url>\n`;
      };

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // ── Core pages ────────────────────────────────────────────────────────
      for (const page of PUBLIC_SITEMAP_PAGES) {
        xml += url(`${baseUrl}${page.path}`, page);
      }
      // /signup and /login intentionally excluded: both render noindex pages (Login.tsx / SignIn.tsx
      // carry noindex={true}) — submitting them to GSC while they are noindex wastes crawl budget
      // and generates "Excluded by noindex" coverage errors.

      // ── Blog posts ────────────────────────────────────────────────────────
      for (const post of posts) {
        const pUpdatedAt: any = post.updatedAt;
        const pPublishedAt: any = post.publishedAt;
        const lastmod = pUpdatedAt
          ? (typeof pUpdatedAt === 'string' ? pUpdatedAt.split('T')[0] : (pUpdatedAt as Date).toISOString().split('T')[0])
          : pPublishedAt
            ? (typeof pPublishedAt === 'string' ? pPublishedAt.split('T')[0] : (pPublishedAt as Date).toISOString().split('T')[0])
            : undefined;
        xml += url(`${baseUrl}/blog/${post.slug}`, { lastmod, changefreq: 'monthly', priority: '0.7' });
      }

      // Masterclass pages (/learn/:slug) are excluded from the sitemap because they
      // require authentication — unauthenticated visitors are redirected to login, and
      // the server sets X-Robots-Tag: noindex for all /learn/ paths. Including them in
      // the sitemap while they carry noindex contradicts GSC and wastes crawl budget.

      // Legal pages intentionally excluded from sitemap (noindex — boilerplate content,
      // wastes crawl budget). /cgu, /cgv, /confidentialite, /legal all carry noindex meta.

      xml += '</urlset>';
      const ua = req.headers['user-agent'] || '';
      if (GOOGLEBOT_UA_RE.test(ua)) {
        console.log(`[SitemapPages] Googlebot crawled batch 1 — ${urlsServed} URLs served`);
      }

      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.set("Cache-Control", CACHE.HOUR);
      res.send(xml);
    } catch (error: any) {
      console.error('Error generating sitemap-pages:', error);
      res.status(500).send('Error generating sitemap-pages');
    }
  });

  // ── Image sitemap — marketing page + blog post cover images ─────────────
  // Helps Google Images index key visuals from the homepage and blog articles.
  app.get('/sitemap-images.xml', async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts(true, "fr", false);
      const baseUrl = 'https://rebond.pro';
      let urlsServed = PUBLIC_IMAGE_SITEMAP_PAGES.length;

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
      xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

      const escapeXml = (s: string) =>
        s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c));

      for (const page of PUBLIC_IMAGE_SITEMAP_PAGES) {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
        for (const image of page.images) {
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${baseUrl}${image.path}</image:loc>\n`;
          xml += `      <image:title>${image.title}</image:title>\n`;
          if (image.caption) xml += `      <image:caption>${image.caption}</image:caption>\n`;
          xml += `    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }

      // ── Blog post cover images ────────────────────────────────────────────
      for (const post of posts) {
        const coverImage = (post as any).coverImage as string | null | undefined;
        if (!coverImage) continue;
        const imgUrl = coverImage.startsWith('http') ? coverImage : `${baseUrl}${coverImage}`;
        // Validate URL is parseable before including it.
        try { new URL(imgUrl); } catch { continue; }
        const safeImgUrl = escapeXml(imgUrl);
        const title = escapeXml(post.title || '');
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${safeImgUrl}</image:loc>\n`;
        xml += `      <image:title>${title}</image:title>\n`;
        xml += `    </image:image>\n`;
        xml += `  </url>\n`;
        urlsServed++;
      }

      xml += '</urlset>';
      const ua = req.headers['user-agent'] || '';
      if (GOOGLEBOT_UA_RE.test(ua)) {
        console.log(`[SitemapImages] Googlebot crawled batch 1 — ${urlsServed} URLs served`);
      }
      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', CACHE.HOUR);
      res.send(xml);
    } catch (error: any) {
      console.error('Error generating sitemap-images:', error);
      res.status(500).send('Error generating sitemap-images');
    }
  });

  // ── Google News sitemap — recent blog articles (< 48 h) ──────────────────
  // Required format for Google News inclusion; only articles published within
  // the last 48 hours qualify. Older posts are silently excluded.
  app.get('/sitemap-news.xml', async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts(true, "fr", false);
      const baseUrl = 'https://rebond.pro';
      // Google News Sitemap: include all published articles so Google can
      // discover and index the full blog catalogue. Google evaluates recency
      // itself for News placement; older entries are simply ignored for News
      // but still help general crawl discovery.
      const recentPosts = posts
        .filter((p) => p.publishedAt != null && new Date(p.publishedAt).getTime() >= Date.now() - 48 * 3600000)
        .sort((a, b) => new Date(b.publishedAt as any).getTime() - new Date(a.publishedAt as any).getTime());

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
      xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

      for (const post of recentPosts) {
        // Format: YYYY-MM-DDTHH:mmZ (no seconds/ms — Google News recommended format)
        const d = new Date(post.publishedAt as any);
        const pubDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
        const title = (post.title || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
        xml += `    <news:news>\n`;
        xml += `      <news:publication>\n`;
        xml += `        <news:name>Rebond</news:name>\n`;
        xml += `        <news:language>fr</news:language>\n`;
        xml += `      </news:publication>\n`;
        xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
        xml += `      <news:title>${title}</news:title>\n`;
        xml += `    </news:news>\n`;
        xml += `  </url>\n`;
      }

      xml += '</urlset>';
      const ua = req.headers['user-agent'] || '';
      if (GOOGLEBOT_UA_RE.test(ua)) {
        console.log(`[SitemapNews] Googlebot crawled batch 1 — ${recentPosts.length} URLs served`);
      }
      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      res.send(xml);
    } catch (error: any) {
      console.error('Error generating sitemap-news:', error);
      res.status(500).send('Error generating sitemap-news');
    }
  });

  // ── Jobs sitemap — only direct-source offers (no aggregators) ─────────────
  // SEO note: GSC was reporting ~2000 "Détectée, actuellement non indexée"
  // because aggregator-sourced offers (France Travail, Adzuna, LinkedIn,
  // Indeed, Monster, Jooble, Meteojob, WTTJ, HelloWork, APEC, RegionsJob) are
  // duplicates of more authoritative sites and Google refuses to index them.
  // The query in publicJobSearchService.getRecentActiveJobsForSitemap() now
  // filters those sources out, and PublicJobDetail.tsx adds a noindex meta
  // for the same set so legacy crawled URLs are progressively de-indexed.
  // We still cap at 500 to fit crawl budget on a young domain.
  // ── Helper: render one page of the jobs sitemap ───────────────────────────
  const renderJobsSitemapPage = async (page: number, req: any, res: any) => {
    try {
      const { publicJobSearchService } = await import("./services/publicJobSearchService");
      const offset = (page - 1) * SITEMAP_PAGE_SIZE;
      const jobs = await publicJobSearchService.getRecentActiveJobsForSitemap(SITEMAP_PAGE_SIZE, offset).catch(() => []);

      const baseUrl = 'https://rebond.pro';
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const urlTag = (loc: string, opts: { lastmod?: string; changefreq: string; priority: string }) =>
        `  <url>\n    <loc>${loc}</loc>\n${opts.lastmod ? `    <lastmod>${opts.lastmod}</lastmod>\n` : ""}    <changefreq>${opts.changefreq}</changefreq>\n    <priority>${opts.priority}</priority>\n  </url>\n`;

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      let skippedNoSlug = 0;
      for (const j of jobs) {
        if (!j.slug) { skippedNoSlug++; continue; }
        const updatedAt = j.updatedAt ? (j.updatedAt instanceof Date ? j.updatedAt : new Date(j.updatedAt)) : null;
        const lastmod = updatedAt && Number.isFinite(updatedAt.getTime()) ? updatedAt.toISOString().split('T')[0] : undefined;
        const isRecent = !!updatedAt && updatedAt.getTime() > sevenDaysAgo;
        xml += urlTag(`${baseUrl}/emploi/o/${j.slug}`, {
          lastmod,
          changefreq: isRecent ? 'daily' : 'weekly',
          priority: isRecent ? '0.7' : '0.5',
        });
      }
      if (skippedNoSlug > 0) console.warn(`[Sitemap] Skipped ${skippedNoSlug} jobs without slug (backfill pending)`);


      xml += '</urlset>';
      const ua = req.headers['user-agent'] || '';
      if (GOOGLEBOT_UA_RE.test(ua)) {
        console.log(`[SitemapJobs] Googlebot crawled page ${page} — ${jobs.length - skippedNoSlug} URLs served`);
      }
      res.header('Content-Type', 'application/xml; charset=utf-8');
      // Expired URLs must leave the sitemap immediately, not after a CDN TTL.
      res.set("Cache-Control", "no-store");
      res.send(xml);
    } catch (error: any) {
      console.error(`Error generating sitemap-jobs page ${page}:`, error);
      res.status(500).send('Error generating sitemap-jobs');
    }
  };

  // Canonical paginated routes: sitemap-jobs-1.xml, sitemap-jobs-2.xml, ...
  app.get('/sitemap-jobs-:page.xml', async (req, res) => {
    const page = Math.max(1, parseInt(req.params.page, 10) || 1);
    await renderJobsSitemapPage(page, req, res);
  });

  // Backwards-compat alias: /sitemap-jobs.xml → page 1
  app.get('/sitemap-jobs.xml', async (req, res) => {
    await renderJobsSitemapPage(1, req, res);
  });

  // ── IndexNow key verification file — required by api.indexnow.org ──────────
  // Serve GET /<INDEXNOW_KEY>.txt so search engines can verify key ownership.
  // Set the INDEXNOW_KEY env var to any stable UUID you own (e.g. a v4 UUID).
  app.get('/:key([a-zA-Z0-9-]{8,64}).txt', (req, res) => {
    const key = process.env.INDEXNOW_KEY;
    if (!key || req.params.key !== key) {
      return res.status(404).send('Not found');
    }
    res.type('text/plain').send(key);
  });

  // CSRF token endpoint — returns a session-bound token for the client to include
  // in the X-CSRF-Token header on subsequent mutating requests.
  app.get('/api/auth/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Check email endpoint - Step 1 of two-step signin flow
  // Returns the auth provider for an email if user exists
  app.post('/api/auth/check-email', async (req, res) => {
    try {
      const { email, mentorOnly } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Mentor sign-in must not pick an unrelated account with the same email.
      const user = mentorOnly === true
        ? (await Promise.all(["mentor_local", "email", "cv", "google", "linkedin"].map(provider => storage.getUsersByEmailAndProvider(normalizedEmail, provider)))).flat().find(candidate => candidate.role === "mentor")
        : await storage.getUserByEmail(normalizedEmail);
      
      if (!user || (mentorOnly === true && user.role !== 'mentor')) {
        return res.status(404).json({ 
          exists: false,
          message: mentorOnly === true ? "Aucun compte mentor trouvé avec cet email" : "Aucun compte trouvé avec cet email"
        });
      }

      // Return the auth provider for this email
      return res.json({
        exists: true,
        authProvider: user.authProvider,
        // Include firstName for personalized greeting (optional)
        firstName: user.firstName
      });
    } catch (error: any) {
      console.error("[Check Email] Error:", error);
      return res.status(500).json({ message: "Une erreur est survenue" });
    }
  });

  // CV Parsing - Parse CV and return structured data (without creating account)
  app.post('/api/auth/cv-parse', wrapMulter(upload.single('cv')), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CV file uploaded" });
      }

      const file = req.file;
      let parsedData = null;

      // Derive the effective MIME type here (outer scope) so it is available
      // both inside the inner try/catch and in the success response payload.
      // iOS Safari and some Android browsers send files as application/octet-stream.
      // Derive a usable MIME from the file extension so the correct branch is taken.
      const fileExt = (file.originalname.split('.').pop() ?? '').toLowerCase();
      const effectiveMime = resolveCvMimeType(file.mimetype, file.originalname);

      // For HEIC/HEIF, vision APIs require a JPEG MIME declaration in the data URL.
      const imageMimeForVision = (effectiveMime === 'image/heic' || effectiveMime === 'image/heif')
        ? 'image/jpeg'
        : effectiveMime;

      try {
        if (effectiveMime === 'application/pdf') {
          // Check the native text layer before sending the PDF to vision.
          // Image-only/scanned PDFs should get actionable guidance instead of
          // being treated as a successfully parsed CV by the signup flow.
          let nativeTextLength = 0;
          try {
            const pdfData = await pdfParse(file.buffer);
            nativeTextLength = (pdfData.text || '').trim().length;
          } catch (error) {
            console.warn("[CV Parse] Native PDF text extraction failed; continuing with vision parsing:", error);
            nativeTextLength = 100; // Fail open when the PDF itself cannot be inspected.
          }

          if (nativeTextLength < 100) {
            return res.status(422).json({
              errorCode: "scanned_pdf",
              message: "Ce PDF ne contient pas de texte sélectionnable — il s'agit probablement d'un scan ou d'une image. Utilisez un PDF textuel ou copiez-collez le contenu de votre CV directement dans le chat."
            });
          }

          // Use vision API for PDFs: correctly handles two-column layouts where
          // text extraction (pdfParse) causes date-shift between columns
          console.log("[CV Parse] Parsing PDF with vision API (layout-aware)...");
          parsedData = await parseCVFromPDF(file.buffer);
          console.log("[CV Parse] PDF parsed with vision API successfully");
        } else if ((CV_IMAGE_MIME_TYPES as readonly string[]).includes(effectiveMime)) {
          // Mobile image upload: photo of CV (HEIC from iPhone, JPEG, PNG)
          console.log("[CV Parse] Parsing CV image with vision API, mimeType:", effectiveMime, "ext:", fileExt);
          parsedData = await parseCVFromImage(file.buffer, imageMimeForVision);
          console.log("[CV Parse] CV image parsed with vision API successfully");
        } else {
          let cvText = '';
          if (effectiveMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log("[CV Parse] Extracting text from DOCX...");
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            cvText = result.value;
            console.log("[CV Parse] DOCX text extracted, length:", cvText.length);
            if (cvText.trim().length < 50) {
              return res.status(400).json({
                errorCode: "EMPTY_FILE",
                message: "Le fichier DOCX semble vide ou illisible."
              });
            }
          } else if (effectiveMime === 'text/plain') {
            cvText = file.buffer.toString('utf-8');
          } else {
            // Unsupported format
            console.warn("[CV Parse] Unsupported MIME type:", effectiveMime, "(original:", file.mimetype, ")");
            return res.status(400).json({
              errorCode: "UNSUPPORTED_FORMAT",
              message: `Format "${effectiveMime}" non supporté. Envoyez votre CV en PDF, DOCX, TXT, ou une photo (JPEG/PNG).`
            });
          }
          if (cvText.trim()) {
            console.log("[CV Parse] Parsing CV text with AI...");
            parsedData = await parseCV(cvText);
            console.log("[CV Parse] CV parsed successfully");
          } else {
            return res.status(400).json({
              errorCode: "EMPTY_FILE",
              message: "Aucun texte détecté dans le fichier."
            });
          }
        }
      } catch (error) {
        console.error("[CV Parse] Error parsing CV:", error);
        // Determine if this is an AI/network error or a file-level error
        const errMsg = (error as Error).message || '';
        const isAiError = errMsg.includes('timeout') || errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('503') || errMsg.includes('429');
        return res.status(isAiError ? 503 : 400).json({
          errorCode: isAiError ? "AI_ERROR" : "PARSE_FAILED",
          message: isAiError
            ? "Le service d'analyse est temporairement indisponible. Réessayez dans quelques instants."
            : "Impossible d'analyser ce CV. Essayez de l'exporter en PDF depuis Word ou LibreOffice."
        });
      }

      // Convert file to base64 for storage
      const base64Content = file.buffer.toString('base64');

      // Return parsed data with file info (without creating account)
      return res.status(200).json({ 
        message: "CV parsed successfully",
        data: parsedData,
        file: {
          name: file.originalname,
          content: base64Content,
          mimeType: effectiveMime
        }
      });
    } catch (error: any) {
      console.error("[CV Parse] Error:", error);
      res.status(500).json({ message: error.message || "Failed to parse CV" });
    }
  });

  // CV Login - Verify identity by uploading CV
  app.post('/api/auth/cv-login', wrapMulter(upload.single('cv')), async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "Veuillez uploader votre CV" });
      }

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email with CV provider
      const user = await storage.getUserByEmailAndProvider(normalizedEmail, 'cv');
      
      if (!user) {
        return res.status(404).json({ 
          message: "Aucun compte CV trouvé avec cet email" 
        });
      }

      // Parse the uploaded CV
      const file = req.file;
      let cvText = '';
      let parsedData: any;

      const imageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
      const imageExts = ['jpg', 'jpeg', 'png', 'heic', 'heif'];
      const fileExt = (file.originalname.split('.').pop() ?? '').toLowerCase();

      // iOS Safari and some Android browsers send files as application/octet-stream.
      // Recover the supported MIME from the original filename so both the image
      // parser and the response use the same normalized type.
      const effectiveMime = resolveCvMimeType(file.mimetype, file.originalname);

      // For HEIC/HEIF, vision APIs require a JPEG MIME declaration in the data URL.
      const imageMimeForVision = (effectiveMime === 'image/heic' || effectiveMime === 'image/heif')
        ? 'image/jpeg'
        : effectiveMime;
      
      try {
        if (imageMimes.includes(effectiveMime) || imageExts.includes(fileExt)) {
          // Mobile image upload: photo of CV (HEIC from iPhone, JPEG, PNG)
          console.log("[CV Login] Parsing CV image with vision API, mimeType:", effectiveMime, "ext:", fileExt);
          parsedData = await parseCVFromImage(file.buffer, imageMimeForVision, user.country);
          console.log("[CV Login] CV image parsed with vision API successfully");
        } else {
          if (effectiveMime === 'application/pdf') {
            const pdfData = await pdfParse(file.buffer);
            cvText = pdfData.text;
          } else if (effectiveMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            cvText = result.value;
          } else if (effectiveMime === 'text/plain') {
            cvText = file.buffer.toString('utf-8');
          } else {
            return res.status(400).json({ message: "Seuls les fichiers PDF, DOCX et TXT sont supportés" });
          }

          if (cvText.trim().length < 50) {
            return res.status(400).json({
              message: "Le CV semble vide ou illisible. Veuillez utiliser un PDF textuel."
            });
          }

          // Parse CV to extract information (use user's country for AI routing)
          parsedData = await parseCV(cvText, user.country);
        }
      } catch (error) {
        console.error("[CV Login] Error parsing CV:", error);
        return res.status(400).json({ message: "Failed to read CV file" });
      }

      // Verify identity: check if CV email matches, or if name matches
      let identityVerified = false;
      
      // Check email match (most reliable)
      if (parsedData.email) {
        const cvEmail = parsedData.email.toLowerCase().trim();
        if (cvEmail === normalizedEmail) {
          identityVerified = true;
          console.log("[CV Login] Identity verified by email match");
        }
      }
      
      // Check name match (fallback)
      if (!identityVerified && parsedData.firstName && parsedData.lastName) {
        const cvFirstName = parsedData.firstName.toLowerCase().trim();
        const cvLastName = parsedData.lastName.toLowerCase().trim();
        const userFirstName = (user.firstName || '').toLowerCase().trim();
        const userLastName = (user.lastName || '').toLowerCase().trim();
        
        if (cvFirstName === userFirstName && cvLastName === userLastName) {
          identityVerified = true;
          console.log("[CV Login] Identity verified by name match");
        }
      }
      
      // If still not verified, check if phone matches
      if (!identityVerified && parsedData.phone && user.phone) {
        const cvPhone = parsedData.phone.replace(/\D/g, '');
        const userPhone = (user.phone || '').replace(/\D/g, '');
        if (cvPhone.length >= 8 && userPhone.length >= 8 && cvPhone.includes(userPhone.slice(-8))) {
          identityVerified = true;
          console.log("[CV Login] Identity verified by phone match");
        }
      }

      if (!identityVerified) {
        return res.status(401).json({ 
          message: "Le CV uploadé ne correspond pas au compte. Vérifiez que c'est bien le même CV utilisé lors de l'inscription." 
        });
      }

      // Identity verified - log user in
      req.login(user, (err: any) => {
        if (err) {
          console.error("[CV Login] Error logging in:", err);
          return res.status(500).json({ message: "Connection error" });
        }
        
        console.log("[CV Login] User logged in successfully:", user.id);
        storage.updateUser(user.id, { lastLoginAt: new Date() }).catch(() => {});
        return res.status(200).json({ 
          message: "Connexion réussie",
          mimeType: effectiveMime,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        });
      });
    } catch (error: any) {
      console.error("[CV Login] Error:", error);
      res.status(500).json({ message: error.message || "Connection error" });
    }
  });

  // CV Registration - Create account with parsed CV data + password
  app.post('/api/auth/cv-register', async (req: any, res) => {
    try {
      const { cvData, password, cvFile, isProfilePublic, completeOnboarding, referralAttributionToken } = req.body;

      if (!cvData) {
        return res.status(400).json({ message: "CV data is required" });
      }

      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Generate email if not provided
      let email = cvData.email;
      if (!email || email.includes('@rebond-temp.app')) {
        const firstName = cvData.firstName?.toLowerCase().replace(/\s+/g, '') || 'user';
        const lastName = cvData.lastName?.toLowerCase().replace(/\s+/g, '') || '';
        const randomId = Math.random().toString(36).substring(2, 8);
        email = `${firstName}${lastName ? '.' + lastName : ''}.${randomId}@rebond-temp.app`;
        console.log(`[CV Registration] Generated temporary email: ${email}`);
      }

      // Normalize email to lowercase
      email = email.toLowerCase().trim();

      // Check if user already exists with this email (any provider)
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const providerHint = existingUser.authProvider === 'linkedin'
          ? " Vous avez un compte LinkedIn avec cette adresse."
          : existingUser.authProvider === 'cv'
          ? " Vous pouvez vous connecter avec votre CV."
          : "";
        return res.status(409).json({ 
          message: `Un compte existe déjà avec l'adresse ${email}.${providerHint}` 
        });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create new user from CV data (hasCompletedOnboarding=false initially)
      const newUser = await storage.createUser({
        email,
        username: email,
        firstName: cvData.firstName || '',
        lastName: cvData.lastName || '',
        authProvider: 'cv',
        passwordHash,
        role: "user",
        // The CV-lead journey lands directly in the application. Its parsed CV
        // already supplies the professional profile that onboarding collects.
        hasCompletedOnboarding: completeOnboarding === true,
        isProfilePublic: isProfilePublic !== undefined ? isProfilePublic : true,
        phone: cvData.phone,
        location: cvData.location,
        linkedinUrl: cvData.linkedinUrl,
        githubUrl: cvData.githubUrl,
        portfolioUrl: cvData.portfolioUrl,
        summary: cvData.summary,
        headline: cvData.headline,
      });

      // Store all CV data in user's education, workExperience, etc. fields
      // These are JSONB fields in the user table
      console.log('[CV Registration] Saving career data:', {
        education: cvData.education?.length || 0,
        workExperience: cvData.workExperience?.length || 0,
        skills: cvData.skills?.length || 0,
        certifications: cvData.certifications?.length || 0,
        languages: cvData.languages?.length || 0,
        hasCvFile: !!cvFile,
      });
      
      const updateData: any = {
        education: cvData.education || [],
        workExperience: cvData.workExperience || [],
        skills: cvData.skills || [],
        certifications: cvData.certifications || [],
        languages: cvData.languages || [],
        interests: Array.isArray(cvData.interests)
          ? cvData.interests.filter((i: any) => typeof i === 'string' && i.trim()).map((name: string) => ({ name: name.trim() }))
          : [],
        cvParsed: true,
      };

      // Save CV file if provided
      if (cvFile && cvFile.content) {
        updateData.cvFileName = cvFile.name;
        updateData.cvFileContent = cvFile.content;
        updateData.cvFileMimeType = cvFile.mimeType;
        updateData.cvUploadedAt = new Date();
        console.log('[CV Registration] Saving CV file:', cvFile.name);
      }

      await storage.updateUser(newUser.id, updateData);
      await attachAttribution(newUser.id, referralAttributionToken, `${req.get("user-agent") ?? ""}|${req.get("accept-language") ?? ""}`)
        .catch((error) => console.warn("[Referral] CV attribution skipped:", error.message));
      console.log('[CV Registration] Career data and CV file saved successfully');

      // Create user progress
      await storage.createUserProgress({
        userId: newUser.id,
        totalBounces: 0,
        level: "Starting Jump",
      });

      // Prefill onboarding responses from CV data
      try {
        const { generateOnboardingResponsesFromCV } = await import('./services/cvOnboardingMapper');
        // Re-fetch user to get updated JSONB fields (location, jobSearchMonths, headline, summary, etc.)
        const updatedUser = await storage.getUserById(newUser.id);
        if (updatedUser) {
          const mappingResult = generateOnboardingResponsesFromCV(updatedUser, 'fr');
          
          console.log(`[CV Registration] Prefilling onboarding with ${mappingResult.responses.length} responses`);
          console.log(`[CV Registration] Coverage: ${mappingResult.coverage.mapped}/${mappingResult.coverage.total} fields mapped`);
          if (mappingResult.coverage.unmapped.length > 0) {
            console.log(`[CV Registration] Unmapped fields:`, mappingResult.coverage.unmapped);
          }

          if (mappingResult.responses.length > 0) {
            // Insert prefilled responses
            await storage.bulkInsertOnboardingResponses(mappingResult.responses);
            
            // Merge responses to create artifacts
            await storage.mergeOnboardingResponsesToProfile(mappingResult.sessionId, newUser.id);
            
            // Mark onboarding as completed
            await storage.markOnboardingCompleted(newUser.id);
            
            console.log(`[CV Registration] Onboarding prefilled and merged successfully`);
          } else {
            console.log(`[CV Registration] No responses to prefill, user will complete onboarding manually`);
          }
        }
      } catch (error) {
        console.error('[CV Registration] Error prefilling onboarding:', error);
        // Don't fail registration if prefilling fails - user can complete onboarding manually
      }

      // Auto-create first CV document in CV Studio from the uploaded CV.
      // Uses a defensive prefill that never throws; falls back to a blank
      // document so the user always lands on a usable /my-cvs page.
      try {
        const cvUser = await storage.getUserById(newUser.id);
        if (cvUser) {
          let prefill: Record<string, unknown>;
          try {
            prefill = buildRawCvPrefill(cvUser);
            const isBlank =
              !(prefill.summary) &&
              !(Array.isArray(prefill.experience) && (prefill.experience as any[]).length > 0) &&
              !(Array.isArray(prefill.education) && (prefill.education as any[]).length > 0);
            if (isBlank) {
              console.warn('[CV Registration] buildRawCvPrefill produced empty content — using blank fallback');
              prefill = buildBlankCvPrefill();
            }
          } catch (prefillErr) {
            console.error('[CV Registration] buildRawCvPrefill threw unexpectedly — using blank fallback:', prefillErr);
            prefill = buildBlankCvPrefill();
          }
          const rawName = (cvFile?.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
          const docName = rawName || (cvData.firstName ? `CV de ${cvData.firstName}` : 'Mon CV importé');
          const [newCvDoc] = await db.insert(cvGeneratedDocuments).values({
            userId: newUser.id,
            templateId: 'tpl-minimalist',
            name: docName,
            generatedContent: prefill,
            generationStatus: 'pending',
            isReference: true,
            settings: { tone: 'professional', language: 'fr' },
          }).returning();
          console.log(`[CV Registration] CV Studio document created: "${docName}" (_prefillBlankFallback=${!!(prefill as any)._prefillBlankFallback})`);

          // Fire-and-forget: AI-enhance the document in the background so the
          // user sees enriched content when they open /my-cvs. Never blocks the
          // registration response; any failure leaves the raw prefill intact.
          if (newCvDoc?.id) {
            const docId = newCvDoc.id;
            const enhanceUser = cvUser; // captured in closure
            setImmediate(async () => {
              await enhanceCvDocumentInBackground({
                documentId: docId,
                user: enhanceUser,
                persistence: createCvEnhancementPersistence({
                  settings: { tone: 'professional', language: 'fr' },
                  claimStatuses: ['pending', 'not_started'],
                }),
              });
            });
          }
        }
      } catch (err) {
        console.error('[CV Registration] Failed to create CV Studio document (non-blocking):', err);
      }

      // Import the uploaded CV file into user_cv_documents so the AI coach
      // can access it directly (previously it was only stored in users.cvFileContent).
      // The CV-lead journey already retains the uploaded object and claims it
      // after authentication. Importing the legacy users.cvFileContent copy as
      // well would create a duplicate CV document and duplicate object.
      if (completeOnboarding !== true) {
        autoImportSignupCv(newUser.id).catch((err) => {
          console.error('[CV Registration] autoImportSignupCv failed (non-blocking):', err);
        });
      }

      // Auto-login the user
      req.login(newUser, (err: any) => {
        if (err) {
          console.error("[CV Registration] Error logging in user:", err);
          return res.status(500).json({ message: "Account created but login failed" });
        }
        storage.updateUser(newUser.id, { lastLoginAt: new Date() }).catch(() => {});
        
        console.log("[CV Registration] User created and logged in successfully:", newUser.id);
        return res.status(201).json({ 
          message: "Account created successfully",
          user: newUser 
        });
      });
    } catch (error: any) {
      console.error("[CV Registration] Error:", error);
      // Catch Postgres unique constraint violation (code 23505) — show clean message, never expose raw SQL
      const isUniqueViolation = error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key');
      if (isUniqueViolation) {
        return res.status(409).json({ message: "Un compte existe déjà avec cette adresse email. Veuillez vous connecter." });
      }
      res.status(500).json({ message: "Une erreur est survenue lors de la création du compte. Veuillez réessayer." });
    }
  });

  // Helper function to get user ID is now imported from ./auth/session
  // It ensures we always use the database ID from the session

  // Middleware to disable caching and ETags for all API routes
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    next();
  });
  
  // Disable ETags globally for API routes
  app.set("etag", false);

  // DEBUG: Session status endpoint
  app.get('/api/debug/session', async (req: any, res) => {
    const session = req.session as any;
    const user = req.user as any;
    
    res.json({
      environment: process.env.NODE_ENV,
      hasSession: !!req.session,
      sessionId: req.session?.id,
      sessionUserId: session?.userId,
      hasUser: !!req.user,
      userClaims: user?.claims,
      userExpiresAt: user?.expires_at,
      isAuthenticatedFn: req.isAuthenticated ? req.isAuthenticated() : false,
      cookies: req.headers.cookie,
    });
  });

  app.get("/api/me", async (req, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // httpDb uses neon HTTP (pool-immune) — /api/me is called on every page load;
      // using the WebSocket pool here blocks a connection for 10 s under pressure.
      // httpSelectSafe: a session whose user was deleted matches zero rows, which
      // triggers the HTTP driver's null-map crash — the guard turns that into a
      // clean 404 instead of a 500, while still rethrowing real transient errors.
      const dbUser = await storage.getUserById(userId);

      if (!dbUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user without password hash
      const { passwordHash, ...userWithoutPassword } = dbUser;
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ...await projectAdminTestPersona(userId, userWithoutPassword), analyticsInternal: isInternalAnalyticsUser(dbUser) });
    } catch (error) {
      console.error("Error getting current user:", error);
      res.status(500).json({ error: "Failed to get current user" });
    }
  });

  registerAiQuotaRoute(app);

  // Email notification preferences
  registerEmailPreferenceAnalyticsRoutes(app);

  // Change password
  app.post("/api/me/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a password (OAuth users might not)
      if (!user.passwordHash) {
        return res.status(400).json({ error: "Cannot change password for OAuth accounts" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password and update
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { passwordHash: newPasswordHash });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Upload profile image
  app.post("/api/me/profile-image", isAuthenticated, profileImageUpload.single('image'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      
      // Validate file type (only images)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only image files (JPEG, PNG, GIF, WEBP) are allowed" });
      }

      // Validate file size (max 2MB — enforced here; base64 adds ~33% overhead so
      // a 2 MB file becomes ~2.7 MB stored in the DB, which is acceptable for PostgreSQL TEXT)
      const MAX_BYTES = 2 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        return res.status(400).json({ error: "File size must be less than 2MB" });
      }

      // Object Storage (Replit GCS WIF) is not reliably available in production:
      // - The sidecar /token endpoint returns "no allowed resources"
      // - The /object-storage/signed-object-url endpoint returns 401
      // Fallback: encode the image as a base64 data URL and store it directly in
      // the profileImageUrl DB column. The browser renders data: URLs natively in
      // <img src> tags, so no serving route is needed.
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      await storage.updateUser(userId, { profileImageUrl: dataUrl });

      res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        imageUrl: dataUrl,
      });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ error: "Failed to upload profile image" });
    }
  });

  // Delete profile image
  app.delete("/api/me/profile-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const dbUser = await storage.getUserById(userId);
      
      if (!dbUser || !dbUser.profileImageUrl) {
        return res.status(404).json({ error: "No profile image found" });
      }

      // Delete from object storage
      try {
        // Extract relative path from URL (remove /objects/ prefix)
        const relativeFileName = dbUser.profileImageUrl.replace('/objects/', '');
        const objectStorageService = new ObjectStorageService();
        const privateDir = objectStorageService.getPrivateObjectDir();
        const storageKey = `${privateDir}/${relativeFileName}`;
        
        const { bucketName, objectName } = parseObjectPath(storageKey);
        const bucket = objectStorageClient.bucket(bucketName);
        const storageFile = bucket.file(objectName);
        await storageFile.delete();
      } catch (error) {
        console.error("Error deleting file from object storage:", error);
        // Continue even if deletion fails
      }

      // Update user profile to remove image URL
      await storage.updateUser(userId, {
        profileImageUrl: null,
      });

      res.status(200).json({
        success: true,
        message: "Profile image deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting profile image:", error);
      res.status(500).json({ error: "Failed to delete profile image" });
    }
  });

  // Upload resume
  app.post("/api/me/resume", isAuthenticated, wrapMulter(upload.single('resume')), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get user for AI routing
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const effectiveMime = resolveCvMimeType(file.mimetype, file.originalname);
      if (effectiveMime === "application/msword") {
        return res.status(415).json({ error: "Le format DOC n’est pas pris en charge. Convertissez votre CV en PDF, DOCX ou TXT avant de l’importer." });
      }
      const base64Content = file.buffer.toString('base64');

      let parsedData = null;
      let parseError = null;
      // Persist the file before parsing; existing CVs are retained.
      const libraryCv = await importLibraryFile(userId, {
        buffer: file.buffer, fileName: file.originalname, mimeType: effectiveMime,
      }, { primary: true });
      if (!libraryCv) throw new Error("CV library import failed");

      try {
        if (effectiveMime === 'application/pdf') {
          // Use vision API for PDFs: correctly handles two-column layouts where
          // text extraction (pdfParse) causes date-shift between job entries
          console.log("Parsing PDF with vision API (layout-aware)...");
          parsedData = await parseCVFromPDF(file.buffer, user.country);
          console.log("PDF parsed with vision API successfully");
        } else {
          let cvText = '';
          if (effectiveMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log("Extracting text from DOCX...");
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            cvText = result.value;
            console.log("DOCX text extracted, length:", cvText.length);
            if (cvText.trim().length < 50) {
              throw new Error("DOCX file appears to be empty or contains very little text.");
            }
          } else if (effectiveMime === 'text/plain') {
            cvText = file.buffer.toString('utf-8');
          } else {
            throw new Error("Automatic parsing is currently only supported for PDF, DOCX, and TXT files.");
          }
          if (cvText.trim()) {
            console.log("Parsing CV with AI routing...");
            parsedData = await parseCVForProfileUpdate(cvText, user.country);
            console.log("CV parsed successfully");
          } else {
            throw new Error("No text content found in the uploaded file");
          }
        }
      } catch (error) {
        console.error("Error parsing CV:", error);
        parseError = (error as Error).message;
      }

      const updateData: any = {
        cvFileName: file.originalname,
        cvFileContent: base64Content,
        cvFileMimeType: effectiveMime,
        cvUploadedAt: new Date(),
        cvParsed: !!parsedData,
      };

      const profileUpdateMode = req.body?.profileUpdateMode === "replace" ? "replace" : "preserve";
      const profileUpdates = parsedData
        ? buildCvProfileUpdates({
            parsedData,
            currentUser: user,
            hadPreviousCv: !!user.cvFileName,
            mode: profileUpdateMode,
          })
        : { updateData: {}, updatedFields: [] };
      Object.assign(updateData, profileUpdates.updateData);

      const updatedUser = await storage.updateUser(userId, updateData);
      await finishLibraryExtraction(userId, libraryCv.id, libraryCv.storageKey, parsedData);
      // This authenticated upload is shared by the dashboard and Profile.
      // Signup/external imports have separate handlers.
      const diagnostic = await startAutomaticCvDiagnostic(userId, libraryCv.id);

      res.status(200).json({ 
        message: parsedData 
          ? "Resume uploaded and profile updated successfully" 
          : parseError 
            ? `Resume uploaded but parsing failed: ${parseError}` 
            : "Resume uploaded successfully",
        fileName: file.originalname,
        documentId: libraryCv.id,
        diagnostic,
        uploadedAt: updatedUser.cvUploadedAt,
        parsed: !!parsedData,
        parseError: parseError || undefined,
        profileUpdateMode,
        updatedFields: profileUpdates.updatedFields,
      });
    } catch (error) {
      console.error("Error uploading resume:", error);
      res.status(500).json({ error: "Failed to upload resume" });
    }
  });

  // Download resume
  app.get("/api/me/resume", async (req, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const dbUser = await storage.getUserById(userId);
      
      if (!dbUser || !dbUser.cvFileContent) {
        return res.status(404).json({ error: "No resume found" });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(dbUser.cvFileContent, 'base64');

      // Set appropriate headers with UTF-8 encoding for filename (RFC 2231)
      // This ensures accents and special characters are properly handled
      const fileName = dbUser.cvFileName || 'resume.pdf';
      res.setHeader('Content-Type', dbUser.cvFileMimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading resume:", error);
      res.status(500).json({ error: "Failed to download resume" });
    }
  });

  // Delete resume
  app.delete("/api/me/resume", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Remove resume data + all CV-derived profile sections (use null so Drizzle clears the columns)
      // On garde l'identité (nom/prénom/email/téléphone/localisation/réseaux sociaux) :
      // supprimer le CV n'est pas supprimer le compte.
      await storage.updateUser(userId, {
        // Fichier CV
        cvFileName: null as any,
        cvFileContent: null as any,
        cvFileMimeType: null as any,
        cvUploadedAt: null as any,
        cvParsed: false,
        // Texte libre extrait du CV
        summary: null as any,
        headline: null as any,
        // Sections structurées extraites du CV
        workExperience: null as any,
        education: null as any,
        skills: null as any,
        languages: null as any,
        certifications: null as any,
        projects: null as any,
        recommendations: null as any,
        volunteerExperience: null as any,
        organizations: null as any,
        activitiesAndSocieties: null as any,
        interests: null as any,
      });

      res.status(200).json({ message: "Resume deleted successfully" });
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ error: "Failed to delete resume" });
    }
  });

  // Parse existing resume
  app.post("/api/me/resume/parse", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const dbUser = await storage.getUserById(userId);
      
      if (!dbUser || !dbUser.cvFileContent) {
        return res.status(404).json({ error: "No resume found to parse" });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(dbUser.cvFileContent, 'base64');

      let parsedData = null;
      let parseError = null;

      try {
        let cvText = '';
        
        if (dbUser.cvFileMimeType === 'application/pdf') {
          console.log("Extracting text from PDF...");
          const pdfData = await pdfParse(fileBuffer);
          cvText = pdfData.text;
          console.log("PDF text extracted, length:", cvText.length);
          
          if (cvText.trim().length < 50) {
            throw new Error("PDF appears to be scanned or image-based. Please use a text-based PDF or manually enter your information.");
          }
        } else if (dbUser.cvFileMimeType === 'text/plain') {
          cvText = fileBuffer.toString('utf-8');
        } else {
          throw new Error("Automatic parsing is currently only supported for PDF and TXT files.");
        }

        if (cvText.trim()) {
          console.log("Parsing CV with AI routing...");
          parsedData = await parseCVForProfileUpdate(cvText, dbUser.country);
          console.log("CV parsed successfully");
        } else {
          throw new Error("No text content found in the file");
        }
      } catch (error) {
        console.error("Error parsing CV:", error);
        parseError = (error as Error).message;
        return res.status(400).json({ error: parseError });
      }

      const updateData: any = {};

      if (parsedData) {
        // Fill empty fields only — never overwrite data the user already has.
        // Re-parsing the CV must not silently rewrite a user's profile header.
        const isEmpty = (v: any) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        if (parsedData.firstName && isEmpty(dbUser.firstName)) updateData.firstName = parsedData.firstName;
        if (parsedData.lastName && isEmpty(dbUser.lastName)) updateData.lastName = parsedData.lastName;
        if (parsedData.phone && isEmpty(dbUser.phone)) updateData.phone = parsedData.phone;
        if (parsedData.location && isEmpty(dbUser.location)) updateData.location = parsedData.location;
        if (parsedData.linkedinUrl && isEmpty(dbUser.linkedinUrl)) updateData.linkedinUrl = parsedData.linkedinUrl;
        if (parsedData.githubUrl && isEmpty(dbUser.githubUrl)) updateData.githubUrl = parsedData.githubUrl;
        if (parsedData.portfolioUrl && isEmpty(dbUser.portfolioUrl)) updateData.portfolioUrl = parsedData.portfolioUrl;
        if (parsedData.summary && isEmpty(dbUser.summary)) updateData.summary = parsedData.summary;
        if (parsedData.headline && isEmpty(dbUser.headline)) updateData.headline = parsedData.headline;
        if (parsedData.education && isEmpty(dbUser.education)) updateData.education = parsedData.education;
        if (parsedData.workExperience && isEmpty(dbUser.workExperience)) updateData.workExperience = parsedData.workExperience;
        if (parsedData.skills && isEmpty(dbUser.skills)) updateData.skills = parsedData.skills;
        if (parsedData.certifications && isEmpty(dbUser.certifications)) updateData.certifications = parsedData.certifications;
        if (parsedData.languages && isEmpty(dbUser.languages)) updateData.languages = parsedData.languages;
        if (Array.isArray(parsedData.interests) && parsedData.interests.length > 0 && isEmpty(dbUser.interests)) {
          updateData.interests = parsedData.interests
            .filter((i: any) => typeof i === 'string' && i.trim())
            .map((name: string) => ({ name: name.trim() }));
        }
      }

      await storage.updateUser(userId, updateData);

      res.status(200).json({ 
        message: "Resume parsed and profile updated successfully",
        parsed: true
      });
    } catch (error) {
      console.error("Error parsing resume:", error);
      res.status(500).json({ error: "Failed to parse resume" });
    }
  });

  // Get user's onboarding responses via unified artifacts architecture
  // Returns: aggregated data reconstructed from user_learning_artifacts
  app.get("/api/users/me/onboarding-responses", async (req, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get all onboarding learning inputs to identify artifact sources
      const onboardingInputs = await storage.getAllLearningInputs('onboarding');
      
      // Get all user artifacts (active versions only)
      const userArtifacts = await storage.getUserArtifacts(userId);
      const activeArtifacts = userArtifacts.filter(a => a.isActive);
      
      // Build aggregatedData from artifacts matching onboarding inputs
      const aggregatedData: Record<string, any> = {};
      const onboardingInputIds = new Set(onboardingInputs.map(input => input.id));
      
      for (const artifact of activeArtifacts) {
        // Only include artifacts from onboarding learning inputs
        if (!artifact.learningInputId || !onboardingInputIds.has(artifact.learningInputId)) {
          continue;
        }
        
        // Find the corresponding learning input to get the field name and type
        const learningInput = onboardingInputs.find(input => input.id === artifact.learningInputId);
        if (!learningInput) continue;
        
        const fieldName = learningInput.inputId; // e.g., "firstName", "motivations"
        
        // Deserialize artifact content based on stored format
        let value: any = artifact.textContent;
        
        // Try to parse as JSON first (arrays and objects are stored as JSON)
        if (value && typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            value = parsed;
          } catch {
            // Fallback: legacy comma-separated strings (backward compatibility)
            // Check if this is a multi-select field based on learningInput.inputType
            const isMultiSelect = learningInput.inputType === 'checkbox';
            
            if (isMultiSelect) {
              // Legacy multi-select artifacts were stored as comma-separated strings
              if (value.includes(',')) {
                value = value.split(',').map((v: string) => v.trim());
              } else {
                // Single-element array stored as string without comma
                value = [value];
              }
              console.log(`[Legacy artifact] Converted field "${fieldName}" from string to array (inputType: ${learningInput.inputType})`);
            }
            // Otherwise keep as string
          }
        }
        
        // Handle file URLs
        if (artifact.fileUrl) {
          value = artifact.fileUrl;
        }
        
        aggregatedData[fieldName] = value;
      }
      
      res.status(200).json({
        responses: [], // Legacy field for backward compatibility (deprecated)
        overrides: [], // Legacy field for backward compatibility (deprecated)  
        aggregatedData // Merged view from artifacts
      });
    } catch (error) {
      console.error("Error getting onboarding responses:", error);
      res.status(500).json({ error: "Failed to get onboarding responses" });
    }
  });

  // Update user's onboarding response
  app.patch("/api/users/me/onboarding-responses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { id } = req.params;
      const { formData } = req.body;

      if (!formData || typeof formData !== 'object') {
        return res.status(400).json({ error: "Invalid formData" });
      }

      // Verify that this response belongs to the user
      const responses = await storage.getOnboardingResponsesByUser(userId);
      const existingResponse = responses.find(r => r.id === id);
      
      if (!existingResponse) {
        return res.status(404).json({ error: "Response not found or access denied" });
      }

      const updated = await storage.updateOnboardingResponse(id, formData);
      res.status(200).json(updated);
    } catch (error) {
      console.error("Error updating onboarding response:", error);
      res.status(500).json({ error: "Failed to update onboarding response" });
    }
  });

  // Update onboarding data via unified artifacts architecture
  // Strategy: Create new artifact versions, preserving history via version numbers
  app.patch("/api/users/me/onboarding-responses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { updates } = req.body;

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Invalid updates object or no updates provided" });
      }

      // Get all onboarding learning inputs to find which artifacts to update
      const onboardingInputs = await storage.getAllLearningInputs('onboarding');
      const updateKeys = Object.keys(updates);
      let updatedCount = 0;
      
      for (const fieldName of updateKeys) {
        try {
          // Find the learning input corresponding to this field
          const learningInput = onboardingInputs.find(input => input.inputId === fieldName);
          if (!learningInput) {
            console.warn(`No learning input found for field: ${fieldName}`);
            continue;
          }
          
          // Get mappings to find which profile slot this maps to
          const mappings = await storage.getMappingsByInput(learningInput.id);
          const profileSlotId = mappings.length > 0 ? mappings[0].profileSlotId : null;
          
          // Serialize the value based on type
          const value = updates[fieldName];
          let textContent = null;
          let fileUrl = null;
          
          if (typeof value === 'string') {
            // Check if it's a file URL (starts with http/https or contains 'storage')
            if (value.startsWith('http') || value.includes('/storage/')) {
              fileUrl = value;
            } else {
              textContent = value;
            }
          } else if (Array.isArray(value)) {
            // Serialize array as JSON to preserve type (handles single-element arrays correctly)
            textContent = JSON.stringify(value);
          } else if (typeof value === 'number') {
            textContent = value.toString();
          } else if (value !== null && value !== undefined) {
            textContent = JSON.stringify(value);
          }
          
          // Check if there's an existing active artifact for this learning input
          const existingArtifacts = await storage.getUserArtifacts(userId);
          const existingArtifact = existingArtifacts.find(
            a => a.isActive && a.learningInputId === learningInput.id
          );
          
          if (existingArtifact) {
            // Deactivate old version and create new version
            await storage.updateUserArtifact(existingArtifact.id, { isActive: false });
            
            await storage.createUserArtifact({
              userId,
              tabKey: 'general',
              learningInputId: learningInput.id,
              textContent,
              fileUrl,
              version: existingArtifact.version + 1,
              isActive: true,
            } as any);
          } else {
            // Create first version
            await storage.createUserArtifact({
              userId,
              tabKey: 'general',
              learningInputId: learningInput.id,
              textContent,
              fileUrl,
              version: 1,
              isActive: true,
            } as any);
          }
          
          updatedCount++;
        } catch (artifactError) {
          console.error(`Failed to update artifact for field ${fieldName}:`, artifactError);
          return res.status(500).json({ 
            error: "Failed to persist updates",
            details: `Error updating field: ${fieldName}`
          });
        }
      }

      if (updatedCount === 0) {
        return res.status(500).json({ 
          error: "No fields were updated"
        });
      }

      // Fetch updated artifacts to return fresh aggregatedData
      const userArtifacts = await storage.getUserArtifacts(userId);
      const activeArtifacts = userArtifacts.filter(a => a.isActive);
      const onboardingInputIds = new Set(onboardingInputs.map(input => input.id));
      
      // Rebuild aggregatedData from updated artifacts
      const aggregatedData: Record<string, any> = {};
      for (const artifact of activeArtifacts) {
        if (!artifact.learningInputId || !onboardingInputIds.has(artifact.learningInputId)) {
          continue;
        }
        
        const learningInput = onboardingInputs.find(input => input.id === artifact.learningInputId);
        if (!learningInput) continue;
        
        const fieldName = learningInput.inputId;
        let value: any = artifact.textContent;
        
        // Try to parse as JSON first (arrays and objects are stored as JSON)
        if (value && typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            value = parsed;
          } catch {
            // Fallback: legacy comma-separated strings (backward compatibility)
            // Check if this is a multi-select field based on learningInput.inputType
            const isMultiSelect = learningInput.inputType === 'checkbox';
            
            if (isMultiSelect) {
              // Legacy multi-select artifacts were stored as comma-separated strings
              if (value.includes(',')) {
                value = value.split(',').map((v: string) => v.trim());
              } else {
                // Single-element array stored as string without comma
                value = [value];
              }
              console.log(`[Legacy artifact] Converted field "${fieldName}" from string to array (inputType: ${learningInput.inputType})`);
            }
            // Otherwise keep as string
          }
        }
        
        if (artifact.fileUrl) {
          value = artifact.fileUrl;
        }
        
        aggregatedData[fieldName] = value;
      }
      
      res.status(200).json({
        responses: [],
        overrides: [],
        aggregatedData,
        updated: true,
        updatedCount
      });
    } catch (error) {
      console.error("Error updating onboarding responses:", error);
      res.status(500).json({ error: "Failed to update onboarding responses" });
    }
  });

  // Profile update schema - whitelist only safe fields
  const profileUpdateSchema = z.object({
    // Identity fields
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    gender: z.string().optional(),
    preferredLanguage: z.string().optional(),
    timezone: z.string().optional(),
    
    // Contact fields
    email: z.string().email().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedinUrl: z.string().nullish(),
    githubUrl: z.string().nullish(),
    portfolioUrl: z.string().nullish(),
    websiteUrl: z.string().nullish(),
    twitterUrl: z.string().nullish(),
    
    // Address fields
    street: z.string().optional(),
    city: z.string().optional(),
    zip: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    
    // Professional summary
    summary: z.string().optional(),
    headline: z.string().optional(),
    
    // Profile data arrays (JSONB)
    education: z.array(z.any()).optional(),
    workExperience: z.array(z.any()).optional(),
    skills: z.array(z.any()).optional(),
    certifications: z.array(z.any()).optional(),
    languages: z.array(z.any()).optional(),
    projects: z.array(z.any()).optional(),
    recommendations: z.array(z.any()).optional(),
    volunteerExperience: z.array(z.any()).optional(),
    organizations: z.array(z.any()).optional(),
    interests: z.array(z.any()).optional(),
    activitiesAndSocieties: z.array(z.any()).optional(),
    
    // Network stats
    connections: z.number().optional(),
    followers: z.number().optional(),
    
    // Salary expectations (gross annual including bonus)
    salaryExpectationMin: z.number().nullable().optional(),
    salaryExpectationMax: z.number().nullable().optional(),
    
    // Professional classification (ISCO/ISIC)
    jobCategory: z.string().nullable().optional(),
    iscoCode: z.string().nullable().optional(),
    iscoLabel: z.string().nullable().optional(),
    activitySector: z.string().nullable().optional(),
    isicCode: z.string().nullable().optional(),
    isicLabel: z.string().nullable().optional(),
    
    // Job search location preferences
    targetLocation: z.string().nullable().optional(),
    targetLocationLabel: z.string().nullable().optional(),
    searchRadius: z.number().nullable().optional(),
    
    // Job search target fields (free text, replaces ISCO/ISIC selectors)
    targetJobTitle: z.string().nullable().optional(),
    targetSector: z.string().nullable().optional(),
    targetSeniority: z.string().nullable().optional(),
    targetContractType: z.string().nullable().optional(),
    targetRemote: z.string().nullable().optional(),
    jobSearchStatus: z.enum(["active_search", "open_to_opportunities", "not_searching"]).nullable().optional(),
  });

  // Update profile sections
  app.patch("/api/me/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate and whitelist fields
      const validatedData = profileUpdateSchema.parse(req.body);

      // Update user profile with only whitelisted fields
      await storage.updateUser(userId, validatedData as any);

      const updatedUser = await storage.getUserById(userId);
      res.status(200).json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.issues });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Mark onboarding as completed
  app.post("/api/me/complete-onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Update user to mark onboarding as completed
      await storage.updateUser(userId, { hasCompletedOnboarding: true });

      // Auto-save du CV d'inscription dans user_cv_documents (silencieux si absent)
      autoImportSignupCv(userId).catch(() => {});

      const updatedUser = await storage.getUserById(userId);
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Get user progress
  app.get("/api/progress/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserId(req);
      if (userId !== sessionUserId) return res.status(403).json({ error: "Forbidden" });
      let progress = await storage.getUserProgress(userId);
      
      // If no progress exists, create default progress
      if (!progress) {
        // Check if user exists, if not create it with the provided ID
        let user = await storage.getUserById(userId);
        if (!user) {
          // Create user directly with storage
          try {
            const passwordHash = await bcrypt.hash("demo", 10);
            user = await storage.createUser({
              username: `user_${userId.slice(0, 8)}`,
              email: `${userId.slice(0, 8)}@rebond.demo`,
              passwordHash,
              authProvider: "email",
              role: "user",
            });
          } catch (error) {
            console.error("Error creating demo user:", error);
            throw error;
          }
        }
        
        if (!user) {
          throw new Error("Failed to create or find user");
        }
        
        progress = await storage.createUserProgress({
          userId: user.id,
          totalBounces: 0,
          currentMomentum: 0,
          level: "Starting Jump",
          totalApplications: 0,
          totalInterviews: 0,
          totalOffers: 0,
          coursesCompleted: 0,
          coursesInProgress: 0,
          hoursLearned: 0,
        });
      }
      
      res.status(200).json(progress);
    } catch (error) {
      console.error("Error getting progress:", error);
      res.status(500).json({ error: "Failed to get progress" });
    }
  });

  // Update user progress
  app.patch("/api/progress/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserId(req);
      if (userId !== sessionUserId) return res.status(403).json({ error: "Forbidden" });
      const updates = req.body;
      
      const progress = await storage.updateUserProgress(userId, updates);
      res.status(200).json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  // Recalculate courses completed count based on existing data
  app.post("/api/progress/:userId/recalculate-courses", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const requestUserId = getUserId(req);
      
      // Only allow users to recalculate their own progress
      if (requestUserId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      // Get all bounce activity of type class_completed for this user
      const allActivity = await storage.getBounceActivity(userId, 1000);
      const classCompletedActivities = allActivity.filter(a => a.activityType === "class_completed");
      const coursesCompleted = classCompletedActivities.length;
      
      // Get all user learning progress to count courses in progress
      const allLearningProgress = await db
        .select()
        .from(userLearningProgressTable)
        .where(eq(userLearningProgressTable.userId, userId));
      
      // Count unique classes that have at least one module completed but not all
      let coursesInProgress = 0;
      const completedClassIds = new Set<string>();
      
      // Extract class IDs from class_completed activities
      for (const activity of classCompletedActivities) {
        const match = activity.description.match(/Completed class: (.+)/);
        if (match) {
          completedClassIds.add(match[1]);
        }
      }
      
      // For each learning progress, check if there are classes with partial completion
      for (const progress of allLearningProgress) {
        const completedModules = (progress.completedModules as string[]) || [];
        if (completedModules.length > 0) {
          // Get unique class IDs from completed modules
          const moduleClassMap = await db
            .select({ classId: modulesTable.classId })
            .from(modulesTable)
            .where(inArray(modulesTable.id, completedModules));
          
          const classIdsWithProgress = new Set(moduleClassMap.map(m => m.classId).filter(Boolean));
          
          // Count classes that have progress but are not fully completed
          for (const classId of classIdsWithProgress) {
            if (classId && !completedClassIds.has(classId)) {
              coursesInProgress++;
            }
          }
        }
      }
      
      // Update user progress
      const updatedProgress = await storage.updateUserProgress(userId, {
        coursesCompleted,
        coursesInProgress,
      });
      
      console.log(`[recalculate-courses] User ${userId}: coursesCompleted=${coursesCompleted}, coursesInProgress=${coursesInProgress}`);
      
      res.status(200).json({
        success: true,
        coursesCompleted,
        coursesInProgress,
        progress: updatedProgress,
      });
    } catch (error) {
      console.error("Error recalculating courses:", error);
      res.status(500).json({ error: "Failed to recalculate courses" });
    }
  });

  // Get user badges
  app.get("/api/badges/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserId(req);
      if (userId !== sessionUserId) return res.status(403).json({ error: "Forbidden" });
      const userBadges = await storage.getUserBadges(userId);
      res.status(200).json(userBadges);
    } catch (error) {
      console.error("Error getting badges:", error);
      res.status(500).json({ error: "Failed to get badges" });
    }
  });

  // Create a badge
  app.post("/api/badges", requireAdmin, async (req, res) => {
    try {
      const validatedBadge = insertBadgeSchema.parse(req.body);
      const badge = await storage.createBadge(validatedBadge);
      res.status(201).json(badge);
    } catch (error) {
      console.error("Error creating badge:", error);
      res.status(400).json({ error: "Failed to create badge" });
    }
  });

  // Get bounce activity
  app.get("/api/activity/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = getUserId(req);
      if (userId !== sessionUserId) return res.status(403).json({ error: "Forbidden" });
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activity = await storage.getBounceActivity(userId, limit);
      res.status(200).json(activity);
    } catch (error) {
      console.error("Error getting activity:", error);
      res.status(500).json({ error: "Failed to get activity" });
    }
  });

  // Create bounce activity
  app.post("/api/activity", isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = getUserId(req);
      if (!sessionUserId) return res.status(401).json({ error: "Unauthorized" });
      // Force userId from session — ignore any client-supplied userId
      const validatedActivity = insertBounceActivitySchema.parse({ ...req.body, userId: sessionUserId });
      const activity = await storage.createBounceActivity(validatedActivity);
      
      // Also update user progress with new bounce and level
      const progress = await storage.getUserProgress(sessionUserId);
      if (progress) {
        const bouncesEarned = validatedActivity.bouncesEarned ?? 1;
        const newTotalBounces = progress.totalBounces + bouncesEarned;
        const newLevel = calculateLevel(newTotalBounces);
        
        await storage.updateUserProgress(sessionUserId, {
          totalBounces: newTotalBounces,
          currentMomentum: progress.currentMomentum + bouncesEarned,
          level: newLevel,
        });
      }
      
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(400).json({ error: "Failed to create activity" });
    }
  });

  // Get today's job opportunities
  app.get("/api/opportunities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const opportunities = await storage.getTodayJobOpportunities(limit);
      res.status(200).json(opportunities);
    } catch (error) {
      console.error("Error getting opportunities:", error);
      res.status(500).json({ error: "Failed to get opportunities" });
    }
  });

  // Create job opportunity (supports Chrome extension)
  app.post("/api/opportunities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Prepare opportunity data
      const opportunityData = {
        ...req.body,
        userId,
        jobBoard: req.body.jobBoard || req.body.source || 'chrome_extension',
        externalId: req.body.externalId || `ext-${Date.now()}`,
        source: req.body.source || 'manual',
        savedAt: req.body.savedAt ? new Date(req.body.savedAt) : new Date(),
        postedAt: req.body.postedAt ? new Date(req.body.postedAt) : null,
      };
      
      const validatedOpportunity = insertJobOpportunitySchema.parse(opportunityData);
      const opportunity = await storage.createJobOpportunity(validatedOpportunity);
      
      // Award bounces if saved from Chrome extension
      if (opportunityData.source === 'chrome_extension') {
        try {
          const progress = await storage.getUserProgress(userId);
          if (progress) {
            const bounceValue = 10;
            const newTotalBounces = progress.totalBounces + bounceValue;
            const newLevel = calculateLevel(newTotalBounces);
            
            await storage.updateUserProgress(userId, {
              totalBounces: newTotalBounces,
              currentMomentum: progress.currentMomentum + bounceValue,
              level: newLevel,
            });
            
            // Log the bounce activity
            await storage.createBounceActivity({
              userId,
              activityType: 'opportunity_saved_extension',
              description: `Sauvegardé: ${opportunity.title} chez ${opportunity.company}`,
              bouncesEarned: bounceValue,
            });
          }
        } catch (bounceError) {
          console.error("Error awarding bounces:", bounceError);
          // Don't fail the request if bounce award fails
        }
      }
      
      res.status(201).json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      res.status(400).json({ error: "Failed to create opportunity" });
    }
  });

  // Get user applications
  app.get("/api/applications/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getUserId(req);
      const { userId } = req.params;
      if (!authUserId || authUserId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const applications = await storage.getUserApplications(userId);
      res.status(200).json(applications);
    } catch (error) {
      console.error("Error getting applications:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  // Get single application
  app.get("/api/applications/:userId/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getUserId(req);
      const { userId, applicationId } = req.params;
      if (!authUserId || authUserId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const application = await storage.getApplicationForUser(userId, applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });

  // Create application (save to Job Application Management)
  app.post("/api/applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Preprocess appliedAt from string to Date if present
      const body = {
        ...req.body,
        userId, // Use authenticated user's ID
        appliedAt: req.body.appliedAt ? new Date(req.body.appliedAt) : null,
      };
      const validatedApplication = insertApplicationSchema.parse(body);
      const chromeSave = validatedApplication.source === "chrome_extension" && validatedApplication.jobUrl
        ? await createChromeApplication(validatedApplication) : null;
      if (chromeSave?.reused) return res.json(chromeSave.application);
      const application = chromeSave?.application ?? await storage.createApplication(validatedApplication);
      
      if (!application) {
        console.error("[POST /api/applications] createApplication returned undefined for user:", userId, "company:", validatedApplication.company, "companyId:", validatedApplication.companyId);
        return res.status(500).json({ error: "Database insert failed - please try again" });
      }
      
      // Bootcamp auto-completion (best-effort)
      tryAutoCompleteBootcamp(userId, "applications.created").catch((e) => console.warn("[bootcamp auto] applications.created", e?.message));

      // Auto-create/enrich company in CRM and link it to the application
      if (application.company && application.company.trim()) {
        try {
          const externalCompanyData = req.body.externalCompanyData;
          let company;
          if (externalCompanyData && externalCompanyData.name) {
            company = await storage.findOrCreateCompanyWithData(userId, externalCompanyData);
          } else {
            company = await storage.findOrCreateCompany(userId, application.company.trim());
          }
          // Link the company to the application if not already set
          if (company && !application.companyId) {
            await db.update(applicationsTable)
              .set({ companyId: company.id })
              .where(eq(applicationsTable.id, application.id));
            application.companyId = company.id;
          }
          console.log(`[Applications] Auto-created/found company: ${application.company} → ${company?.id}`);
        } catch (companyError) {
          console.error("Error auto-creating company:", companyError);
        }
      }
      
      // Trigger automation workflows for application_created event
      try {
        await automationEventService.emitApplicationCreated(userId, {
          applicationId: application.id,
          companyName: application.company || "Entreprise",
          position: application.position || "Poste",
          applicationType: (application as any).applicationType || undefined,
        });
      } catch (triggerError) {
        console.error("[Applications] Failed to trigger automation:", triggerError);
      }
      
      // Update user progress - increment total applications and bounces
      const progress = await storage.getUserProgress(validatedApplication.userId);
      if (progress) {
        const bouncesEarned = 2;
        const newTotalBounces = progress.totalBounces + bouncesEarned;
        const newLevel = calculateLevel(newTotalBounces);
        const oldLevel = progress.level;
        const newTotalApplications = progress.totalApplications + 1;
        
        await storage.updateUserProgress(validatedApplication.userId, {
          totalApplications: newTotalApplications,
          totalBounces: newTotalBounces,
          currentMomentum: progress.currentMomentum + bouncesEarned,
          level: newLevel,
        });
        
        // Add bounce activity for application
        await storage.createBounceActivity({
          userId: validatedApplication.userId,
          activityType: "application",
          description: `Applied to ${validatedApplication.position} at ${validatedApplication.company}`,
          bouncesEarned,
        });
        
        // Create nudges for milestones
        if (newTotalApplications === 1) {
          await createNudgeForEvent(validatedApplication.userId, "first_application", { relatedEntityId: application.id });
        } else if (newTotalApplications === 5) {
          await createNudgeForEvent(validatedApplication.userId, "application_milestone_5");
        } else if (newTotalApplications === 10) {
          await createNudgeForEvent(validatedApplication.userId, "application_milestone_10");
        }
        
        // Create nudge for level up
        if (newLevel !== oldLevel) {
          await createNudgeForEvent(validatedApplication.userId, "level_up", { level: newLevel });
        }
      }
      
      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(400).json({ error: "Failed to create application" });
    }
  });

  // Update application status
  app.patch("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getUserId(req);
      if (!authUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { id } = req.params;
      const updates = { ...req.body };
      // Never allow userId reassignment via PATCH body
      delete updates.userId;
      delete updates.id;

      // Convert date strings to Date objects for timestamp fields; empty string → null
      const dateFields = ['appliedAt', 'createdAt', 'updatedAt'];
      for (const field of dateFields) {
        if (field in updates) {
          const val = updates[field];
          if (val && typeof val === 'string') {
            const d = new Date(val);
            updates[field] = isNaN(d.getTime()) ? null : d;
          } else if (!val) {
            updates[field] = null;
          }
        }
      }
      
      // Get old application data before update (for workflow triggers)
      const oldApplication = await storage.getApplication(id);
      if (!oldApplication) {
        return res.status(404).json({ error: "Application not found" });
      }
      // Ownership check — users may only update their own applications
      if (oldApplication.userId !== authUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const application = await storage.updateApplication(id, updates);
      
      // Create nudges based on status changes
      if (updates.status) {
        const statusNudges: Record<string, string> = {
          "interview": "interview_scheduled",
          "offer": "offer_received",
          "rejected": "rejection_received",
        };
        
        const nudgeType = statusNudges[updates.status];
        if (nudgeType) {
          await createNudgeForEvent(application.userId, nudgeType, { relatedEntityId: application.id });
        }
        
        // Award bounces for positive status changes
        if (updates.status === "interview" || updates.status === "offer") {
          const progress = await storage.getUserProgress(application.userId);
          if (progress) {
            const bouncesEarned = updates.status === "offer" ? 10 : 5;
            const newTotalBounces = progress.totalBounces + bouncesEarned;
            const newLevel = calculateLevel(newTotalBounces);
            const oldLevel = progress.level;
            
            await storage.updateUserProgress(application.userId, {
              totalBounces: newTotalBounces,
              currentMomentum: progress.currentMomentum + bouncesEarned,
              level: newLevel,
              ...(updates.status === "interview" && { totalInterviews: progress.totalInterviews + 1 }),
              ...(updates.status === "offer" && { totalOffers: progress.totalOffers + 1 }),
            });
            
            // Add bounce activity
            await storage.createBounceActivity({
              userId: application.userId,
              activityType: updates.status,
              description: `${updates.status === "offer" ? "Received offer" : "Interview scheduled"} for ${application.position} at ${application.company}`,
              bouncesEarned,
            });
            
            // Create nudge for level up
            if (newLevel !== oldLevel) {
              await createNudgeForEvent(application.userId, "level_up", { level: newLevel });
            }
          }
        }
        
        // TRIGGER AUTOMATION WORKFLOWS when status changes
        if (oldApplication.status !== updates.status) {
          console.log(`[Automation Trigger] Application status changed from "${oldApplication.status}" to "${updates.status}"`);
          
          // Use standardized event service for status change
          try {
            await automationEventService.emitApplicationStatusChanged(application.userId, {
              applicationId: application.id,
              companyName: application.company || "Entreprise",
              position: application.position || "Poste",
              oldStatus: oldApplication.status || "",
              newStatus: updates.status,
            });
          } catch (triggerError) {
            console.error("[Applications] Failed to trigger status change automation:", triggerError);
          }
        }
      }
      
      res.status(200).json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.delete("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getUserId(req);
      if (!authUserId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const existing = await db.select().from(applicationsTable).where(and(eq(applicationsTable.id, id), eq(applicationsTable.userId, authUserId))).limit(1);
      if (!existing.length) return res.status(404).json({ error: "Application not found" });
      await db.delete(applicationsTable).where(and(eq(applicationsTable.id, id), eq(applicationsTable.userId, authUserId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ error: "Failed to delete application" });
    }
  });

  // Toggle application favorite status
  app.patch("/api/applications/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get the application to ensure it belongs to the user and get current favorite status
      const application = await storage.getApplicationForUser(userId, id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Toggle the favorite status
      const updatedApplication = await storage.updateApplication(id, {
        favorite: !application.favorite
      });
      
      res.status(200).json(updatedApplication);
    } catch (error) {
      console.error("Error toggling application favorite:", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });


  // ===== ADMIN USER MANAGEMENT ROUTES =====
  
  // Get all users (with pagination)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const requestedLimit = Number.parseInt(req.query.limit as string, 10);
      const requestedOffset = Number.parseInt(req.query.offset as string, 10);
      // This endpoint feeds a list view. Keep the response bounded even if a
      // client requests an excessive page size.
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 2_000)
        : 100;
      const offset = Number.isFinite(requestedOffset) && requestedOffset > 0
        ? requestedOffset
        : 0;
      const users = await storage.getAllUsers(limit, offset);
      res.status(200).json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Update user role
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const adminUser = (req as any).adminUser;

      if (typeof role !== "string" || !["user", "admin", "moderator", "mentor", "alpha", "beta", "tester"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isPromotionToAdmin = role === "admin" && user.role?.toLowerCase() !== "admin";
      if (isPromotionToAdmin && req.body.confirmPrivilegeChange !== true) {
        return res.status(400).json({
          error: "Explicit confirmation is required before granting administrator access",
        });
      }

      const updatedUser = await storage.updateUser(id, { role });
      // A role change must take effect on the next request, rather than after
      // the short Passport deserialization-cache TTL.
      const { invalidateUserCache } = await import("./auth/session");
      invalidateUserCache(id);

      // Log the activity
      await storage.logAdminActivity({
        adminId: adminUser.id,
        action: "role_change",
        targetUserId: id,
        details: { field: "role", oldValue: user.role, newValue: role },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Generate password reset token
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminUser = (req as any).adminUser;
      const crypto = await import("crypto");

      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await storage.createPasswordResetToken({
        userId: id,
        tokenHash,
        expiresAt,
        used: false,
      });

      // Log the activity
      await storage.logAdminActivity({
        adminId: adminUser.id,
        action: "password_reset_generated",
        targetUserId: id,
        details: { expiresAt: expiresAt.toISOString() },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // In production, you'd send this via email
      const resetLink = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

      res.status(200).json({ 
        message: "Reset token generated",
        resetLink,
        expiresAt 
      });
    } catch (error) {
      console.error("Error generating reset token:", error);
      res.status(500).json({ error: "Failed to generate reset token" });
    }
  });

  // Export user data (GDPR compliance)
  app.get("/api/admin/users/:id/export", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminUser = (req as any).adminUser;

      const userData = await storage.exportUserData(id);

      // Log the activity
      await storage.logAdminActivity({
        adminId: adminUser.id,
        action: "user_data_export",
        targetUserId: id,
        details: { exportedAt: new Date().toISOString() },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json(userData);
    } catch (error) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ error: "Failed to export user data" });
    }
  });

  // Delete user (GDPR right to be forgotten)
  registerAdminUserDeletionRoute(app, storage);

  // Get admin activity log
  app.get("/api/admin/activity-log", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.getAdminActivityLog(limit, offset);
      res.status(200).json(logs);
    } catch (error) {
      console.error("Error getting activity log:", error);
      res.status(500).json({ error: "Failed to get activity log" });
    }
  });

  // ===== OBJECT STORAGE ROUTES =====
  // Reference: blueprint:javascript_object_storage
  
  // Serve public objects
  // Strategy: use Replit sidecar signObjectURL (works regardless of IAM/UBLA).
  // The Replit sidecar at 127.0.0.1:1106 signs GCS URLs on behalf of the app,
  // bypassing the service-account GET restriction. Falls back to unauthenticated
  // HTTP (for dev/public buckets) if signing fails.
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath as string;
    const objectStorageService = new ObjectStorageService();
    try {
      const searchPaths = objectStorageService.getPublicObjectSearchPaths();

      for (const searchPath of searchPaths) {
        const fullPath = `${searchPath}/${filePath}`;
        const { bucketName, objectName } = parseObjectPath(fullPath);

        // ── Strategy 1: redirect to the public GCS URL ───────────────────────
        // If the object is publicly readable (legacy bucket without public access
        // prevention), redirect lets the browser talk directly to GCS which
        // natively supports Accept-Ranges / range requests.
        // Falls through to Strategy 2 when public access prevention is enforced.
        const encodedObject = objectName.split("/").map(encodeURIComponent).join("/");
        const gcsPublicUrl = `https://storage.googleapis.com/${bucketName}/${encodedObject}`;
        try {
          const headRes = await fetch(gcsPublicUrl, { method: "HEAD" });
          if (headRes.ok) {
            // Publicly accessible — let the browser fetch it directly with range support
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return res.redirect(302, gcsPublicUrl);
          }
        } catch (_headErr) {
          // Network error checking public URL → fall through to SDK proxy
        }

        // ── Strategy 2: SDK streaming proxy (private objects) ────────────────
        // For objects not publicly accessible, proxy via the authenticated SDK.
        // Uses createReadStream() instead of download() so we never buffer the
        // full file in RAM, and we forward Accept-Ranges so video can seek.
        try {
          const sdkFile = objectStorageClient.bucket(bucketName).file(objectName);
          const [sdkExists] = await sdkFile.exists();
          if (sdkExists) {
            const [meta] = await sdkFile.getMetadata();
            const contentType = (meta.contentType as string) || "application/octet-stream";
            const size = meta.size ? Number(meta.size) : undefined;

            // The deployment proxy rejects large, non-range media responses with a
            // blank 500. Browsers usually ask for ranges, but some start with
            // `bytes=0-` (or no Range header at all). Serve videos in 8 MB segments
            // in both cases so the browser can continue requesting the next range.
            const isVideo = contentType.startsWith("video/");
            const maxVideoRangeBytes = 8 * 1024 * 1024;
            const requestedRange = req.headers.range || (isVideo ? "bytes=0-" : undefined);
            if (requestedRange && size) {
              const match = requestedRange.match(/bytes=(\d+)-(\d*)/);
              if (match) {
                const start = parseInt(match[1], 10);
                if (start >= size) {
                  res.setHeader("Content-Range", `bytes */${size}`);
                  return res.status(416).end();
                }

                const requestedEnd = match[2] ? parseInt(match[2], 10) : size - 1;
                const end = Math.min(
                  isVideo && !match[2]
                    ? start + maxVideoRangeBytes - 1
                    : requestedEnd,
                  size - 1,
                );
                const chunkSize = end - start + 1;
                res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Length", chunkSize);
                res.setHeader("Content-Type", contentType);
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                res.status(206);
                const readStream = sdkFile.createReadStream({ start, end });
                readStream.once("error", (streamError) => {
                  console.error(`[public-objects] Stream failed for ${filePath}:`, streamError);
                  if (!res.headersSent) {
                    res.status(502).json({ error: "Unable to stream file" });
                  } else {
                    res.destroy(streamError);
                  }
                });
                return readStream.pipe(res);
              }
            }

            // Full file stream
            res.setHeader("Content-Type", contentType);
            res.setHeader("Accept-Ranges", "bytes");
            if (size) res.setHeader("Content-Length", size);
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            const readStream = sdkFile.createReadStream();
            readStream.once("error", (streamError) => {
              console.error(`[public-objects] Stream failed for ${filePath}:`, streamError);
              if (!res.headersSent) {
                res.status(502).json({ error: "Unable to stream file" });
              } else {
                res.destroy(streamError);
              }
            });
            return readStream.pipe(res);
          }
        } catch (_sdkErr) {
          // SDK auth/access failed for this bucket → fall through to legacy strategies
        }

        // ── Strategy 3: sidecar GCS token (legacy) ───────────────────────────
        try {
          const gcsToken = await getSidecarGCSToken();
          if (gcsToken) {
            const gcsUrl = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectName)}?alt=media`;
            const upstream = await fetch(gcsUrl, {
              headers: { Authorization: `Bearer ${gcsToken}` },
            });
            if (upstream.ok) {
              const ct = upstream.headers.get("content-type") || "application/octet-stream";
              const cl = upstream.headers.get("content-length");
              res.setHeader("Content-Type", ct);
              res.setHeader("Accept-Ranges", "bytes");
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
              if (cl) res.setHeader("Content-Length", cl);
              return res.send(Buffer.from(await upstream.arrayBuffer()));
            }
          }
        } catch (_tokenErr) {
          // Token exchange failed → fall through
        }
      }

      // Fallback B: legacy CMS assets originally stored on Imgur.
      // Imgur IDs are short alphanumeric hashes (all existing assets are 7 chars), so we only
      // apply this fallback to hash-shaped names. Human-named files that simply aren't in
      // Object Storage yet get a clean 404 instead of a misleading redirect.
      //
      // IMPORTANT: we PROXY the Imgur content instead of issuing a 302 redirect.
      // A redirect to i.imgur.com causes Safari's ITP (Intelligent Tracking Prevention)
      // to classify imgur.com as a cross-site tracker and block the media element,
      // showing "Ce contenu est bloqué" to the user. By proxying server-side the browser
      // only sees rebond.pro as the media origin and ITP never triggers.
      // Range requests are forwarded so that video seeking still works.
      const cmsMatch = filePath.match(/^cms\/([A-Za-z0-9]{5,8})\.([a-zA-Z0-9]+)$/);
      if (cmsMatch) {
        const imgurUrl = `https://i.imgur.com/${cmsMatch[1]}.${cmsMatch[2]}`;
        try {
          const upstreamHeaders: Record<string, string> = {};
          if (req.headers.range) upstreamHeaders["Range"] = req.headers.range;
          const upstream = await fetch(imgurUrl, { headers: upstreamHeaders });
          if (upstream.ok || upstream.status === 206) {
            const ct = upstream.headers.get("content-type") || "application/octet-stream";
            const cl = upstream.headers.get("content-length");
            const cr = upstream.headers.get("content-range");
            res.setHeader("Content-Type", ct);
            res.setHeader("Accept-Ranges", "bytes");
            // Short TTL — Imgur URLs are legacy; don't cache forever in case asset changes.
            res.setHeader("Cache-Control", "public, max-age=3600");
            if (cl) res.setHeader("Content-Length", cl);
            if (cr) res.setHeader("Content-Range", cr);
            res.status(upstream.status);
            const { Readable } = await import("stream");
            return (Readable as any).fromWeb(upstream.body).pipe(res);
          }
        } catch (_proxyErr) {
          // Proxy failed (network error etc.) — fall back to a redirect as last resort.
        }
        return res.redirect(302, imgurUrl);
      }

      return res.status(404).json({ error: "File not found" });
    } catch (error) {
      console.error("Error serving public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Temporary: re-uploads all CMS Imgur images to Object Storage with public:true ACL.
  // Run once in production if files were previously saved without publicRead ACL.
  // Remove after confirmed working.
  app.post("/api/admin/migrate-cms-reupload-public", requireAdmin, async (req: any, res) => {
    try {
      const bucketName = process.env.CMS_ASSETS_BUCKET_ID
        || (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0].trim().replace(/^\//, "").split("/")[0];
      if (!bucketName) return res.status(500).json({ error: "CMS_ASSETS_BUCKET_ID not configured" });

      const imgurPaths = new Set<string>();
      const IMGUR_HASH_RE = /public-objects\/cms\/([A-Za-z0-9]+\.[a-zA-Z0-9]+)/g;

      const [mods, blogs, masters, classes, emails] = await Promise.all([
        pool.query(`SELECT content_blocks::text AS t FROM modules WHERE content_blocks::text LIKE '%public-objects/cms%'`),
        pool.query(`SELECT cover_image AS t FROM blog_posts WHERE cover_image LIKE '%public-objects/cms%'`),
        pool.query(`SELECT hero_image AS t FROM masterclasses WHERE hero_image LIKE '%public-objects/cms%'`),
        pool.query(`SELECT hero_image AS t FROM classes WHERE hero_image LIKE '%public-objects/cms%'`),
        pool.query(`SELECT body_html AS t FROM custom_email_templates WHERE body_html LIKE '%public-objects/cms%'`),
      ]);

      for (const result of [mods, blogs, masters, classes, emails]) {
        for (const row of result.rows) {
          if (!row.t) continue;
          let m: RegExpExecArray | null;
          IMGUR_HASH_RE.lastIndex = 0;
          while ((m = IMGUR_HASH_RE.exec(row.t)) !== null) {
            imgurPaths.add(m[1]);
          }
        }
      }

      const allPaths = Array.from(imgurPaths);
      const results: { path: string; status: string }[] = [];

      let firstError: string | null = null;

      for (const imgurPath of allPaths) {
        const cleanPath = imgurPath.replace(/\?.*$/, "");
        const imgurUrl = `https://i.imgur.com/${cleanPath}`;
        const gcsObjectName = `public/cms/${cleanPath}`;

        try {
          const imgResponse = await fetch(imgurUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
              "Referer": "https://imgur.com/",
            },
          });
          if (!imgResponse.ok) {
            const status = `http-${imgResponse.status}`;
            if (!firstError) { firstError = `Imgur ${cleanPath}: ${status}`; console.error("[reupload-cms]", firstError); }
            results.push({ path: cleanPath, status });
            continue;
          }

          const contentType = imgResponse.headers.get("content-type") || "application/octet-stream";
          const buffer = Buffer.from(await imgResponse.arrayBuffer());

          // Use signed PUT URL — bypasses service-account IAM (file.save() needs GET which is denied).
          const signedPutUrl = await signObjectURL({
            bucketName,
            objectName: gcsObjectName,
            method: "PUT",
            ttlSec: 900,
          });
          const putResponse = await fetch(signedPutUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: buffer,
          });
          if (!putResponse.ok) {
            throw new Error(`GCS PUT ${putResponse.status}: ${await putResponse.text()}`);
          }

          results.push({ path: cleanPath, status: "uploaded" });
        } catch (err: any) {
          const msg = `error: ${err.message}`;
          if (!firstError) { firstError = `${cleanPath}: ${err.message}`; console.error("[reupload-cms]", firstError); }
          results.push({ path: cleanPath, status: msg });
        }
      }

      const uploaded = results.filter(r => r.status === "uploaded").length;
      const errors = results.filter(r => r.status !== "uploaded").length;
      res.json({ total: allPaths.length, uploaded, errors, results });
    } catch (error: any) {
      console.error("[migrate-cms-reupload-public]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── CMS Assets registry ────────────────────────────────────────────────────
  // Tracks filenames in Object Storage public/cms/. LIST permission is denied
  // on the service account, so this table is the authoritative catalogue.

  app.get("/api/admin/cms-assets", requireAdmin, async (_req, res) => {
    try {
      const assets = await db.select().from(cmsAssets).orderBy(asc(cmsAssets.uploadedAt));
      res.json(assets.map(a => ({ ...a, url: `/public-objects/cms/${a.filename}` })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/cms-assets", requireAdmin, async (req, res) => {
    try {
      const { filename, label, tags } = req.body as { filename: string; label?: string; tags?: string[] };
      if (!filename?.trim()) return res.status(400).json({ error: "filename requis" });
      const [asset] = await db.insert(cmsAssets).values({ filename: filename.trim(), label: label?.trim() || null, tags: tags ?? [] }).returning();
      res.json({ ...asset, url: `/public-objects/cms/${asset.filename}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Upload a new image directly into the app's accessible Object Storage bucket
  // (CMS_ASSETS_BUCKET_ID) and register it in the cms_assets catalogue in one step.
  app.post("/api/admin/cms-assets/upload", requireAdmin, wrapMulter(cmsAssetUpload.single("file")), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

      const objectStorageService = new ObjectStorageService();
      const bucketId = objectStorageService.getCmsBucketId();

      const ext = (req.file.originalname.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const baseName = req.file.originalname
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "asset";
      const filename = `${baseName}-${Date.now()}.${ext}`;

      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(`public/cms/${filename}`);
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
      });

      const { label, tags } = req.body as { label?: string; tags?: string };
      const parsedTags = tags ? JSON.parse(tags) : [];

      const [asset] = await db.insert(cmsAssets).values({
        filename,
        label: label?.trim() || null,
        tags: parsedTags,
      }).returning();

      res.json({ ...asset, url: `/public-objects/cms/${asset.filename}` });
    } catch (e: any) {
      console.error("[cms-assets/upload]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Chunked video upload (bypasses the Replit/GFE 32 MB proxy body limit) ──
  // Strategy: chunks are accumulated server-side, then written to GCS in one
  // file.save() call on the last chunk. This avoids createResumableUpload()
  // which makes an outgoing HTTPS request that fails with "fetch failed" in
  // some Replit environments.
  //
  // Step 1: client POSTs metadata → server creates an in-memory session (no GCS call).
  app.post("/api/admin/cms-assets/video-upload-init", requireAdmin, async (req, res) => {
    try {
      const { originalFilename, fileSize, contentType, label } =
        req.body as { originalFilename: string; fileSize: number; contentType: string; label?: string };

      if (!originalFilename || !fileSize || !contentType) {
        return res.status(400).json({ error: "originalFilename, fileSize et contentType sont requis" });
      }

      const objectStorageService = new ObjectStorageService();
      const bucketId = objectStorageService.getCmsBucketId();

      const ext = (originalFilename.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
      const baseName = originalFilename
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "video";
      const filename = `${baseName}-${Date.now()}.${ext}`;
      const objectPath = `public/cms/${filename}`;

      const uploadId = crypto.randomUUID();
      const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB — matches client VIDEO_CHUNK_SIZE

      videoUploadSessions.set(uploadId, {
        bucketId,
        objectPath,
        filename,
        label: label?.trim() || undefined,
        fileSize,
        contentType,
        chunks: [],
      });

      // Auto-cleanup after 2 h in case the client abandons mid-upload.
      setTimeout(() => videoUploadSessions.delete(uploadId), 2 * 3600 * 1000);

      console.log(`[video-upload-init] Session ${uploadId} created for ${filename} (${fileSize} bytes)`);
      res.json({
        uploadId,
        filename,
        chunkSize: CHUNK_SIZE,
        totalChunks: Math.ceil(fileSize / CHUNK_SIZE),
      });
    } catch (e: any) {
      console.error("[video-upload-init]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Step 2: client POSTs each chunk as multipart (≤25 MB) → server buffers it.
  // On the last chunk the server assembles all chunks and saves to GCS via
  // file.save() — the same proven path used for image uploads.
  app.post(
    "/api/admin/cms-assets/video-chunk",
    requireAdmin,
    wrapMulter(videoChunkUpload.single("chunk")),
    async (req: any, res) => {
      try {
        const { uploadId, chunkEnd } =
          req.body as { uploadId: string; chunkStart: string; chunkEnd: string };

        const session = videoUploadSessions.get(uploadId);
        if (!session) return res.status(404).json({ error: "Session inconnue ou expirée" });
        if (!req.file) return res.status(400).json({ error: "Pas de chunk reçu" });

        // Accumulate chunk in memory.
        session.chunks.push(req.file.buffer);
        const receivedBytes = parseInt(chunkEnd, 10);
        const isLast = receivedBytes >= session.fileSize;

        if (!isLast) {
          return res.json({ received: true, uploadedBytes: receivedBytes });
        }

        // Last chunk: assemble all buffers and save to GCS in one call.
        let fullBuffer = Buffer.concat(session.chunks);
        session.chunks = []; // free memory immediately

        // Apply ffmpeg -movflags +faststart for MP4 uploads so the moov atom
        // is at the start of the file — browsers can then begin playback
        // immediately without downloading the entire file first.
        if (session.contentType === "video/mp4" || session.filename.toLowerCase().endsWith(".mp4")) {
          const tmpIn  = `/tmp/upload-in-${Date.now()}.mp4`;
          const tmpOut = `/tmp/upload-out-${Date.now()}.mp4`;
          try {
            const { writeFileSync, readFileSync, unlinkSync, existsSync } = await import("fs");
            const { spawn } = await import("child_process");
            writeFileSync(tmpIn, fullBuffer);
            await new Promise<void>((resolve, reject) => {
              const proc = spawn("ffmpeg", ["-y", "-i", tmpIn, "-movflags", "+faststart", "-codec", "copy", tmpOut]);
              let stderr = "";
              proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
              proc.on("close", (code: number) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
              });
            });
            fullBuffer = readFileSync(tmpOut);
            console.log(`[video-chunk] faststart applied: moov now at offset ${fullBuffer.indexOf(Buffer.from("moov"))} bytes`);
          } catch (ffErr: any) {
            // Non-fatal: log and continue with the original buffer
            console.warn(`[video-chunk] ffmpeg faststart failed, uploading as-is: ${ffErr.message}`);
          } finally {
            const { unlinkSync, existsSync } = await import("fs");
            try { if (existsSync(tmpIn))  unlinkSync(tmpIn);  } catch (_) {}
            try { if (existsSync(tmpOut)) unlinkSync(tmpOut); } catch (_) {}
          }
        }

        const gcsFile = objectStorageClient.bucket(session.bucketId).file(session.objectPath);

        // Retry up to 3 times with exponential backoff (mirrors /api/upload pattern).
        const MAX_RETRIES = 3;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Strategy 2 of /public-objects proxies the stream with range-request
            // support, so video seeking works even without publicRead ACL.
            await gcsFile.save(fullBuffer, {
              contentType: session.contentType,
            });
            lastErr = null;
            break;
          } catch (saveErr: any) {
            lastErr = saveErr;
            console.warn(`[video-chunk] GCS save attempt ${attempt}/${MAX_RETRIES} failed — ${saveErr?.message ?? saveErr}`);
            if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
        if (lastErr) throw lastErr;

        const [asset] = await db.insert(cmsAssets).values({
          filename: session.filename,
          label: session.label || null,
          tags: [],
        }).returning();

        videoUploadSessions.delete(uploadId);
        console.log(`[video-chunk] Upload complete: ${session.filename} (${fullBuffer.length} bytes)`);
        return res.json({ ...asset, url: `/public-objects/cms/${asset.filename}` });

      } catch (e: any) {
        console.error("[video-chunk]", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // Re-process an existing CMS video: applies ffmpeg -movflags +faststart (moves moov atom
  // to the start of the file so browsers can play without downloading the whole file first)
  // and re-saves with publicRead ACL so /public-objects can serve it via direct GCS redirect.
  app.post("/api/admin/cms-assets/faststart/:filename(*)", requireAdmin, async (req, res) => {
    const { filename } = req.params;
    if (!filename) return res.status(400).json({ error: "filename required" });

    const os = new ObjectStorageService();
    const bucketId = os.getCmsBucketId();
    if (!bucketId) return res.status(500).json({ error: "CMS bucket not configured" });

    const objectPath = `public/cms/${filename}`;
    const gcsFile = objectStorageClient.bucket(bucketId).file(objectPath);

    // Respond immediately — the GCS download + re-upload can take several minutes
    // for large files (50 MB+). Processing happens in the background; check server
    // logs for "[faststart] Done" or "[faststart] ERROR" to confirm completion.
    res.json({ accepted: true, filename, message: "Processing in background — check logs for completion" });

    const tmpIn  = `/tmp/faststart-in-${Date.now()}.mp4`;
    const tmpOut = `/tmp/faststart-out-${Date.now()}.mp4`;
    (async () => {
      try {
        console.log(`[faststart] Downloading ${objectPath} from GCS…`);
        await gcsFile.download({ destination: tmpIn });

        console.log(`[faststart] Running ffmpeg faststart on ${filename}…`);
        await new Promise<void>((resolve, reject) => {
          const { spawn } = require("child_process");
          const proc = spawn("ffmpeg", ["-y", "-i", tmpIn, "-movflags", "+faststart", "-codec", "copy", tmpOut]);
          let stderr = "";
          proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          proc.on("close", (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
          });
        });

        const { readFileSync } = await import("fs");
        const processed = readFileSync(tmpOut);
        console.log(`[faststart] Re-uploading ${filename} (${processed.length} bytes)…`);
        await gcsFile.save(processed, { contentType: "video/mp4" });
        console.log(`[faststart] Done: ${filename} (${processed.length} bytes)`);
      } catch (e: any) {
        console.error(`[faststart] ERROR processing ${filename}:`, e.message);
      } finally {
        const { unlinkSync, existsSync } = await import("fs");
        try { if (existsSync(tmpIn))  unlinkSync(tmpIn);  } catch (_) {}
        try { if (existsSync(tmpOut)) unlinkSync(tmpOut); } catch (_) {}
      }
    })();
  });

  app.put("/api/admin/cms-assets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { label, tags } = req.body as { label?: string; tags?: string[] };
      const [asset] = await db.update(cmsAssets).set({ label: label?.trim() || null, tags: tags ?? [] }).where(eq(cmsAssets.id, id)).returning();
      if (!asset) return res.status(404).json({ error: "Asset non trouvé" });
      res.json({ ...asset, url: `/public-objects/cms/${asset.filename}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/cms-assets/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(cmsAssets).where(eq(cmsAssets.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Seed cms_assets from existing /public-objects/cms/ URLs already in the DB.
  app.post("/api/admin/cms-assets/seed-from-db", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute<{ filename: string }>(sql`
        SELECT DISTINCT split_part(url, '/cms/', 2) AS filename
        FROM (
          SELECT image_url       AS url FROM onboarding_screens  WHERE image_url       LIKE '%/cms/%'
          UNION ALL
          SELECT image_url       AS url FROM offboarding_screens WHERE image_url       LIKE '%/cms/%'
          UNION ALL
          SELECT cover_image     AS url FROM blog_posts          WHERE cover_image     LIKE '%/cms/%'
          UNION ALL
          SELECT hero_image      AS url FROM masterclasses       WHERE hero_image      LIKE '%/cms/%'
          UNION ALL
          SELECT hero_image      AS url FROM classes             WHERE hero_image      LIKE '%/cms/%'
          UNION ALL
          SELECT cover_image_url AS url FROM community_groups    WHERE cover_image_url LIKE '%/cms/%'
          UNION ALL
          SELECT elem->>'url'    AS url
          FROM modules m, jsonb_array_elements(m.content_blocks) elem
          WHERE m.content_blocks IS NOT NULL
            AND elem->>'type' = 'image'
            AND elem->>'url' LIKE '%/cms/%'
        ) sub
        WHERE url IS NOT NULL AND url != ''
          AND split_part(url, '/cms/', 2) LIKE '%.%'
          AND split_part(url, '/cms/', 2) NOT LIKE '%/%'
      `);
      const filenames: string[] = (Array.isArray(rows) ? rows : (rows as any).rows ?? [])
        .map((r: any) => r.filename)
        .filter((f: string) => f && !f.includes("/") && f.includes("."));

      let inserted = 0;
      for (const filename of filenames) {
        try {
          const insertedRows = await db.insert(cmsAssets).values({ filename }).onConflictDoNothing().returning({ id: cmsAssets.id });
          if (insertedRows.length > 0) inserted++;
        } catch {}
      }
      res.json({ total: filenames.length, inserted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────

  // Diagnostic: tests all object-storage access paths.
  // Remove after migration confirmed.
  app.get("/api/admin/diag-cms-storage", requireAdmin, async (req: any, res) => {
    try {
      const searchPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0].trim();
      const bucketName = searchPaths.replace(/^\//, "").split("/")[0];
      const checks: Record<string, any> = { bucketName };

      // 1. signObjectURL GET (with credential auth fix)
      try {
        const signedGet = await signObjectURL({ bucketName, objectName: "public/cms/_diag_test.txt", method: "GET", ttlSec: 60 });
        checks.signedGet = { ok: true, url: signedGet.substring(0, 80) + "..." };
      } catch (e: any) {
        checks.signedGet = { error: e.message };
      }

      // 2. signObjectURL PUT (with credential auth fix)
      try {
        const signedPut = await signObjectURL({ bucketName, objectName: "public/cms/_diag_test.txt", method: "PUT", ttlSec: 60 });
        checks.signedPut = { ok: true, url: signedPut.substring(0, 80) + "..." };
      } catch (e: any) {
        checks.signedPut = { error: e.message };
      }

      // 3. GCS token GET — can we read the numbered file that IS in Object Storage?
      const numberedObjName = "public/cms/38 - 00U3wop.jpg";
      try {
        const gcsToken = await getSidecarGCSToken();
        if (!gcsToken) {
          checks.gcsTokenGet = { error: "getSidecarGCSToken returned null" };
        } else {
          // GCS JSON API: object name must be fully encoded (slashes → %2F)
          const gcsUrl = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(numberedObjName)}?alt=media`;
          const r = await fetch(gcsUrl, { headers: { Authorization: `Bearer ${gcsToken}` } });
          checks.gcsTokenGet = { status: r.status, ok: r.ok, contentType: r.headers.get("content-type"), size: r.headers.get("content-length") };
        }
      } catch (e: any) {
        checks.gcsTokenGet = { error: e.message };
      }

      // 4. Sidecar direct-upload endpoint (undocumented — might exist)
      try {
        const gcsToken2 = await getSidecarGCSToken();
        const sidecarUploadUrl = "http://127.0.0.1:1106/object-storage/upload";
        const fr = new FormData();
        fr.append("object_name", "public/cms/_diag_upload_test.txt");
        fr.append("bucket_name", bucketName);
        fr.append("file", new Blob(["diag"], { type: "text/plain" }), "_diag_upload_test.txt");
        const upRes = await fetch(sidecarUploadUrl, {
          method: "POST",
          headers: gcsToken2 ? { Authorization: `Bearer ${gcsToken2}` } : {},
          body: fr,
        });
        checks.sidecarUpload = { status: upRes.status, body: (await upRes.text()).substring(0, 200) };
      } catch (e: any) {
        checks.sidecarUpload = { error: e.message };
      }

      // 5. SDK IAM-based getSignedUrl (uses signBlob API, not sidecar)
      try {
        const bucket2 = objectStorageClient.bucket(bucketName);
        const [url] = await bucket2.file("public/cms/_diag_test.txt").getSignedUrl({
          action: "read",
          expires: Date.now() + 60000,
        });
        checks.sdkSignedUrl = { ok: true, url: url.substring(0, 80) + "..." };
      } catch (e: any) {
        checks.sdkSignedUrl = { error: e.message };
      }

      res.json(checks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve private objects (with authentication and ACL check)
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const objectStorageService = new ObjectStorageService();
    try {
      console.log("[ObjectStorage] Fetching object:", req.path, "for user:", userId);
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );

      let canAccess = false;
      try {
        canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: userId,
          requestedPermission: undefined, // defaults to READ
        });
      } catch (aclErr: any) {
        // GCP metadata API unavailable (e.g. WIF token-exchange failure).
        // Fall back to path-based ownership: object paths are scoped as
        //   /objects/<category>/<ownerId>/...
        // so we check that the third segment matches the authenticated user.
        const segments = req.path.split("/"); // ['', 'objects', category, ownerId, ...]
        const pathOwnerId = segments[3];
        if (pathOwnerId && pathOwnerId === String(userId)) {
          canAccess = true;
          console.warn("[ObjectStorage] ACL metadata unavailable — granted access via path-based ownership for user:", userId);
        } else {
          console.warn("[ObjectStorage] ACL metadata unavailable and path ownership mismatch. Denying access.", { pathOwnerId, userId });
        }
      }

      // Secondary fallback: when the ACL check returned false (no ACL stored or
      // denied) and the requester is NOT the path owner, check whether the path
      // owner is an admin.  Admin-uploaded files (content-block audio/video) are
      // intended to be accessible to all authenticated learners.
      if (!canAccess) {
        const segments = req.path.split("/"); // ['', 'objects', category, ownerId, ...]
        const pathOwnerId = segments[3];
        if (pathOwnerId && pathOwnerId !== String(userId)) {
          try {
            const owner = await storage.getUserById(pathOwnerId);
            if (owner?.role?.toLowerCase() === "admin") {
              canAccess = true;
              console.log("[ObjectStorage] Granted read access to admin-owned content for user:", userId);
            }
          } catch {
            // ignore — keep canAccess = false
          }
        }
      }

      console.log("[ObjectStorage] Access check result:", canAccess);
      if (!canAccess) {
        console.log("[ObjectStorage] Access denied for user:", userId);
        return res.sendStatus(401);
      }
      console.log("[ObjectStorage] Streaming file to response");

      // Support Range requests (required by browsers for <audio>/<video> elements)
      const rangeHeader = req.headers['range'];
      if (rangeHeader) {
        const [metadata] = await objectFile.getMetadata();
        const fileSize = parseInt(String(metadata.size), 10);
        const [unit, rangeValue] = rangeHeader.split('=');
        if (unit !== 'bytes' || !rangeValue) {
          return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        }
        const [startStr, endStr] = rangeValue.split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
          return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': (metadata.contentType as string) || 'application/octet-stream',
          'Cache-Control': CACHE.PRIVATE,
        });
        objectFile.createReadStream({ start, end }).pipe(res);
      } else {
        res.set('Accept-Ranges', 'bytes');
        objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      console.error("Error checking object access for path:", req.path, error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for object entity (scoped to authenticated user)
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(userId);
    res.json({ uploadURL });
  });

  // Set ACL policy after upload (for images/assets)
  app.put("/api/objects/set-acl", isAuthenticated, async (req, res) => {
    if (typeof req.body.objectURL !== "string" || !req.body.objectURL) {
      return res.status(400).json({ error: "objectURL is required" });
    }

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.objectURL,
        {
          owner: userId,
          // Public visibility for uploaded assets (images, etc)
          visibility: "public",
        },
        userId,
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      if (error instanceof ObjectAclAccessDeniedError) {
        return res.status(403).json({ error: "Object access denied" });
      }
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error setting object ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== MEDIA UPLOAD ROUTE (Audio/Video Recording) =====
  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for recordings
    fileFilter: (req, file, cb) => {
      // Accept any audio/* type (covers mp3/mpeg, wav, m4a/x-m4a, ogg, aac, flac, webm…)
      // plus the specific video formats used by the recording feature.
      const isAudio = file.mimetype.startsWith('audio/');
      const allowedVideoMimes = ['video/webm', 'video/mp4', 'video/quicktime'];
      if (isAudio || allowedVideoMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only audio and video files are allowed.`));
      }
    }
  });

  // Serve locally-stored upload files (fallback when GCS is unavailable in dev).
  // NOTE: these files are ephemeral in production — do not rely on this path
  // for persistent media. The primary upload path writes to GCS (/objects/).
  app.get("/api/static-uploads/:filename", isAuthenticated, (req: any, res) => {
    const filename = req.params.filename;
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const uploadsDir = path.join(process.cwd(), "server", "uploads");
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[StaticUploads] File not found (ephemeral storage wiped?): ${filename}`);
      return res.status(404).json({ error: "File not found — please re-upload this media file." });
    }
    // Resolve MIME type explicitly so browsers can play audio/video without guessing.
    const ext = path.extname(filename).toLowerCase();
    const MIME: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
    };
    const contentType = MIME[ext] || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  });

  app.post("/api/upload", isAuthenticated, mediaUpload.single('file'), async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Helper: filesystem fallback (used when GCS/sidecar is unavailable in dev)
    const fallbackToLocalStorage = async () => {
      const uploadsDir = path.join(process.cwd(), "server", "uploads");
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const ext = path.extname(req.file!.originalname).toLowerCase() || ".bin";
      const filename = `${userId}_${Date.now()}${ext}`;
      await fs.promises.writeFile(path.join(uploadsDir, filename), req.file!.buffer);
      console.log(`[Upload] Stored locally (GCS unavailable): server/uploads/${filename}`);
      return `/api/static-uploads/${filename}`;
    };

    try {
      // Use CMS_ASSETS_BUCKET_ID (the repl's own accessible bucket) for all uploads.
      // DEFAULT_OBJECT_STORAGE_BUCKET_ID points to a foreign bucket inherited from the
      // source repl whose SA has no write access (storage.objects.create → 403).
      // CMS_ASSETS_BUCKET_ID always refers to this repl's own writable bucket.
      const uploadBucketId =
        process.env.CMS_ASSETS_BUCKET_ID ||
        process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
      if (!uploadBucketId) {
        return res.status(503).json({ error: "Le service de stockage est temporairement indisponible. Veuillez réessayer dans quelques instants.", code: "GCS_UNAVAILABLE" });
      }
      const objectId = randomUUID();
      // Object path keeps the same structure so path-based auth in /objects/ works:
      //   uploads/<userId>/<objectId>  → segments[3] == userId
      const objectName = `uploads/${userId}/${objectId}`;

      // Direct upload via GCS client (WIF credentials)
      const file = objectStorageClient.bucket(uploadBucketId).file(objectName);
      // Bake the ACL policy directly into the file.save() metadata so it is set
      // atomically with the upload itself — this avoids the separate
      // setObjectAclPolicy() call that can fail silently when the WIF sidecar
      // token exchange times out (the separate call requires a second round-trip).
      const aclPolicyJson = JSON.stringify({ owner: String(userId), visibility: "public" });

      // Retry up to 3 times with exponential backoff to survive transient WIF sidecar timeouts.
      const MAX_GCS_RETRIES = 3;
      let lastSaveError: unknown = null;
      for (let attempt = 1; attempt <= MAX_GCS_RETRIES; attempt++) {
        try {
          await file.save(req.file.buffer, {
            contentType: req.file.mimetype,
            metadata: { owner: String(userId), "custom:aclPolicy": aclPolicyJson },
          });
          lastSaveError = null;
          break;
        } catch (saveErr: any) {
          lastSaveError = saveErr;
          console.warn(`[Upload] GCS save attempt ${attempt}/${MAX_GCS_RETRIES} failed — code=${saveErr?.code ?? 'n/a'} message="${saveErr?.message ?? saveErr}"`);
          if (attempt < MAX_GCS_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
      }
      if (lastSaveError) throw lastSaveError;

      // Normalized path: /objects/uploads/<userId>/<objectId>
      // The /objects/ serving route validates ownership via path segment [3].
      const normalizedPath = `/objects/uploads/${userId}/${objectId}`;

      // Secondary ACL call to satisfy the Replit blueprint ACL convention.
      // Non-fatal: the metadata above already encodes the policy.
      try {
        await setObjectAclPolicy(file, { owner: String(userId), visibility: "public" });
      } catch (aclErr: any) {
        console.warn("[Upload] ACL set (secondary call) failed — metadata already baked in:", aclErr?.message ?? aclErr);
      }

      console.log(`[Upload] Stored on GCS: ${normalizedPath}`);
      res.json({ 
        url: normalizedPath,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      const errCode = error?.code ?? 'n/a';
      console.error(`[Upload] GCS upload failed after ${3} retries — code=${errCode} message="${errMsg}"`);

      // In production, never silently fall back to ephemeral local storage —
      // files there disappear on every redeploy and create invisible data loss.
      // Return a clear 503 so the caller knows to retry or report the issue.
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          error: "Le service de stockage est temporairement indisponible. Veuillez réessayer dans quelques instants.",
          code: "GCS_UNAVAILABLE",
        });
      }

      // Dev/CI: fall back to local disk for convenience.
      try {
        const localUrl = await fallbackToLocalStorage();
        res.json({
          url: localUrl,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
        });
      } catch (fsError) {
        console.error("[Upload] Local storage fallback also failed:", fsError);
        res.status(500).json({ error: "Failed to upload media" });
      }
    }
  });

  // ===== E-LEARNING CMS EXPORT ENDPOINT =====
  // Exporte l'état actuel de la prod vers Object Storage + renvoie le JSON pour téléchargement
  app.post("/api/admin/export-elearning-cms", requireAdmin, async (req: any, res) => {
    try {
      console.log('[E-Learning CMS Export] Starting export...');
      const { db } = await import("./db");
      const { masterclasses, classes, modules, moduleSequence } = await import("../shared/schema");
      const mcRows = await db.select().from(masterclasses).orderBy(masterclasses.order);
      const clRows = await db.select().from(classes).orderBy(classes.order);
      const modRows = await db.select().from(modules).orderBy(modules.order);
      const seqRows = await db.select().from(moduleSequence);
      const exportData = {
        masterclasses: mcRows,
        classes: clRows,
        modules: modRows,
        module_sequences: seqRows,
        exported_at: new Date().toISOString(),
        source_db: "production",
      };
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `rebond-cms-backup-${timestamp}.json`;
      console.log(`[E-Learning CMS Export] Sending download: ${mcRows.length} MC, ${clRows.length} classes, ${modRows.length} modules`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(JSON.stringify(exportData, null, 2));
    } catch (error: any) {
      console.error('[E-Learning CMS Export] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // ----------------------------------------------------------------------------
  // EXTERNAL CRON ENDPOINT - For scheduled job sync from external schedulers
  // ----------------------------------------------------------------------------
  // This endpoint allows external services (cron-job.org, GitHub Actions, etc.)
  // to trigger the daily job sync since Replit deployments hibernate when idle
  // and node-cron cannot execute scheduled tasks reliably.
  // 
  // Usage: POST https://your-app.replit.app/api/cron/run-sync
  // Header: x-cron-secret: <your CRON_SECRET value>
  // ----------------------------------------------------------------------------
  // Helper to validate cron secret
  const validateCronSecret = (req: any, res: any): boolean => {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"] as string | undefined;
    const querySecret = req.query.secret as string | undefined;
    const providedSecret = headerSecret || querySecret;
    
    if (!cronSecret || !providedSecret) {
      console.log("[Cron API] Unauthorized: missing secret");
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }

    const normalizedProvided = decodeURIComponent(providedSecret).trim();
    const normalizedExpected = cronSecret.trim();
    
    if (normalizedProvided !== normalizedExpected) {
      console.log("[Cron API] Unauthorized: secret mismatch", {
        providedLength: normalizedProvided.length,
        expectedLength: normalizedExpected.length,
        providedFirst3: normalizedProvided.substring(0, 3),
        expectedFirst3: normalizedExpected.substring(0, 3),
      });
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  };

  // Helper to register both GET and POST for cron endpoints (external cron services often use GET)
  const registerCronEndpoint = (path: string, handler: (req: any, res: any) => void) => {
    const admission = (req: any, res: any) => {
      void scheduledOperation(`http_admission:${path}`, async () => {
        poolLimit('admissionOnly', true);
        res.setHeader('X-Operation-Id', currentPoolOperation()!.id);
        const finished = new Promise<void>(resolve => { res.once('finish', resolve); res.once('close', resolve); });
        await handler(req, res);
        await finished;
        if (res.statusCode >= 400) poolOutcome('rejected', `http_${res.statusCode}`);
      }, 'external').catch(() => {
        if (!res.headersSent) res.status(503).json({ success: false, code: 'admission_unavailable' });
      });
    };
    app.post(path, admission);
    app.get(path, admission);
  };

  // PHASE 1: Sync France Travail jobs only (async - returns immediately)
  registerCronEndpoint("/api/cron/sync-francetravail", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 1: Starting France Travail sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 1, source: 'france_travail', status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase1', acknowledgement, () => globalJobPoolService.syncSingleSource('france_travail'))
      .then(result => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Phase 1 complete: ${result.inserted} new jobs (${duration}s)`);
      })
      .catch(error => {
        console.error("[Cron API] Phase 1 error:", error.message);
      });
  });

  // STOCK CATCH-UP: the native 1–31 day window only.
  // - includePartenaires=true (default) runs an additional `origineOffre=2`
  //   pass per ROME to surface partner offers (Indeed/Monster/RegionsJob/…)
  //   that the default mix tends to under-represent.
  // The historical endpoints below are tombstones, never collection entries.
  const FT_BACKFILL_RUNNING = { current: null as null | { mode: string; startTime: string; days: number } };
  const FT_DAYS_HARD_CAP = FT_STOCK_MAX_DAYS; // Native stock window only.

  async function runFranceTravailBackfill(opts: { mode: 'stock'; days: number; includePartenaires: boolean; startTime: string }) {
    const { mode, days, includePartenaires, startTime } = opts;
    try {
      await journalPoolOperation({ kind: 'collection', mechanism: 'france_travail_backfill',
        mode: 'stock',
        limits: { days, includePartenaires, windowDays: 31 } }, async () => {
      let totalInserted = 0;
      totalInserted = await globalJobPoolService.syncFranceTravailByRome({
          publieeDepuis: days,
          includePartenaires,
        });
      const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
      console.log(`[Cron API] FT ${mode} catch-up complete: ${totalInserted} new jobs inserted (${duration.toFixed(0)}s, days=${days})`);
      });
    } catch (error: any) {
      console.error(`[Cron API] FT ${mode} catch-up error:`, error?.message || error);
    } finally {
      FT_BACKFILL_RUNNING.current = null;
    }
  }

  function startFranceTravailBackfill(req: any, res: any, mode: 'stock', defaultDays: number) {
    const startTime = new Date().toISOString();
    const requestedDays = ftStockDays(req.query.days ?? defaultDays);
    if (requestedDays === null) {
      return res.status(400).json({
        success: false,
        error: `days must be an integer between 1 and ${FT_DAYS_HARD_CAP}.`,
      });
    }
    const days = Math.max(1, requestedDays);
    const includePartenaires = String(req.query.includePartenaires ?? 'true').toLowerCase() !== 'false';

    if (FT_BACKFILL_RUNNING.current) {
      return res.status(409).json({
        success: false,
        error: 'A France Travail backfill is already running.',
        running: FT_BACKFILL_RUNNING.current,
        hint: 'Wait for the current run to finish before triggering another. Check deployment logs for [Cron API] FT progress.',
      });
    }

    FT_BACKFILL_RUNNING.current = { mode, startTime, days };
    console.log(`[Cron API] FT ${mode} catch-up starting at ${startTime} (days=${days}, includePartenaires=${includePartenaires})`);
    res.json({
      success: true,
      source: 'france_travail',
      mode,
      days,
      includePartenaires,
      status: 'started',
      startTime,
      note: 'Stock refresh, limited to 31 days. Monitor progress with the correlated operation journal.',
    });
    void runFranceTravailBackfill({ mode, days, includePartenaires, startTime });
  }

  registerCronEndpoint("/api/cron/sync-francetravail-stock", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    startFranceTravailBackfill(req, res, 'stock', 31);
  });
  console.log('[Routes] FT stock catch-up endpoint registered: GET/POST /api/cron/sync-francetravail-stock?days=31&includePartenaires=true');

  // Explicit tombstones: old schedulers receive a refusal, not a fake success.
  registerCronEndpoint("/api/cron/sync-francetravail-historical", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    await retiredFtHistory(req, res);
  });

  // Admin-protected alias — same backfill, no CRON_SECRET needed (admin session sufficient)
  app.post("/api/admin/ft-backfill-historical", requireAdmin, (req, res) => {
    void retiredFtHistory(req, res).catch(() => { if (!res.headersSent) res.status(503).json({ error: 'journal_unavailable' }); });
  });

  // Embeddings backfill — computes pgvector embeddings for job-pool rows that are
  // missing one. Semantic search (vectorSearch) only sees rows WHERE embedding IS
  // NOT NULL, so a pool with 0 embeddings silently loses half the search quality.
  // Bounded + resumable: each call drains up to `max` embeddings then returns, so
  // a cron every few minutes gradually brings a ~880k pool to 100% coverage
  // without any single request timing out. Fire-and-forget with an in-process
  // mutex so overlapping triggers don't double-spend OpenAI calls.
  // Auto-chains backfillEmbeddingsChunk calls until the pool reports done:true, so a
  // single trigger fully backfills a ~880k pool without the caller needing to poll
  // and re-POST dozens of times. Small delay between rounds to stay polite to the
  // OpenAI embeddings API. A round cap is a safety backstop against infinite loops,
  // not an expected limit (880k rows / 20k per round ≈ 44 rounds).
  const MAX_BACKFILL_ROUNDS = 200;
  async function drainEmbeddingsUntilDone(max: number): Promise<void> {
    return measureEmbeddingDrain(MAX_BACKFILL_ROUNDS * max, async () => {
    let round = 0;
    let grandProcessed = 0, grandErrors = 0, grandSkipped = 0;
    const overallStart = Date.now();
    while (round < MAX_BACKFILL_ROUNDS) {
      if (isEmbeddingBackfillPaused()) {
        console.log(`[EmbeddingsBackfill] Paused at round ${round} — stopping drain. Call /api/admin/backfill-resume to restart.`);
        return;
      }
      round++;
      let result;
      try {
        result = await backfillEmbeddingsChunk(max);
      } catch (e: any) {
        poolError(e);
        console.error(`[EmbeddingsBackfill] round ${round} failed:`, e?.message);
        break;
      }
      grandProcessed += result.processed;
      grandErrors += result.errors;
      grandSkipped += result.skipped;
      console.log(`[EmbeddingsBackfill] round ${round} finished: processed=${result.processed} errors=${result.errors} skipped=${result.skipped} done=${result.done} (cumulative processed=${grandProcessed})`);
      if (result.done) {
        console.log(`[EmbeddingsBackfill] fully drained after ${round} round(s): ${grandProcessed} processed, ${grandErrors} errors, ${grandSkipped} skipped, in ${Math.round((Date.now() - overallStart) / 1000)}s`);
        return;
      }
      if (result.processed === 0) {
        console.warn(`[EmbeddingsBackfill] no progress in round ${round} despite done=false — stopping auto-chain, will need a manual re-trigger`);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.warn(`[EmbeddingsBackfill] hit safety cap of ${MAX_BACKFILL_ROUNDS} rounds — stopping auto-chain, re-trigger to continue`);
    });
  }

  app.post("/api/admin/backfill-pause", requireAdmin, (_req, res) => {
    setEmbeddingBackfillPaused(true);
    res.json({ success: true, paused: true, note: 'Backfill will stop after the current chunk finishes. Call /api/admin/backfill-resume to restart.' });
  });

  app.post("/api/admin/backfill-resume", requireAdmin, (req, res) => {
    setEmbeddingBackfillPaused(false);
    const nightMode = req.body?.nightMode === true || req.query.nightMode === 'true';
    if (nightMode) setNightMode(true);
    runEmbeddingBackfill(req, res, 10_000);
  });

  const runEmbeddingBackfill = (req: any, res: any, defaultMax: number) => {
    const max = Math.min(Math.max(parseInt(String(req.query.max || defaultMax), 10) || defaultMax, 1), 100_000);
    if (isEmbeddingBackfillPaused()) {
      return res.json({ success: true, status: 'paused', note: 'Backfill is paused. Call /api/admin/backfill-resume to restart.' });
    }
    if (isEmbeddingBackfillRunning()) {
      return res.json({ success: true, status: 'already_running', note: 'An embedding backfill is already in progress; this trigger was ignored.' });
    }
    const startTime = new Date().toISOString();
    res.json({ success: true, status: 'started', max, startTime, note: 'Draining embeddings in the background until full coverage — no need to re-trigger. Poll /api/admin/embedding-coverage or check logs for [EmbeddingsBackfill].' });
    void drainEmbeddingsUntilDone(max);
  };

  registerCronEndpoint("/api/cron/backfill-embeddings", (req, res) => {
    if (!validateCronSecret(req, res)) return;
    runEmbeddingBackfill(req, res, 10_000);
  });

  app.post("/api/admin/backfill-embeddings", requireAdmin, (req, res) => {
    runEmbeddingBackfill(req, res, 10_000);
  });

  // Admin: current embedding coverage — quick way to watch the backfill progress.
  app.get("/api/admin/embedding-coverage", requireAdmin, async (_req, res) => {
    try {
      const coverage = await checkEmbeddingCoverage();
      res.json({ ...coverage, backfillRunning: isEmbeddingBackfillRunning() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'coverage check failed' });
    }
  });

  // Admin: Self-heal runs — returns scrape_runs rows for startup self-heals AND
  // watchdog-triggered catch-ups within the last 7 days so the admin job sources
  // page can surface a warning banner for both trigger paths.
  app.get("/api/admin/self-heal-runs", requireAdmin, async (_req, res) => {
    try {
      const { neonSql } = await import('./db');
      const rows = await neonSql`
        SELECT id, status, started_at, finished_at, duration_ms, valid_jobs_count,
               purged_old_count, purged_closed_count, purged_expired_count,
               error_message, source_id, source_name
        FROM scrape_runs
        WHERE source_id IN ('self_heal', 'watchdog_self_heal')
          AND (
            source_id <> 'watchdog_self_heal'
            OR COALESCE(error_message, '') NOT LIKE 'no_op:%'
          )
          AND started_at > now() - interval '7 days'
        ORDER BY started_at DESC
        LIMIT 50
      `;
      res.json({ runs: rows });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'query failed' });
    }
  });

  // Read-only: opening this panel must never start a check, collection or DDL.
  app.get("/api/admin/source-sync-observation", requireAdmin, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      res.json({ snapshot: await readSourceObservation() });
    } catch {
      res.status(503).json({ error: "Surveillance par source indisponible. Aucune conclusion sur les collectes." });
    }
  });

  // Admin: durable heartbeat for every production sync watchdog check,
  // including checks that correctly no-op because the pool is fresh.
  app.get("/api/admin/sync-watchdog", requireAdmin, async (_req, res) => {
    try {
      const { neonSql } = await import('./db');
      const rows = await neonSql`
        SELECT id, status, started_at, finished_at, duration_ms,
               valid_jobs_count, error_message, source_name
        FROM scrape_runs
        WHERE source_id = 'watchdog_self_heal'
        ORDER BY started_at DESC
        LIMIT 1
      `;
      const run = rows[0] ?? null;
      const result = classifyWatchdogRun(run);
      res.json({
        lastCheckedAt: run?.started_at ?? null,
        lastStatus: run?.status ?? null,
        lastResult: result,
        lastRun: run,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'query failed' });
    }
  });

  // Admin: LinkedIn catch-up — relance le broadcast + le sync ciblé sur "past month"
  // (ou "past week"). Équivalent du backfill historique FT mais limité à 30 jours max
  // (contrainte LinkedIn côté API non-authentifiée). Fire-and-forget.
  app.post("/api/admin/linkedin-catchup", requireAdmin, async (req, res) => {
    const range = String(req.query.range || 'past month') as '24hr' | 'past week' | 'past month';
    const allowed = ['24hr', 'past week', 'past month'];
    if (!allowed.includes(range)) {
      return res.status(400).json({ error: `range must be one of: ${allowed.join(', ')}` });
    }
    const startTime = new Date().toISOString();
    res.json({
      success: true,
      mode: 'linkedin-catchup',
      range,
      status: 'started',
      startTime,
      note: `Running broadcast (4 terms × 8 regions × 50) + targeted sync (~70 keywords × 4 locations × 25), both filtered to "${range}". Expect 20–40 min. Check logs for [GlobalJobPool] LinkedIn progress.`,
    });
    void (async () => {
      try {
        console.log(`[Admin] LinkedIn catch-up starting (range=${range})`);
        const broadcastInserted = await globalJobPoolService.syncLinkedInBroadcast({ dateSincePosted: range, limitPerQuery: 50 });
        console.log(`[Admin] LinkedIn catch-up broadcast done: +${broadcastInserted} new`);
        const targetedInserted = await globalJobPoolService.syncLinkedIn({ dateSincePosted: range });
        console.log(`[Admin] LinkedIn catch-up targeted done: +${targetedInserted} new (total: +${broadcastInserted + targetedInserted})`);
      } catch (err: any) {
        console.error('[Admin] LinkedIn catch-up error:', err?.message || err);
      }
    })();
  });

  // Admin: add a single LinkedIn job to the pool by its public URL.
  // Useful when a job appears in a LinkedIn alert email but is missing from the pool.
  app.post("/api/admin/add-linkedin-job", requireAdmin, async (req, res) => {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing required field: url (LinkedIn job URL)' });
    }
    try {
      const result = await globalJobPoolService.addLinkedInJobByUrl(url);
      res.json(result);
    } catch (error: any) {
      console.error('[Admin] add-linkedin-job error:', error?.message || error);
      res.status(500).json({ success: false, error: error?.message || 'Internal error' });
    }
  });

  // STOCK FULL: Sync the COMPLETE APEC catalogue.
  //
  // Two modes:
  //   ?segmented=false (default, legacy): single global walk. Hits the
  //     undocumented ~14k cap of /rechercheOffre and only collects the most
  //     recent slice of the catalogue. Fast (~8 min) but ceiling-bound.
  //   ?segmented=true: dept × contract walk via fetchAllJobsSegmented. Bypasses
  //     the cap by filtering each query on `lieux: [deptCode]` (1-95). Reaches
  //     50-80k+ unique offers in ~12-15 min. Use this for the bootstrap and
  //     for periodic deep refreshes.
  //
  // Enrichment (texteHtml / texteHtmlProfil): ~30 ms per NEW offer. For the
  // segmented bootstrap, prefer ?skipEnrichment=true on the first run, then
  // schedule a separate enrichment pass — otherwise descriptions for the
  // 30-50k newly discovered offers will add 15-25 min to the run and risk
  // tripping the deployment reaper.
  //
  // Concurrency: a global lock prevents two APEC stock runs from overlapping
  // (the API is rate-limited and the bulk insert path doesn't deduplicate
  // across concurrent runs).
  const APEC_STOCK_RUNNING = { current: null as null | { mode: string; startTime: string; segmented: boolean } };

  registerCronEndpoint("/api/cron/sync-apec-stock", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    if (await respondIfApecPaused(res)) return;

    const startTime = new Date().toISOString();
    const skipEnrichment = String(req.query.skipEnrichment || '').toLowerCase() === 'true';
    const segmented = String(req.query.segmented || '').toLowerCase() === 'true';

    if (APEC_STOCK_RUNNING.current) {
      return res.status(409).json({
        success: false,
        error: 'An APEC stock sync is already running.',
        running: APEC_STOCK_RUNNING.current,
        hint: 'Wait for the current run to finish (typically 8-15 min). Check deployment logs for [Cron API] APEC Stock progress.',
      });
    }

    APEC_STOCK_RUNNING.current = { mode: 'stock', startTime, segmented };
    console.log(`[Cron API] APEC Stock catch-up starting at ${startTime} (segmented=${segmented}, skipEnrichment=${skipEnrichment})`);

    res.json({
      success: true,
      source: 'apec',
      mode: 'stock',
      segmented,
      skipEnrichment,
      status: 'started',
      startTime,
      note: segmented
        ? 'Segmented run: walks the 95 French depts (+ adaptive contract sub-segmentation for dense ones). Expect ~12-15 min for the search walk + 0-25 min for enrichment. Use ?skipEnrichment=true on first run to stay well under the 30-min reaper.'
        : 'Flat run: capped at ~14k results by the API. Use ?segmented=true to bypass the cap and reach 50-80k+ offers.',
    });

    globalJobPoolService.syncApecStock({ skipEnrichment, segmented })
      .then(inserted => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] APEC Stock catch-up complete: ${inserted} new jobs inserted (${duration.toFixed(0)}s, segmented=${segmented})`);
      })
      .catch(error => {
        console.error('[Cron API] APEC Stock catch-up error:', error?.message || error);
      })
      .finally(() => {
        APEC_STOCK_RUNNING.current = null;
      });
  });

  console.log('[Routes] APEC stock catch-up endpoint registered: GET/POST /api/cron/sync-apec-stock?segmented=true&skipEnrichment=true');

  // PHASE 2: Sync Adzuna jobs only (async - returns immediately)
  registerCronEndpoint("/api/cron/sync-adzuna", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 2: Starting Adzuna sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 2, source: 'adzuna', status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase2', acknowledgement, () => globalJobPoolService.syncSingleSource('adzuna'))
      .then(result => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Phase 2 complete: ${result.inserted} new jobs (${duration}s)`);
      })
      .catch(error => {
        console.error("[Cron API] Phase 2 error:", error.message);
      });
  });

  // Adzuna STOCK catch-up: exhaustive segmented walk (category × FR top-cities).
  // Bypasses the silent ~5 000-result cap of the flat /search endpoint by
  // walking every Adzuna category and adaptively sub-segmenting dense ones.
  // Concurrency-locked (HTTP 409 if a run is already in progress).
  //
  //   ?segmented=true (default true) → category × city walk, ~150-450k offers
  //   ?segmented=false               → flat per-category walk, capped at ~150k
  //   ?country=FR                    → ISO country code (default FR)
  //   ?maxDaysOld=N                  → freshness window; omit for full historical
  //   ?subSegmentThreshold=N         → trigger city sub-walk above this count
  //   ?throttleMs=N                  → inter-call delay (default 300)
  const ADZUNA_STOCK_RUNNING = { current: null as null | { startTime: string; segmented: boolean; country: string; maxDaysOld?: number } };

  registerCronEndpoint("/api/cron/sync-adzuna-stock", async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    const startTime = new Date().toISOString();
    const segmented = req.query.segmented === undefined
      ? true
      : String(req.query.segmented).toLowerCase() === 'true';
    const country = String(req.query.country || 'FR').toUpperCase();
    const ADZUNA_SUPPORTED_COUNTRIES = new Set(['FR', 'GB', 'US', 'DE', 'CA', 'AU', 'NL', 'IT', 'ES', 'PL', 'BR', 'IN', 'NZ', 'AT', 'BE', 'CH', 'MX', 'SG', 'ZA']);
    if (!ADZUNA_SUPPORTED_COUNTRIES.has(country)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported country code "${country}". Adzuna supports: ${Array.from(ADZUNA_SUPPORTED_COUNTRIES).join(', ')}.`,
      });
    }

    const parsePositiveInt = (raw: unknown, name: string): number | undefined => {
      if (raw === undefined || raw === '') return undefined;
      const n = parseInt(String(raw), 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid ?${name} — must be a positive integer (got "${raw}")`);
      }
      return n;
    };

    let maxDaysOld: number | undefined;
    let subSegmentThreshold: number | undefined;
    let throttleMs: number | undefined;
    try {
      maxDaysOld = parsePositiveInt(req.query.maxDaysOld, 'maxDaysOld');
      subSegmentThreshold = parsePositiveInt(req.query.subSegmentThreshold, 'subSegmentThreshold');
      throttleMs = parsePositiveInt(req.query.throttleMs, 'throttleMs');
    } catch (err) {
      return res.status(400).json({ success: false, error: (err as Error).message });
    }

    if (ADZUNA_STOCK_RUNNING.current) {
      return res.status(409).json({
        success: false,
        error: 'An Adzuna stock sync is already running.',
        running: ADZUNA_STOCK_RUNNING.current,
        hint: 'Wait for the current run to finish (typically 15-30 min). Check deployment logs for [GlobalJobPool] Adzuna Stock progress.',
      });
    }

    ADZUNA_STOCK_RUNNING.current = { startTime, segmented, country, maxDaysOld };
    console.log(`[Cron API] Adzuna Stock catch-up starting at ${startTime} (country=${country}, segmented=${segmented}, maxDaysOld=${maxDaysOld ?? 'all'})`);

    res.json({
      success: true,
      source: 'adzuna',
      mode: 'stock',
      country,
      segmented,
      maxDaysOld: maxDaysOld ?? 'all',
      status: 'started',
      startTime,
      note: segmented
        ? 'Segmented run: walks every Adzuna category and adaptively sub-walks dense ones across the top FR cities + radius. Bypasses the silent ~5 000-result per-query cap. Expect 15-30 min for full historical, 1-3 min for ?maxDaysOld=1.'
        : 'Flat run: walks each category to its per-query cap (~5 000). Use ?segmented=true (default) for the long tail.',
    });

    globalJobPoolService.syncAdzunaStock({ country, segmented, maxDaysOld, subSegmentThreshold, throttleMs })
      .then(inserted => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Adzuna Stock catch-up complete: ${inserted} new jobs inserted/refreshed (${duration.toFixed(0)}s, country=${country}, segmented=${segmented})`);
      })
      .catch(error => {
        console.error('[Cron API] Adzuna Stock catch-up error:', error?.message || error);
      })
      .finally(() => {
        ADZUNA_STOCK_RUNNING.current = null;
      });
  });

  console.log('[Routes] Adzuna stock catch-up endpoint registered: GET/POST /api/cron/sync-adzuna-stock?segmented=true');

  // PHASE 3: Sync LinkedIn + APEC jobs (async - returns immediately)
  registerCronEndpoint("/api/cron/sync-linkedin", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 3: Starting LinkedIn + APEC sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 3, sources: ['linkedin', 'apec'], status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase3', acknowledgement, async () => {
      try {
        const linkedinResult = await globalJobPoolService.syncSingleSource('linkedin');
        const apecResult = await globalJobPoolService.syncSingleSource('apec');
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        
        const totalInserted = linkedinResult.inserted + apecResult.inserted;
        console.log(`[Cron API] Phase 3 complete: ${totalInserted} new jobs (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 3 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase3:', error));
  });

  // PHASE 4: User matching + maintenance (async - returns immediately)
  registerCronEndpoint("/api/cron/sync-matching", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 4: Starting user matching + maintenance at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 4, status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase4', acknowledgement, async () => {
      try {
        // Run maintenance (TTL, close unseen jobs)
        await globalJobPoolService.runMaintenance();
        
        // Match jobs for all users
        const matchResult = await globalJobPoolService.matchAndSaveForAllUsers();
        
        // Backfill ISCO categories
        const backfillResult = await globalJobPoolService.backfillIscoCategories(200);

        // Compute embeddings for jobs missing one (non-blocking, resumable drain).
        // Bumped from 300 → 8000/run so the daily pass actually keeps pace with
        // new inserts and helps chip away at any backlog; the dedicated
        // /api/cron/backfill-embeddings endpoint handles the bulk catch-up.
        backfillEmbeddingsChunk(8000).then(embResult => {
          console.log(`[Cron API] Embedding drain: ${embResult.processed} computed, ${embResult.errors} errors, done=${embResult.done}`);
        }).catch(() => {});

        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        
        console.log(`[Cron API] Phase 4 complete: ${matchResult.totalJobsSaved} jobs matched, ${backfillResult} ISCO backfilled (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 4 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase4:', error));
  });

  // LEGACY: Keep original endpoint for compatibility but split into phases
  registerCronEndpoint("/api/cron/run-sync", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Full sync requested - redirecting to phased approach");
    
    // Return instructions to use phased endpoints
    res.json({
      success: true,
      status: "use_phased_endpoints",
      message: "For cron services with <30s timeout, use these endpoints in sequence (1 min apart each):",
      endpoints: [
        { phase: 1, url: "/api/cron/sync-francetravail", description: "Sync France Travail jobs" },
        { phase: 2, url: "/api/cron/sync-adzuna", description: "Sync Adzuna jobs" },
        { phase: 3, url: "/api/cron/sync-linkedin", description: "Sync LinkedIn + APEC jobs" },
        { phase: 4, url: "/api/cron/sync-matching", description: "User matching + maintenance" }
      ],
      note: "Each endpoint should complete in <25 seconds"
    });
  });
  
  console.log("[Routes] External cron endpoint registered: POST /api/cron/run-sync");

  // PHASE ALIASES for cron compatibility (sync-phase1, sync-phase2, etc.)
  registerCronEndpoint("/api/cron/sync-phase1", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 1 (alias): Starting France Travail sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 1, source: 'france_travail', status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase1', acknowledgement, () => globalJobPoolService.syncSingleSource('france_travail'))
      .then(result => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Phase 1 complete: ${result.inserted} new jobs (${duration}s)`);
      })
      .catch(error => {
        console.error("[Cron API] Phase 1 error:", error.message);
      });
  });

  registerCronEndpoint("/api/cron/sync-phase2", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 2 (alias): Starting Adzuna sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 2, source: 'adzuna', status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase2', acknowledgement, () => globalJobPoolService.syncSingleSource('adzuna'))
      .then(result => {
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Phase 2 complete: ${result.inserted} new jobs (${duration}s)`);
      })
      .catch(error => {
        console.error("[Cron API] Phase 2 error:", error.message);
      });
  });

  registerCronEndpoint("/api/cron/sync-phase3", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 3 (alias): Starting LinkedIn + APEC sync at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 3, sources: ['linkedin', 'apec'], status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase3', acknowledgement, async () => {
      try {
        const linkedinResult = await globalJobPoolService.syncSingleSource('linkedin');
        const apecResult = await globalJobPoolService.syncSingleSource('apec');
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        
        const totalInserted = linkedinResult.inserted + apecResult.inserted;
        console.log(`[Cron API] Phase 3 complete: ${totalInserted} new jobs (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 3 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase3:', error));
  });

  registerCronEndpoint("/api/cron/sync-phase4", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 4 (alias): Starting matching + maintenance at", startTime);
    
    // Respond immediately to avoid timeout
    const acknowledgement = { success: true, phase: 4, action: 'matching_and_maintenance', status: 'started', startTime };
    
    // Run sync in background
    startNightlyCronParticipant(res, 'phase4', acknowledgement, async () => {
      try {
        const { runJobPoolMaintenanceMatching } = await import('./services/jobPoolMaintenanceMatching');
        await runJobPoolMaintenanceMatching(globalJobPoolService);
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        console.log(`[Cron API] Phase 4 complete: maintenance + matching done (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 4 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase4:', error));
  });

  registerCronEndpoint("/api/cron/sync-phase5", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 5 (alias): Starting Cadremploi + HelloWork sync at", startTime);
    
    const acknowledgement = { success: true, phase: 5, sources: ['cadremploi', 'hellowork'], status: 'started', startTime };
    
    startNightlyCronParticipant(res, 'phase5', acknowledgement, async () => {
      try {
        const cadrResult = await globalJobPoolService.syncSingleSource('cadremploi');
        const helloResult = await globalJobPoolService.syncSingleSource('hellowork');
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        
        const totalInserted = cadrResult.inserted + helloResult.inserted;
        console.log(`[Cron API] Phase 5 complete: ${totalInserted} new jobs (Cadremploi=${cadrResult.inserted}, HelloWork=${helloResult.inserted}) (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 5 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase5:', error));
  });

  registerCronEndpoint("/api/cron/sync-phase6", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 6 (alias): Starting WTTJ + Career Pages + Recruitment Firms sync at", startTime);
    
    const acknowledgement = { success: true, phase: 6, sources: ['wttj', 'career_pages', 'recruitment_firms'], status: 'started', startTime };
    
    startNightlyCronParticipant(res, 'phase6', acknowledgement, async () => {
      try {
        const wttjResult = await globalJobPoolService.syncSingleSource('wttj');
        const careerResult = await globalJobPoolService.syncSingleSource('career_pages');
        
        let recruitmentResult = { discovered: 0, scraped: 0, saved: 0, errors: 0 };
        try {
          const { recruitmentFirmService } = await import('./services/recruitmentFirmService');
          recruitmentResult = await recruitmentFirmService.dailySync();
          console.log(`[Cron API] Recruitment Firms: discovered=${recruitmentResult.discovered}, scraped=${recruitmentResult.scraped}, saved=${recruitmentResult.saved}`);
        } catch (rfError: any) {
          poolError(rfError);
          console.error("[Cron API] Recruitment Firms sync error:", rfError.message);
        }
        
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        
        const totalInserted = wttjResult.inserted + careerResult.inserted + recruitmentResult.saved;
        console.log(`[Cron API] Phase 6 complete: ${totalInserted} new jobs (WTTJ=${wttjResult.inserted}, Career Pages=${careerResult.inserted}, Recruitment Firms=${recruitmentResult.saved}) (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 6 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase6:', error));
  });

  registerCronEndpoint("/api/cron/sync-phase7", async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    const startTime = new Date().toISOString();
    console.log("[Cron API] Phase 7: Starting Indeed + Monster + Jooble sync at", startTime);

    const acknowledgement = { success: true, phase: 7, sources: ['indeed', 'monster', 'jooble'], status: 'started', startTime };

    startNightlyCronParticipant(res, 'phase7', acknowledgement, async () => {
      try {
        // Do not close this phase while sibling collections still run after
        // one rejection. Preserve the concurrent execution of all three.
        const settled = await Promise.allSettled([
          globalJobPoolService.syncSingleSource('indeed'),
          globalJobPoolService.syncSingleSource('monster'),
          globalJobPoolService.syncSingleSource('jooble'),
        ]);
        const failure = settled.find(r => r.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        const [indeedResult, monsterResult, joobleResult] = settled.map(r =>
          (r as PromiseFulfilledResult<{ inserted: number }>).value);
        const duration = (Date.now() - new Date(startTime).getTime()) / 1000;
        const totalInserted = indeedResult.inserted + monsterResult.inserted + joobleResult.inserted;
        console.log(`[Cron API] Phase 7 complete: ${totalInserted} new jobs (Indeed=${indeedResult.inserted}, Monster=${monsterResult.inserted}, Jooble=${joobleResult.inserted}) (${duration}s)`);
      } catch (error: any) {
        poolError(error);
        console.error("[Cron API] Phase 7 error:", error.message);
      }
    }).catch(error => console.error('[Cron API] Cycle phase7:', error));
  });

  registerCronEndpoint("/api/cron/sync-indeed", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'indeed', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('indeed');
        console.log(`[Cron API] Indeed sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Indeed sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-monster", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'monster', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('monster');
        console.log(`[Cron API] Monster sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Monster sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-jooble", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'jooble', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('jooble');
        console.log(`[Cron API] Jooble sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Jooble sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-meteojob", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'meteojob', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('meteojob');
        console.log(`[Cron API] Meteojob sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Meteojob sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-glassdoor", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'glassdoor', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('glassdoor');
        console.log(`[Cron API] Glassdoor sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Glassdoor sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-direct-emploi", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'direct_emploi', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('direct_emploi');
        console.log(`[Cron API] Direct Emploi sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Direct Emploi sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-workday", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const tenantCount = (await import('./services/workdayService')).WORKDAY_TENANTS.length;
    res.json({ success: true, source: 'workday', tenants: tenantCount, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('workday');
        console.log(`[Cron API] Workday sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Workday sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-successfactors", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const { successFactorsService } = await import('./services/successFactorsService');
    const tenantCount = (await successFactorsService.getConfiguredTenants()).length;
    res.json({ success: true, source: 'successfactors', tenants: tenantCount, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('successfactors');
        console.log(`[Cron API] SuccessFactors sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] SuccessFactors sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-lever", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const { LEVER_COMPANIES } = await import('./services/leverService');
    res.json({ success: true, source: 'lever', companies: LEVER_COMPANIES.length, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('lever');
        console.log(`[Cron API] Lever sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Lever sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-workable", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const { WORKABLE_COMPANIES } = await import('./services/workableService');
    res.json({ success: true, source: 'workable', companies: WORKABLE_COMPANIES.length, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('workable');
        console.log(`[Cron API] Workable sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Workable sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-greenhouse", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const { GREENHOUSE_COMPANIES } = await import('./services/greenhouseService');
    res.json({ success: true, source: 'greenhouse', companies: GREENHOUSE_COMPANIES.length, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('greenhouse');
        console.log(`[Cron API] Greenhouse sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Greenhouse sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-icims", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const { ICIMS_EU_TENANTS } = await import('./services/icimsService');
    res.json({ success: true, source: 'icims', tenants: ICIMS_EU_TENANTS.length, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('icims');
        console.log(`[Cron API] iCIMS sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] iCIMS sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-smartrecruiters", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const mode = (req.query.mode === 'eu') ? 'eu' : 'fr';
    const { SR_FR_PRIORITY, SR_EU_TENANTS } = await import('./services/smartrecruitersService');
    const tenants = mode === 'eu' ? SR_EU_TENANTS : SR_FR_PRIORITY;
    res.json({ success: true, source: 'smartrecruiters', mode, tenants: tenants.length, status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('smartrecruiters');
        console.log(`[Cron API] SmartRecruiters sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] SmartRecruiters sync error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-paris-emploi", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'paris_emploi', status: 'started', startTime });
    (async () => {
      try {
        const result = await globalJobPoolService.syncSingleSource('paris_emploi');
        console.log(`[Cron API] Paris Emploi sync complete: ${result.inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] Paris Emploi sync error:", error.message);
      }
    })();
  });

  // ── Broadcast mode endpoints (temporal, keyword-free) ──────────────────────

  registerCronEndpoint("/api/cron/sync-wttj-broadcast", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    const hoursBack = Number(req.query.hours || 26);
    res.json({ success: true, source: 'wttj_broadcast', hoursBack, status: 'started', startTime });
    (async () => {
      try {
        const inserted = await globalJobPoolService.syncWTTJBroadcast({ hoursBack, maxPages: 40 });
        console.log(`[Cron API] WTTJ Broadcast complete: ${inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] WTTJ Broadcast error:", error.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-apec-broadcast", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    if (await respondIfApecPaused(res)) return;
    const startTime = new Date().toISOString();
    const hoursBack = Number(req.query.hours || 26);
    res.json({ success: true, source: 'apec_broadcast', hoursBack, status: 'started', startTime });
    (async () => {
      try {
        const inserted = await globalJobPoolService.syncApecBroadcast({ hoursBack, maxPages: 20 });
        console.log(`[Cron API] APEC Broadcast complete: ${inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] APEC Broadcast error:", error.message);
      }
    })();
  });

  // One-time admin backfill: re-sync APEC with a long window to populate location/description
  // for existing jobs that were ingested with empty location (field name bug now fixed).
  app.post("/api/admin/backfill-apec-locations", requireAdmin, async (req: any, res) => {
    if (await respondIfApecPaused(res)) return;
    const hoursBack = Number(req.body?.hoursBack || 2160); // default 90 days
    const maxPages  = Number(req.body?.maxPages  || 50);   // up to 5000 jobs
    res.json({ success: true, status: 'started', hoursBack, maxPages });
    (async () => {
      try {
        console.log(`[Admin] Starting APEC location backfill: ${hoursBack}h window, max ${maxPages} pages`);
        const inserted = await globalJobPoolService.syncApecBroadcast({ hoursBack, maxPages });
        console.log(`[Admin] APEC location backfill complete: ${inserted} new, duplicates updated`);
      } catch (err: any) {
        console.error("[Admin] APEC backfill error:", err.message);
      }
    })();
  });

  // One-time fix: restore masterclass slug decouvrir-mon-ikigai (changed to ikigai) + class slug prof-value (changed to PVA)
  app.post("/api/admin/fix-ikigai-slugs", requireAdmin, async (req: any, res) => {
    try {
      const results: string[] = [];
      // 1. Restore masterclass slug
      const mc = await pool.query(
        `UPDATE masterclasses SET slug = 'decouvrir-mon-ikigai' WHERE id = '2502c652-aa70-4056-bc79-04fec49461dc' AND slug != 'decouvrir-mon-ikigai' RETURNING slug`
      );
      results.push(`masterclass slug: ${mc.rowCount} row(s) updated → decouvrir-mon-ikigai`);
      // 2. Restore class slug PVA → prof-value
      const cl = await pool.query(
        `UPDATE classes SET slug = 'prof-value' WHERE id = '06630398-5668-4b08-a28b-3017f04f61fb' AND slug != 'prof-value' RETURNING slug`
      );
      results.push(`class PVA slug: ${cl.rowCount} row(s) updated → prof-value`);
      // 3. Restore module slug PVA → Intro-prof-value (inside class PVA / prof-value)
      const mod = await pool.query(
        `UPDATE modules SET slug = 'Intro-prof-value' WHERE class_id = '06630398-5668-4b08-a28b-3017f04f61fb' AND slug = 'PVA' RETURNING slug`
      );
      results.push(`module PVA slug: ${mod.rowCount} row(s) updated → Intro-prof-value`);
      console.log("[Admin] fix-ikigai-slugs:", results);
      res.json({ success: true, results });
    } catch (err: any) {
      console.error("[Admin] fix-ikigai-slugs error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // One-time fix: update activation_steps cta_url from broken PVA slug to correct prof-value slug.
  app.post("/api/admin/fix-pva-ctaurl", requireAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        UPDATE activation_steps
        SET cta_url = 'https://rebond.pro/learn/decouvrir-mon-ikigai/prof-value/Intro-prof-value'
        WHERE cta_url = 'https://rebond.pro/learn/decouvrir-mon-ikigai/PVA/PVA'
        RETURNING id, persona, day_number, locale
      `);
      console.log("[Admin] fix-pva-ctaurl:", result.rowCount, "row(s) updated");
      res.json({ success: true, updated: result.rowCount, rows: result.rows });
    } catch (err: any) {
      console.error("[Admin] fix-pva-ctaurl error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Resend audience sync ────────────────────────────────────────────────────
  app.get("/api/admin/resend-audience", requireAdmin, async (_req, res) => {
    try {
      const { getConfiguredAudienceId, getContactsApiKey } = await import("./services/resendContactService");
      const audienceId = getConfiguredAudienceId();

      // Also list all available audiences from the Resend API (direct REST — SDK shape varies by version)
      let audiences: { id: string; name: string; createdAt: string }[] = [];
      let audiencesError: string | null = null;
      const apiKey = getContactsApiKey();
      if (apiKey) {
        const resp = await fetch("https://api.resend.com/audiences", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const body = await resp.json() as any;
        if (resp.ok) {
          // Response is { data: [...] } or { object:"list", data:[...] } depending on version
          const list: any[] = Array.isArray(body) ? body
            : Array.isArray(body.data) ? body.data
            : [];
          audiences = list.map((a) => ({
            id: a.id,
            name: a.name,
            createdAt: a.created_at ?? "",
          }));
        } else {
          audiencesError = (resp.status === 401 || resp.status === 403) && /restricted to only send emails/i.test(body?.message ?? "")
            ? "Cette clé Resend peut uniquement envoyer des emails. Créez une clé à accès complet pour les audiences et les contacts."
            : resp.status === 403
            ? "Cette clé Resend n’a pas accès aux audiences. Utilisez une clé avec accès complet."
            : body?.message ?? body?.name ?? `HTTP ${resp.status}`;
          console.warn("[Admin] Resend audiences.list error:", audiencesError);
        }
      } else {
        audiencesError = "Une clé Resend avec accès aux contacts et audiences (RESEND_CONTACTS_API_KEY) est nécessaire. La clé d’envoi seule ne suffit pas.";
      }

      res.json({ audienceId, configured: Boolean(audienceId), contactsKeyConfigured: Boolean(apiKey), audiences, audiencesError });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/resend-ensure-audience", requireAdmin, async (_req, res) => {
    try {
      const { getContactsApiKey } = await import("./services/resendContactService");
      const apiKey = getContactsApiKey();
      if (!apiKey) return res.status(409).json({ error: "Ajoutez d’abord une clé Resend avec accès aux contacts et audiences (RESEND_CONTACTS_API_KEY)." });

      // Always go to the Resend API directly — never use the cached env var
      // so the admin can discover the real UUID even when a dummy is set.
      const listResp = await fetch("https://api.resend.com/audiences", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const listBody = await listResp.json() as any;
      if (!listResp.ok) {
        return res.status(502).json({
          error: (listResp.status === 401 || listResp.status === 403) && /restricted to only send emails/i.test(listBody?.message ?? "")
            ? "Cette clé Resend peut uniquement envoyer des emails. Créez une clé à accès complet."
            : listResp.status === 403
            ? "Cette clé Resend n’a pas accès aux audiences. Utilisez une clé avec accès complet."
            : `Impossible de vérifier les audiences Resend (HTTP ${listResp.status}). Aucune audience n’a été créée.`,
        });
      }

      const list: any[] = Array.isArray(listBody) ? listBody
        : Array.isArray(listBody.data) ? listBody.data
        : [];
      if (list.length > 0) {
        return res.json({ ok: true, audienceId: list[0].id, name: list[0].name, source: "list" });
      }

      // No existing audience — create one
      const createResp = await fetch("https://api.resend.com/audiences", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Rebond" }),
      });
      const createBody = await createResp.json() as any;
      if (!createResp.ok) {
        return res.status(500).json({ error: createBody?.message ?? `HTTP ${createResp.status}` });
      }
      res.json({ ok: true, audienceId: createBody.id, name: createBody.name, source: "created" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/resend-sync", requireAdmin, async (_req, res) => {
    try {
      const { bulkSync, getConfiguredAudienceId, getContactsApiKey } = await import("./services/resendContactService");
      const audienceId = getConfiguredAudienceId();
      const apiKey = getContactsApiKey();
      if (!apiKey) return res.status(409).json({ error: "Clé contacts Resend absente. Configurez RESEND_CONTACTS_API_KEY." });
      if (!audienceId) return res.status(409).json({ error: "Audience Resend non configurée. Définissez RESEND_AUDIENCE_ID avant la synchronisation." });
      const check = await fetch(`https://api.resend.com/audiences/${encodeURIComponent(audienceId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!check.ok) return res.status(409).json({
        error: check.status === 401 || check.status === 403
          ? "La clé Resend ne permet pas d’accéder aux audiences."
          : check.status === 404
            ? "L’audience configurée n’existe pas dans ce compte Resend."
            : `Impossible de vérifier l’audience Resend (HTTP ${check.status}).`,
      });
      res.json({ ok: true, status: "started", note: "Sync running in background — check server logs for progress." });
      bulkSync()
        .then(r => console.log(`[Admin] Resend sync done:`, r))
        .catch(e => console.error(`[Admin] Resend sync error:`, e.message));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/backfill-hellowork-descriptions", requireAdmin, async (req: any, res) => {
    const limit = Number(req.body?.limit || 500);
    const delayMs = Number(req.body?.delayMs || 1500);
    res.json({ success: true, status: 'started', limit, delayMs });
    (async () => {
      try {
        console.log(`[Admin] Starting Hellowork description backfill: up to ${limit} jobs, ${delayMs}ms delay`);
        const { helloworkService } = await import('./services/helloworkService');
        const result = await pool.query(
          `SELECT id, url FROM global_job_pool
           WHERE source = 'hellowork' AND status = 'active'
             AND (description IS NULL OR description = '')
             AND url IS NOT NULL AND url != ''
           ORDER BY scraped_at DESC
           LIMIT $1`,
          [limit]
        );
        let updated = 0; let failed = 0;
        for (const row of result.rows) {
          try {
            const desc = await helloworkService.fetchJobDescription(row.url);
            if (desc && desc.length > 30) {
              await pool.query(
                `UPDATE global_job_pool SET description = $1 WHERE id = $2`,
                [desc.substring(0, 3000), row.id]
              );
              updated++;
              if (updated % 50 === 0) console.log(`[Admin] Hellowork backfill: ${updated} updated, ${failed} failed`);
            } else { failed++; }
          } catch { failed++; }
          await new Promise(r => setTimeout(r, delayMs));
        }
        console.log(`[Admin] Hellowork description backfill complete: ${updated} updated, ${failed} failed out of ${result.rows.length}`);
      } catch (err: any) {
        console.error("[Admin] Hellowork description backfill error:", err.message);
      }
    })();
  });

  registerCronEndpoint("/api/cron/sync-linkedin-broadcast", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'linkedin_broadcast', status: 'started', startTime });
    (async () => {
      try {
        const inserted = await globalJobPoolService.syncLinkedInBroadcast({ dateSincePosted: '24hr', limitPerQuery: 50 });
        console.log(`[Cron API] LinkedIn Broadcast complete: ${inserted} new jobs`);
      } catch (error: any) {
        console.error("[Cron API] LinkedIn Broadcast error:", error.message);
      }
    })();
  });

  console.log("[Routes] Phase alias endpoints registered: sync-phase1 through sync-phase7, sync-indeed, sync-monster, sync-jooble, sync-meteojob, sync-workday, sync-successfactors, sync-lever, sync-workable, sync-greenhouse, sync-smartrecruiters, sync-icims, sync-paris-emploi, sync-wttj-broadcast, sync-apec-broadcast, sync-linkedin-broadcast");

  // ── Sitemap ping: notify Google + IndexNow of fresh indexable jobs ─────────
  // Schedule daily at 08:00 Paris time, after recruitment_firm / career-page
  // scrapers have run. Pings Google Search Console and submits new job URLs
  // (scraped in the last 25 h) to IndexNow so Google Jobs picks them up fast.
  // Requires env var INDEXNOW_KEY (any stable UUID you own).
  registerCronEndpoint("/api/cron/ping-sitemaps", async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    const baseUrl = "https://rebond.pro";
    res.json({ success: true, status: "started", message: "Sitemap ping running in background" });

    (async () => {
      // Google deprecated their /ping?sitemap= endpoint in 2023 — GSC now discovers
      // sitemaps automatically. Submit to IndexNow instead (Google reads it too).

      // Submit new job URLs to IndexNow (Bing/Yandex; Google also reads it)
      const indexNowKey = process.env.INDEXNOW_KEY;
      if (!indexNowKey) {
        console.warn("[Sitemap Ping] INDEXNOW_KEY not set — skipping IndexNow submission");
        return;
      }

      try {
        const { publicJobSearchService } = await import("./services/publicJobSearchService");
        const since = new Date(Date.now() - 25 * 60 * 60 * 1000); // last 25 h
        const newJobs = await publicJobSearchService.getNewIndexableJobsSince(since, 10000);
        if (newJobs.length === 0) {
          console.log("[Sitemap Ping] IndexNow: no new indexable jobs since last run");
          return;
        }

        const jobsWithSlug = newJobs.filter((j) => j.slug);
        if (jobsWithSlug.length < newJobs.length) {
          console.warn(`[Sitemap Ping] IndexNow: skipped ${newJobs.length - jobsWithSlug.length} jobs without slug (backfill pending)`);
        }
        if (jobsWithSlug.length === 0) {
          console.log("[Sitemap Ping] IndexNow: no new indexable jobs with slugs to submit");
          return;
        }
        const urlList = jobsWithSlug.map((j) => `${baseUrl}/emploi/o/${j.slug}`);
        const body = {
          host: "rebond.pro",
          key: indexNowKey,
          keyLocation: `${baseUrl}/${indexNowKey}.txt`,
          urlList,
        };

        const inRes = await fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        console.log(`[Sitemap Ping] IndexNow: submitted ${urlList.length} URLs → HTTP ${inRes.status}`);
      } catch (err: any) {
        console.error("[Sitemap Ping] IndexNow submission failed:", err.message);
      }
    })();
  });
  console.log("[Routes] Sitemap ping endpoint registered: GET/POST /api/cron/ping-sitemaps");

  registerCronEndpoint("/api/cron/recover-closed-jobs", async (req, res) => {
    if (!validateCronSecret(req, res)) return;

    try {
      const hoursBack = Number(req.query.hours || 48);
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const result = await db.update(globalJobPool)
        .set({ status: 'active', closedAt: null })
        .where(and(
          eq(globalJobPool.status, 'closed'),
          gte(globalJobPool.closedAt, cutoff),
          gte(globalJobPool.scrapedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        ));

      const recovered = (result as any).rowCount || 0;
      console.log(`[Cron API] Recovered ${recovered} wrongly closed jobs (closed in last ${hoursBack}h)`);
      res.json({ success: true, recovered, hoursBack });
    } catch (error: any) {
      console.error("[Cron API] Recovery error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  console.log("[Routes] Job recovery endpoint registered: POST /api/cron/recover-closed-jobs");

  // One-time (and idempotent) cleanup: mark non-French Workday jobs as closed.
  // Multinational companies publish global offers on a single Workday career site;
  // those were incorrectly imported with country='FR'. Run once after deploying the
  // isFrenchOrAmbiguousLocation fix in workdayService.ts to purge existing bad rows.
  registerCronEndpoint("/api/cron/purge-workday-non-fr", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    try {
      const closed = await journalPoolOperation({
        kind: 'cleanup', source: 'workday', mechanism: 'manual_workday_non_fr',
      }, () => transitionPoolJobs(sql`
        source = 'workday'
          AND country = 'FR'
          AND status = 'active'
          AND NOT (
            location ~ '\m(0[1-9]|[1-8][0-9]|9[0-5]|97[1-6])[0-9]{3}\M'
            OR location ILIKE '%france%'
            OR location ~* '^\d+\s+locations?$'
          )
          AND (
               location ILIKE '%mexico%'       OR location ILIKE '%canada%'
            OR location ILIKE '%germany%'      OR location ILIKE '%deutschland%'
            OR location ILIKE '%spain%'        OR location ILIKE '%españa%'
            OR location ILIKE '%italy%'        OR location ILIKE '%italia%'
            OR location ILIKE '%portugal%'     OR location ILIKE '%netherlands%'
            OR location ILIKE '%united states%' OR location ILIKE '% usa%'
            OR location ILIKE '%- usa%'        OR location ILIKE '%u.s.a%'
            OR location ILIKE '%united kingdom%'
            OR location ILIKE '%india%'        OR location ILIKE '%- india%'
            OR location ILIKE '%china%'        OR location ILIKE '%brazil%'
            OR location ILIKE '%argentina%'    OR location ILIKE '%chile%'
            OR location ILIKE '%colombia%'     OR location ILIKE '%peru%'
            OR location ILIKE '%london%'       OR location ILIKE '%berlin%'
            OR location ILIKE '%madrid%'       OR location ILIKE '%barcelona%'
            OR location ILIKE '%rome%'         OR location ILIKE '%milan%'
            OR location ILIKE '%amsterdam%'    OR location ILIKE '%brussels%'
            OR location ILIKE '%bruxelles%'    OR location ILIKE '%budapest%'
            OR location ILIKE '%prague%'       OR location ILIKE '%warsaw%'
            OR location ILIKE '%zurich%'       OR location ILIKE '%zürich%'
            OR location ILIKE '%stockholm%'    OR location ILIKE '%oslo%'
            OR location ILIKE '%helsinki%'     OR location ILIKE '%dublin%'
            OR location ILIKE '%lisbon%'       OR location ILIKE '%porto%'
            OR location ILIKE '%athens%'       OR location ILIKE '%istanbul%'
            OR location ILIKE '%toronto%'      OR location ILIKE '%montreal%'
            OR location ILIKE '%vancouver%'    OR location ILIKE '%calgary%'
            OR location ILIKE '%beijing%'      OR location ILIKE '%shanghai%'
            OR location ILIKE '%hong kong%'    OR location ILIKE '%tokyo%'
            OR location ILIKE '%seoul%'        OR location ILIKE '%singapore%'
            OR location ILIKE '%mumbai%'       OR location ILIKE '%bengaluru%'
            OR location ILIKE '%bangalore%'    OR location ILIKE '%hyderabad%'
            OR location ILIKE '%chennai%'      OR location ILIKE '%pune%'
            OR location ILIKE '%dubai%'        OR location ILIKE '%abu dhabi%'
            OR location ILIKE '%riyadh%'       OR location ILIKE '%doha%'
            OR location ILIKE '%cairo%'        OR location ILIKE '%nairobi%'
            OR location ILIKE '%sydney%'       OR location ILIKE '%melbourne%'
            OR location ILIKE '%bogota%'       OR location ILIKE '%bogotá%'
            OR location ILIKE '%buenos aires%' OR location ILIKE '%santiago%'
            OR location ILIKE '%antofagasta%'  OR location ILIKE '%queretaro%'
            OR location ILIKE '%querétaro%'    OR location ILIKE '%ciudad de mexico%'
            OR location ILIKE '%frankfurt am main%'
            OR location ILIKE '%goettingen%'   OR location ILIKE '%göttingen%'
            OR location ILIKE '%schrobenhausen%'
            OR location ILIKE '%aschau am inn%' OR location ILIKE '%aschau%'
            OR location ILIKE '%martos%'       OR location ILIKE '%beaverton%'
            OR location ILIKE '%, oregon%'     OR location ILIKE '%, michigan%'
            OR location ILIKE '%, california%' OR location ILIKE '%, texas%'
            OR location ILIKE '%am main%'      OR location ILIKE '%am inn%'
            OR location ILIKE '%am rhein%'
            OR location ~* '\yuk\y'
            OR location ILIKE '%bucharest%'
            OR location ILIKE '%sweden%'
            OR location ILIKE '%jakarta%'
            OR location ILIKE '%bandung%'
            OR location ILIKE '%indonesia%'
            OR location ILIKE '%keokuk%'
            OR location ILIKE '%milwaukee%'
          )
      `, 'closed', 'manual_workday_non_fr'));
      console.log(`[Cron API] Workday non-FR purge: ${closed} jobs marked closed`);
      res.json({ success: true, closed });
    } catch (error: any) {
      console.error("[Cron API] Workday non-FR purge error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  console.log("[Routes] Workday non-FR purge endpoint registered: POST /api/cron/purge-workday-non-fr");

  // Backfill full descriptions for Workday jobs (listing API never returns descriptions)
  // Run repeatedly until done=true (each call processes up to `limit` jobs)
  registerCronEndpoint("/api/cron/backfill-workday-descriptions", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10), 500);
    const delayMs = Math.max(parseInt(String(req.query.delayMs || '150'), 10), 50);
    const startTime = new Date().toISOString();
    res.json({ success: true, source: 'workday-descriptions', limit, delayMs, status: 'started', startTime });
    try {
      const result = await globalJobPoolService.backfillWorkdayDescriptions({ limit, delayMs });
      console.log(`[Cron API] Workday description backfill: ${result.updated} updated, done=${result.done}`);
    } catch (error: any) {
      console.error("[Cron API] Workday description backfill error:", error.message);
    }
  });
  console.log("[Routes] Workday description backfill endpoint registered: POST /api/cron/backfill-workday-descriptions");

  // Manual Job Pool Stats Report trigger (for testing)
  registerCronEndpoint("/api/cron/send-jobpool-report", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    try {
      const { deliverJobPoolCycleReports } = await import('./cron');
      // This existing request ends external dispatch, not collection. Terminal
      // journal results remain mandatory; no force/completion flag is accepted.
      await sealNightlyEnrollment();
      const outcomes = await deliverJobPoolCycleReports();
      const failed = Object.values(outcomes).includes('failed');
      res.status(failed ? 500 : 200).json({ success: !failed, outcomes });
    } catch (error: any) {
      console.error("[Cron API] Error sending job pool report:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  console.log("[Routes] Job Pool report endpoint registered: POST /api/cron/send-jobpool-report");

  // Test career page scraping (admin only)
  registerCronEndpoint("/api/cron/test-career-scrape", async (req, res) => {
    if (!validateCronSecret(req, res)) return;
    
    try {
      const { maxCompanies = 2, country = 'FR', atsType, companyNames, companyIds } = { ...req.query, ...req.body };

      const parseList = (v: any): string[] | undefined => {
        if (!v) return undefined;
        if (Array.isArray(v)) return v.map(String);
        return String(v).split(',').map(s => s.trim()).filter(Boolean);
      };
      const namesList = parseList(companyNames);
      const idsList = parseList(companyIds);

      console.log(`[Career Scrape Test] Starting test with maxCompanies=${maxCompanies}, country=${country}, atsType=${atsType || 'all'}, names=${namesList?.join('|') || '-'}, ids=${idsList?.join('|') || '-'}`);
      console.log(`[Career Scrape Test] USE_PAID_ACTORS=${process.env.USE_PAID_ACTORS}`);
      
      const result = await globalJobPoolService.syncCareerPages({ 
        countries: [country],
        maxCompanies: Number(maxCompanies),
        atsType,
        companyNames: namesList,
        companyIds: idsList,
      });
      
      // Check how many jobs are in pool from career pages
      const careerJobs = await db
        .select({ count: count() })
        .from(globalJobPool)
        .where(eq(globalJobPool.source, 'career_page'));
      
      res.json({ 
        success: true, 
        jobsInserted: result,
        totalCareerJobsInPool: careerJobs[0]?.count || 0,
        message: `Scraped ${result} jobs from career pages`,
        usePaidActors: process.env.USE_PAID_ACTORS === 'true'
      });
    } catch (error: any) {
      console.error("[Career Scrape Test] Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  console.log("[Routes] Career scrape test endpoint registered: POST /api/cron/test-career-scrape");

  registerBootcampRoutes(app);
  registerActivationRoutes(app);
  registerAiLogsRoutes(app);
  registerStripeRoutes(app);
  registerNotificationsRoutes(app);
  registerContactsRoutes(app);
  registerCandidatureAiRoutes(app);
  await startupPhase("community_routes", () => registerCommunityRoutes(app));
  registerMicrolearningRoutes(app);
  registerInterviewRoutes(app);
  registerOnboardingRoutes(app);
  await startupPhase("coaching_routes", () => registerAiCoachingRoutes(app));
  registerRebondIaV2Routes(app);
  registerBlogRoutes(app);
  registerPressRoutes(app);
  await startupPhase("job_pool_routes", () => registerJobPoolRoutes(app));
  registerApplicationRoutes(app);
  registerExtensionJobRoutes(app);
  registerCvStudioRoutes(app);
  registerCvLeadRoutes(app);
  registerLinkedinLeadRoutes(app);
  registerSalaryLeadRoutes(app);
  registerRiasecLeadRoutes(app);
  await startupPhase("automation_routes", () => registerAutomationAdminRoutes(app));

  // ── PostHog reverse proxy ──────────────────────────────────────────────────
  // Routes requests through our domain to avoid ad-blocker interference.
  // /ingest/static/* → eu-assets.i.posthog.com/static/*
  // /ingest/*        → eu.i.posthog.com/*
  function posthogProxy(targetHost: string) {
    return (req: any, res: any) => {
      const targetPath = req.originalUrl.replace(/^\/ingest/, "") || "/";
      // Allowlist only the headers PostHog actually needs — never forward
      // session cookies, authorization tokens or internal headers.
      const allowedHeaders: Record<string, string> = { host: targetHost };
      for (const key of ['content-type', 'user-agent', 'accept', 'accept-encoding', 'accept-language'] as const) {
        const val = req.headers[key];
        if (val) allowedHeaders[key] = Array.isArray(val) ? val[0] : val;
      }

      // Express body-parser may have already consumed the request stream for
      // JSON routes (e.g. /decide/, /e/). Re-serialise req.body in that case so
      // PostHog receives the full payload. For binary/text blobs (/s/ recordings)
      // the body-parser doesn't touch them, so we pipe the raw stream directly.
      const bodyBuffer: Buffer | null = (() => {
        if (req.body === undefined || req.body === null) return null;
        if (Buffer.isBuffer(req.body)) return req.body;
        const str = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        return Buffer.from(str, 'utf-8');
      })();

      if (bodyBuffer) {
        allowedHeaders['content-length'] = String(bodyBuffer.length);
      }

      const proxyReq = httpsRequest(
        {
          hostname: targetHost,
          path: targetPath,
          method: req.method,
          headers: allowedHeaders,
        },
        (phRes) => {
          // Forward only safe, analytics-relevant response headers.
          // Never reflect Set-Cookie, authorization, or other sensitive
          // headers from the third-party PostHog service back to the browser,
          // as they could influence first-party session state.
          const SAFE_RESPONSE_HEADERS = new Set([
            'content-type', 'content-length', 'content-encoding',
            'cache-control', 'expires', 'vary', 'access-control-allow-origin',
            'access-control-allow-methods', 'access-control-allow-headers',
          ]);
          const safeHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(phRes.headers)) {
            if (SAFE_RESPONSE_HEADERS.has(k.toLowerCase()) && v !== undefined) {
              safeHeaders[k] = v as string | string[];
            }
          }
          res.writeHead(phRes.statusCode || 200, safeHeaders);
          phRes.pipe(res);
        }
      );
      proxyReq.on("error", () => res.sendStatus(502));
      if (bodyBuffer) {
        proxyReq.write(bodyBuffer);
        proxyReq.end();
      } else {
        req.pipe(proxyReq);
      }
    };
  }
  // Register /ingest/static BEFORE /ingest so the more specific path matches first
  app.use("/ingest/static", posthogProxy("eu-assets.i.posthog.com"));
  app.use("/ingest", (req, res, next) => {
    if (isPreviewAnalyticsRequest(req)) return void res.status(204).end();
    next();
  });
  app.use("/ingest", posthogProxy("eu.i.posthog.com"));

  // ── LES CERCLES ────────────────────────────────────────────────────────────
  {
    const { circles, circleMembers, circleChallenges, circleCheckins, circlePosts, circleReactions } = await import("@shared/schema");

    // Noms générés pour les Cercles
    const CIRCLE_NAMES = ["Véga","Élan","Solstice","Orion","Sirius","Lyra","Altaïr","Pégase","Castor","Pollux","Rigel","Deneb","Mimosa","Capella","Aldébaran","Bételgeuse","Procyon","Régulus","Spica","Antarès"];

    function generateCircleName(): string {
      return `Cercle ${CIRCLE_NAMES[Math.floor(Math.random() * CIRCLE_NAMES.length)]}`;
    }

    // GET /api/circles/my — mon Cercle actif
    app.get("/api/circles/my", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const [membership] = await db
          .select({ circleId: circleMembers.circleId, role: circleMembers.role, intent: circleMembers.intent, status: circleMembers.status })
          .from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active")))
          .limit(1);
        if (!membership) return res.json({ circle: null, membership: null });

        const [circle] = await db.select().from(circles).where(eq(circles.id, membership.circleId)).limit(1);
        if (!circle) return res.json({ circle: null, membership: null });

        // Members avec infos user
        const members = await db
          .select({
            id: circleMembers.id, userId: circleMembers.userId, role: circleMembers.role,
            status: circleMembers.status, intent: circleMembers.intent,
            joinedAt: circleMembers.joinedAt, lastActiveAt: circleMembers.lastActiveAt,
            checkinsCompleted: circleMembers.checkinsCompleted,
            firstName: users.firstName, lastName: users.lastName,
            profilePicture: users.profileImageUrl,
          })
          .from(circleMembers)
          .leftJoin(users, eq(users.id, circleMembers.userId))
          .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.status, "active")));

        // Auto-activation lazy : si forming mais >= 8 membres actifs, basculer en active
        if (circle.status === "forming" && members.length >= 8) {
          const startedAt = new Date();
          const endsAt = new Date(startedAt.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
          await db.update(circles).set({ status: "active", currentWeek: 1, startedAt, endsAt })
            .where(eq(circles.id, circle.id));
          circle.status = "active";
          circle.currentWeek = 1;
          circle.startedAt = startedAt;
          circle.endsAt = endsAt;
        }

        // Défi de la semaine courante
        const [challenge] = circle.currentWeek > 0
          ? await db.select().from(circleChallenges).where(eq(circleChallenges.weekNumber, circle.currentWeek)).limit(1)
          : [null];

        // Check-in de l'utilisateur pour la semaine courante
        const [myCheckin] = circle.currentWeek > 0
          ? await db.select().from(circleCheckins).where(
              and(eq(circleCheckins.circleId, circle.id), eq(circleCheckins.userId, userId), eq(circleCheckins.weekNumber, circle.currentWeek))
            ).limit(1)
          : [null];

        // Stats check-ins cette semaine
        const weekCheckins = circle.currentWeek > 0
          ? await db.select().from(circleCheckins).where(
              and(eq(circleCheckins.circleId, circle.id), eq(circleCheckins.weekNumber, circle.currentWeek), eq(circleCheckins.isVisible, true))
            )
          : [];

        res.json({ circle, membership, members, challenge, myCheckin, weekCheckins });
      } catch (err: any) {
        console.error("[Circles] GET /api/circles/my:", err.message);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/join — rejoindre ou créer un Cercle
    app.post("/api/circles/join", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { intent } = req.body;

        // Vérifier si déjà dans un Cercle actif
        const [existing] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (existing) return res.status(409).json({ error: "Vous êtes déjà membre d'un Cercle actif" });

        // Chercher un Cercle en formation avec de la place (même secteur si possible)
        const userProfile = await db.select({ targetSector: users.targetSector, targetSeniority: users.targetSeniority })
          .from(users).where(eq(users.id, userId)).limit(1);
        const sector = userProfile[0]?.targetSector || null;

        // Chercher un cercle forming avec de la place
        const openCircles = await db.select({
          id: circles.id, maxMembers: circles.maxMembers, sector: circles.sector,
          memberCount: sql<number>`(SELECT COUNT(*) FROM circle_members WHERE circle_id = ${circles.id} AND status = 'active')`,
        }).from(circles).where(eq(circles.status, "forming"));

        let targetCircle = openCircles.find(c =>
          (Number(c.memberCount) < c.maxMembers) && (c.sector === sector || !sector || !c.sector)
        ) || openCircles.find(c => Number(c.memberCount) < c.maxMembers);

        // Créer un nouveau Cercle si aucun disponible
        if (!targetCircle) {
          const [newCircle] = await db.insert(circles).values({
            name: generateCircleName(), status: "forming", sector: sector || undefined, maxMembers: 10,
          }).returning();
          targetCircle = { ...newCircle, memberCount: 0 };
        }

        // Ajouter le membre
        const [member] = await db.insert(circleMembers).values({
          circleId: targetCircle.id, userId, role: "member", status: "active",
          intent: intent?.slice(0, 280) || null,
        }).returning();

        // Si le Cercle atteint 8 membres → passer en active et démarrer la semaine 1
        const newCount = Number(targetCircle.memberCount) + 1;
        if (newCount >= 8) {
          const startedAt = new Date();
          const endsAt = new Date(startedAt.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
          await db.update(circles).set({ status: "active", currentWeek: 1, startedAt, endsAt })
            .where(eq(circles.id, targetCircle.id));
        }

        const [circle] = await db.select().from(circles).where(eq(circles.id, targetCircle.id)).limit(1);
        res.json({ circle, member });
      } catch (err: any) {
        console.error("[Circles] POST /api/circles/join:", err.message);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // PATCH /api/circles/my/intent — mettre à jour sa carte d'intention
    app.patch("/api/circles/my/intent", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { intent } = req.body;
        if (!intent?.trim()) return res.status(400).json({ error: "L'intention ne peut pas être vide" });
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(404).json({ error: "Aucun Cercle actif" });
        await db.update(circleMembers).set({ intent: intent.slice(0, 280) }).where(eq(circleMembers.id, membership.id));
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // DELETE /api/circles/my/leave — quitter son Cercle
    app.delete("/api/circles/my/leave", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        await db.update(circleMembers).set({ status: "left" })
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active")));
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // GET /api/circles/my/posts — fil du Cercle
    app.get("/api/circles/my/posts", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const offset = parseInt(req.query.offset as string) || 0;

        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const posts = await db
          .select({
            id: circlePosts.id, type: circlePosts.type, content: circlePosts.content,
            linkedEntityType: circlePosts.linkedEntityType, linkedEntityId: circlePosts.linkedEntityId,
            reactionsCount: circlePosts.reactionsCount, isPinned: circlePosts.isPinned,
            createdAt: circlePosts.createdAt, authorId: circlePosts.authorId,
            authorFirstName: users.firstName, authorLastName: users.lastName,
            authorPicture: users.profileImageUrl,
            myReaction: sql<string | null>`(SELECT type FROM circle_reactions WHERE post_id = ${circlePosts.id} AND user_id = ${userId} LIMIT 1)`,
          })
          .from(circlePosts)
          .leftJoin(users, eq(users.id, circlePosts.authorId))
          .where(and(eq(circlePosts.circleId, membership.circleId), eq(circlePosts.isHidden, false)))
          .orderBy(asc(circlePosts.createdAt))
          .limit(limit).offset(offset);

        res.json({ posts });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/my/posts — publier dans le Cercle
    app.post("/api/circles/my/posts", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { type, content, linkedEntityType, linkedEntityId } = req.body;
        if (!content?.trim()) return res.status(400).json({ error: "Le contenu est requis" });
        if (content.length > 1000) return res.status(400).json({ error: "Maximum 1000 caractères" });

        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [post] = await db.insert(circlePosts).values({
          circleId: membership.circleId, authorId: userId,
          type: type || "general", content: content.trim(),
          linkedEntityType: linkedEntityType || null, linkedEntityId: linkedEntityId || null,
        }).returning();

        // Mettre à jour last_active_at
        await db.update(circleMembers).set({ lastActiveAt: new Date() }).where(eq(circleMembers.id, membership.id));

        // Notifier les autres membres actifs du Cercle
        try {
          const otherMembers = await db.select({ userId: circleMembers.userId })
            .from(circleMembers)
            .where(and(
              eq(circleMembers.circleId, membership.circleId),
              eq(circleMembers.status, "active"),
            ));
          const recipients = otherMembers.filter(m => m.userId !== userId);
          if (recipients.length > 0) {
            const notifBody = content.trim().length > 80
              ? content.trim().slice(0, 80) + "…"
              : content.trim();
            await pool.query(
              `INSERT INTO user_notifications (user_id, type, title, body, link)
               SELECT unnest($1::text[]), $2, $3, $4, $5`,
              [
                recipients.map(m => m.userId),
                "cercle_message",
                "Nouveau message dans ton Cercle",
                notifBody,
                "/my-cercle",
              ]
            );
          }
        } catch (notifErr: any) {
          console.warn("[Circles] Notification send failed:", notifErr.message);
        }

        res.json({ post });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/my/posts/:postId/react — réagir à un post
    app.post("/api/circles/my/posts/:postId/react", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { postId } = req.params;
        const { type } = req.body;
        if (!["bravo","inspire","courage","on_est_la"].includes(type)) return res.status(400).json({ error: "Type de réaction invalide" });

        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [post] = await db.select().from(circlePosts)
          .where(and(eq(circlePosts.id, postId), eq(circlePosts.circleId, membership.circleId))).limit(1);
        if (!post) return res.status(404).json({ error: "Post introuvable" });

        // Vérifier réaction existante
        const [existing] = await db.select().from(circleReactions)
          .where(and(eq(circleReactions.postId, postId), eq(circleReactions.userId, userId))).limit(1);

        const counts = (post.reactionsCount as Record<string, number>) || {};

        if (existing) {
          if (existing.type === type) {
            // Supprimer la réaction (toggle off)
            await db.delete(circleReactions).where(eq(circleReactions.id, existing.id));
            counts[existing.type] = Math.max(0, (counts[existing.type] || 1) - 1);
            if (counts[existing.type] === 0) delete counts[existing.type];
          } else {
            // Changer de réaction
            await db.update(circleReactions).set({ type }).where(eq(circleReactions.id, existing.id));
            counts[existing.type] = Math.max(0, (counts[existing.type] || 1) - 1);
            if (counts[existing.type] === 0) delete counts[existing.type];
            counts[type] = (counts[type] || 0) + 1;
          }
        } else {
          await db.insert(circleReactions).values({ postId, userId, type });
          counts[type] = (counts[type] || 0) + 1;
        }

        await db.update(circlePosts).set({ reactionsCount: counts }).where(eq(circlePosts.id, postId));
        res.json({ reactionsCount: counts, myReaction: existing?.type === type ? null : type });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/my/checkin — check-in hebdomadaire
    app.post("/api/circles/my/checkin", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { mood, content, isVisible } = req.body;
        if (!mood || !["on_track","struggling","won"].includes(mood)) return res.status(400).json({ error: "Humeur invalide" });

        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [circle] = await db.select().from(circles).where(eq(circles.id, membership.circleId)).limit(1);
        if (!circle || circle.status !== "active") return res.status(400).json({ error: "Le Cercle n'est pas actif" });

        const [checkin] = await db.insert(circleCheckins).values({
          circleId: circle.id, userId, weekNumber: circle.currentWeek,
          mood, content: content?.slice(0, 500) || null,
          isVisible: isVisible !== false,
        }).onConflictDoUpdate({
          target: [circleCheckins.circleId, circleCheckins.userId, circleCheckins.weekNumber],
          set: { mood, content: content?.slice(0, 500) || null, isVisible: isVisible !== false },
        }).returning();

        // Incrémenter le compteur si c'est la première fois cette semaine
        await db.update(circleMembers).set({
          lastActiveAt: new Date(),
          checkinsCompleted: sql`${circleMembers.checkinsCompleted} + 1`,
        }).where(eq(circleMembers.id, membership.id));

        res.json({ checkin });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // PATCH /api/circles/my/checkin/challenge — marquer le défi comme accompli ou non
    app.patch("/api/circles/my/checkin/challenge", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [circle] = await db.select().from(circles).where(eq(circles.id, membership.circleId)).limit(1);
        if (!circle || circle.status !== "active") return res.status(400).json({ error: "Le Cercle n'est pas actif" });

        // Upsert un check-in minimal si pas encore de check-in cette semaine
        const [checkin] = await db.insert(circleCheckins).values({
          circleId: circle.id, userId, weekNumber: circle.currentWeek,
          mood: "on_track", content: null, isVisible: true, challengeCompleted: true,
        }).onConflictDoUpdate({
          target: [circleCheckins.circleId, circleCheckins.userId, circleCheckins.weekNumber],
          set: { challengeCompleted: sql`NOT circle_checkins.challenge_completed` },
        }).returning();

        res.json({ challengeCompleted: checkin.challengeCompleted });
      } catch (err: any) {
        console.error("[Circles] PATCH /api/circles/my/checkin/challenge:", err.message);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // GET /api/circles/my/checkins — tous les check-ins du Cercle (semaine courante)
    app.get("/api/circles/my/checkins", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [circle] = await db.select().from(circles).where(eq(circles.id, membership.circleId)).limit(1);
        const week = parseInt(req.query.week as string) || circle?.currentWeek || 1;

        const checkins = await db
          .select({
            id: circleCheckins.id, mood: circleCheckins.mood, content: circleCheckins.content,
            isVisible: circleCheckins.isVisible, weekNumber: circleCheckins.weekNumber,
            createdAt: circleCheckins.createdAt, userId: circleCheckins.userId,
            firstName: users.firstName, lastName: users.lastName, profilePicture: users.profileImageUrl,
          })
          .from(circleCheckins)
          .leftJoin(users, eq(users.id, circleCheckins.userId))
          .where(and(
            eq(circleCheckins.circleId, membership.circleId),
            eq(circleCheckins.weekNumber, week),
            eq(circleCheckins.isVisible, true),
          ));

        res.json({ checkins, week });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // GET /api/circles/challenges — les 8 défis
    app.get("/api/circles/challenges", async (_req, res) => {
      try {
        const challenges = await db.select().from(circleChallenges)
          .where(eq(circleChallenges.isCustom, false))
          .orderBy(circleChallenges.weekNumber);
        res.json({ challenges });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // PATCH /api/circles/my/posts/:postId/pin — épingler (facilitateur)
    app.patch("/api/circles/my/posts/:postId/pin", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { postId } = req.params;
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.role, "facilitator"), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Réservé au facilitateur" });
        const postScope = and(eq(circlePosts.id, postId), eq(circlePosts.circleId, membership.circleId));
        const [post] = await db.select().from(circlePosts).where(postScope).limit(1);
        if (!post) return res.status(404).json({ error: "Post introuvable" });
        await db.update(circlePosts).set({ isPinned: !post.isPinned }).where(postScope);
        res.json({ ok: true, isPinned: !post.isPinned });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/my/posts/:postId/report — signaler un post
    app.post("/api/circles/my/posts/:postId/report", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { postId } = req.params;
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });
        const [post] = await db.select().from(circlePosts)
          .where(and(eq(circlePosts.id, postId), eq(circlePosts.circleId, membership.circleId))).limit(1);
        if (!post) return res.status(404).json({ error: "Post introuvable" });
        const newCount = (post.reportCount || 0) + 1;
        await db.update(circlePosts).set({
          reportCount: newCount,
          isHidden: newCount >= 2,
        }).where(eq(circlePosts.id, postId));
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // POST /api/circles/my/invite — inviter une connaissance par email
    app.post("/api/circles/my/invite", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { email, message } = req.body;
        if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          return res.status(400).json({ error: "Email invalide" });
        }
        if (!message?.trim()) return res.status(400).json({ error: "Le message est requis" });

        const { circles, circleMembers } = await import("@shared/schema");
        const [membership] = await db.select().from(circleMembers)
          .where(and(eq(circleMembers.userId, userId), eq(circleMembers.status, "active"))).limit(1);
        if (!membership) return res.status(403).json({ error: "Aucun Cercle actif" });

        const [circle] = await db.select().from(circles).where(eq(circles.id, membership.circleId)).limit(1);
        const sender = await db.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, userId)).limit(1);
        const senderName = sender[0] ? `${sender[0].firstName || ""} ${sender[0].lastName || ""}`.trim() : "Un membre";

        const { sendEmail } = await import("./resendService");
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#2A2A2A">
            <div style="background:#0A3400;padding:24px 32px;border-radius:8px 8px 0 0">
              <h1 style="color:#F8F6F3;font-size:22px;margin:0">Rebond</h1>
              <p style="color:#a3c99a;font-size:13px;margin:4px 0 0">La plateforme d'entraide professionnelle</p>
            </div>
            <div style="background:#ffffff;padding:28px 32px;border:1px solid #eee;border-top:none">
              <p style="font-size:15px;margin-top:0">${senderName} t'invite à rejoindre son Cercle <strong>${circle?.name || "Rebond"}</strong> :</p>
              <blockquote style="border-left:3px solid #2D9326;margin:16px 0;padding:12px 16px;background:#f6faf6;border-radius:0 6px 6px 0;font-size:14px;white-space:pre-wrap">${message.trim()}</blockquote>
              <div style="margin-top:24px;text-align:center">
                <a href="https://rebond.pro" style="display:inline-block;background:#2D9326;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px">
                  Rejoindre Rebond
                </a>
              </div>
              <p style="font-size:12px;color:#888;margin-top:24px">Tu reçois cet email parce que ${senderName} a pensé à toi. Tu peux ignorer ce message si tu ne souhaites pas rejoindre la plateforme.</p>
            </div>
          </div>`;

        const result = await sendEmail({
          to: email.trim(),
          subject: `${senderName} t'invite à rejoindre son Cercle Rebond`,
          html,
          replyTo: req.user.email || undefined,
        });

        if (!result.success) return res.status(500).json({ error: "Failed to send email" });
        res.json({ ok: true });
      } catch (err: any) {
        console.error("[Circles] Invite error:", err.message);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    console.log("[Routes] Les Cercles endpoints registered");
  }

  // ---------- BETA REPORTS ----------
  app.post("/api/beta/report", isAuthenticated, async (req: any, res) => {
    try {
      const { description, url, userAgent } = req.body;
      const userId = req.user?.id ?? null;
      const userName = req.user?.firstName ? `${req.user.firstName} ${req.user.lastName ?? ''}`.trim() : req.user?.email ?? 'Utilisateur inconnu';
      const userEmail = req.user?.email ?? '';

      if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: "Description manquante" });
      }

      const { pool } = await import("./db");
      const result = await pool.query(
        `INSERT INTO beta_reports (user_id, description, url, user_agent)
         VALUES ($1, $2, $3, $4)
         RETURNING id, reported_at`,
        [userId, description.trim(), url || '', userAgent || '']
      );
      const report = result.rows[0];

      // Email admin
      try {
        const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        await sendEmail({
          to: 'vincent.tallepied@rebond.pro',
          from: SENDER_ALERTS,
          subject: `[Beta] Nouveau signalement #${report.id}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto">
              <div style="background:#0A3400;padding:20px 28px;border-radius:8px 8px 0 0">
                <h2 style="color:#F8F6F3;margin:0;font-size:18px">Signalement beta #${report.id}</h2>
                <p style="color:#a3c99a;margin:4px 0 0;font-size:12px">${now}</p>
              </div>
              <div style="background:#fff;padding:24px 28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="padding:6px 0;color:#666;width:100px">Utilisateur</td><td style="padding:6px 0;font-weight:500">${userName}${userEmail ? ` — ${userEmail}` : ''}</td></tr>
                  <tr><td style="padding:6px 0;color:#666">Page</td><td style="padding:6px 0"><code style="font-size:12px;background:#f5f5f5;padding:2px 6px;border-radius:3px">${url || '—'}</code></td></tr>
                </table>
                <div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:6px;border-left:3px solid #2D9326">
                  <p style="margin:0;font-size:15px;white-space:pre-wrap">${description.trim()}</p>
                </div>
                <p style="margin-top:20px;font-size:12px;color:#999">User-agent : ${userAgent || '—'}</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.error("[Beta] Failed to send report email:", emailErr?.message);
      }

      res.json({ success: true, id: report.id });
    } catch (error: any) {
      console.error("[Beta] Report error:", error.message);
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  console.log("[Routes] Beta report endpoint registered");

  // ── Server-side HTML for public marketing routes ──────────────────────────
  // These handlers intercept GET requests for known public pages BEFORE the
  // Vite/static catch-all, and return the SPA shell with route-specific meta
  // tags so social bots and AI crawlers see meaningful HTML.

  for (const page of PUBLIC_PAGE_META) {
    const initialBodyHtml = page.initialBody === "cv-analysis" ? cvAnalysisInitialHtml()
      : page.initialBody === "linkedin-analysis" ? linkedinAnalysisInitialHtml()
      : page.initialBody === "salary-estimate" ? salaryEstimateInitialHtml()
      : page.initialBody === "riasec-test" ? riasecTestInitialHtml() : undefined;
    app.get(page.path, async (req, res, next) => {
      try {
        const html = await buildSeoHtml({
          title: page.title,
          description: page.description,
          canonical: page.canonical,
          h1: page.h1,
          noindex: page.noindex,
          ogImage: page.ogImage,
          suppressKeywords: page.suppressKeywords,
          initialBodyHtml,
          jsonLd: page.jsonLd ?? (page.featureName ? {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                name: page.title.replace(/ \| Rebond$/, ""),
                url: page.canonical,
                description: page.description,
                isPartOf: { "@type": "WebSite", name: "Rebond", url: "https://rebond.pro" },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Accueil", item: "https://rebond.pro/" },
                  { "@type": "ListItem", position: 2, name: "Fonctionnalités", item: "https://rebond.pro/fonctionnalites" },
                  { "@type": "ListItem", position: 3, name: page.featureName, item: page.canonical },
                ],
              },
            ],
          } : undefined),
        });
        res.set("Content-Type", "text/html").send(html);
      } catch {
        next();
      }
    });
  }

  // ── Server-side preview HTML for shared CV links ───────────────────────────
  // Shared CV tokens are private (noindex) but still benefit from OG tags so
  // messaging apps can render a meaningful preview when the link is pasted.
  app.get("/cv/share/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      const [document] = await db.select({
        name: cvGeneratedDocuments.name,
        userId: cvGeneratedDocuments.userId,
        shareableLinkExpiry: cvGeneratedDocuments.shareableLinkExpiry,
      }).from(cvGeneratedDocuments)
        .where(eq(cvGeneratedDocuments.shareableLink, token));

      if (!document || (document.shareableLinkExpiry && new Date(document.shareableLinkExpiry) < new Date())) {
        return next();
      }

      const [user] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
        headline: users.headline,
      }).from(users).where(eq(users.id, document.userId));

      const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
      const title = document.name
        ? `${document.name}${authorName ? ` — ${authorName}` : ""} | Rebond`
        : `CV partagé${authorName ? ` de ${authorName}` : ""} | Rebond`;
      const description = user?.headline
        ? `Consultez le CV de ${authorName}, ${user.headline}, partagé via Rebond.`
        : `Consultez ce CV partagé via Rebond, la plateforme de carrière pour cadres en France.`;

      const html = await buildSeoHtml({
        title,
        description,
        canonical: `https://rebond.pro/cv/share/${token}`,
        noindex: true,
      });
      res.set("Content-Type", "text/html").send(html);
    } catch {
      next();
    }
  });

  // ── Server-side preview HTML for mentor invite links ───────────────────────
  app.get("/mentor/invite/:token", async (req, res, next) => {
    try {
      const invite = await storage.getMentorInviteByToken(req.params.token);

      if (!invite || invite.status !== "pending" || new Date() > new Date(invite.expiresAt)) {
        return next();
      }

      const mentorName = invite.mentorName ?? "";
      const title = mentorName
        ? `Invitation mentor pour ${mentorName} | Rebond`
        : "Invitation mentor | Rebond";
      const description = mentorName
        ? `${mentorName} a été invité à rejoindre Rebond en tant que mentor. Acceptez votre invitation et aidez des professionnels à accélérer leur carrière.`
        : "Vous avez été invité à rejoindre Rebond en tant que mentor. Acceptez votre invitation pour accompagner des professionnels dans leur recherche d'emploi.";

      const html = await buildSeoHtml({
        title,
        description,
        canonical: `https://rebond.pro/mentor/invite/${req.params.token}`,
        noindex: true,
      });
      res.set("Content-Type", "text/html").send(html);
    } catch {
      next();
    }
  });

  // ── 301 redirect: UUID-based /emploi/o/{uuid} → slug-based /emploi/o/{slug} ─
  // If the path token looks like a bare UUID, redirect permanently to either the
  // canonical slug URL or the live job board when the offer is gone. Registered
  // last so all API routes take priority. Falls through for slug URLs and lookup
  // errors so the SPA can handle those requests normally.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  app.get('/emploi/o/:token', async (req, res, next) => {
    const { token } = req.params;
    if (!UUID_RE.test(token)) { next(); return; }
    try {
      const { publicJobSearchService } = await import("./services/publicJobSearchService");
      const job = await publicJobSearchService.getJobById(token);
      if (job && job.isActive && job.slug && job.slug !== token) {
        res.redirect(301, `/emploi/o/${job.slug}`);
        return;
      }
      if (!job || !job.isActive) {
        res.redirect(301, 'https://rebond.pro/emploi');
        return;
      }
    } catch {
      // fall through to SPA on any error
    }
    next();
  });

  const httpServer = existingServer ?? createServer(app);

  return httpServer;
}
// Force rebuild 1769121616
