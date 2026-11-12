/**
 * Registre unique des pages publiques.
 *
 * Chaque branche de session du routeur (`Router` dans App.tsx) insère
 * `renderPublicRoutes(ctx)` avant ses propres routes. Une page « partagée »
 * s'ouvre donc avec le même contenu pour un visiteur, un compte en onboarding
 * incomplet, un compte complet (administrateur compris) et un mentor. Ajouter
 * une page publique ici suffit à la rendre accessible dans tous ces états.
 *
 * Les seules différences selon la session sont les entrées `kind: "session"`.
 * Chacune porte sa justification ; une session absente de `variants` laisse la
 * main aux routes propres de la branche puis à la 404, exactement comme avant.
 *
 * `layout` pilote aussi la navigation : « marketing » masque la navigation de
 * l'application (la page porte son propre en-tête public).
 */
import { lazy } from "react";
import type { ComponentProps, ComponentType, ReactElement, ReactNode } from "react";
import { Route } from "wouter";
import { Redirect } from "@/components/RouteRedirect";
import { authReturnPath } from "@/lib/authNavigation";
import { employmentPath } from "@shared/employmentPilot";
import {
  LINKEDIN_LEAD_LOADING_PATH,
  LINKEDIN_LEAD_PATH,
  LINKEDIN_LEAD_RESULT_ROUTE,
  linkedinMemberDestination,
} from "@/lib/linkedinLeadJourney";
import { SALARY_LEAD_LOADING_PATH, SALARY_LEAD_PATH, SALARY_LEAD_RESULT_ROUTE } from "@/lib/salaryLeadJourney";
import { RIASEC_LEAD_PATH, RIASEC_LEAD_QUIZ_PATH, RIASEC_LEAD_RESULT_ROUTE } from "@/lib/riasecLeadJourney";

const BetaLanding = lazy(() => import("@/pages/BetaLanding"));
const SignupOverlayRoute = lazy(() => import("@/pages/SignupOverlayRoute"));
const SignupPersonaPage = lazy(() => import("@/pages/SignupPersona"));
const SigninOverlayRoute = lazy(() => import("@/pages/SigninOverlayRoute"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const MentorSignup = lazy(() => import("@/pages/MentorSignup"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const CvLeadAnalysis = lazy(() => import("@/pages/CvLeadAnalysis"));
const CvLeadAnalysisLoading = lazy(() => import("@/pages/CvLeadAnalysisLoading"));
const LinkedinLeadAnalysis = lazy(() => import("@/pages/LinkedinLeadAnalysis"));
const LinkedinLeadAnalysisLoading = lazy(() => import("@/pages/LinkedinLeadAnalysisLoading"));
const SalaryLeadAnalysis = lazy(() => import("@/pages/SalaryLeadAnalysis"));
const SalaryLeadLoading = lazy(() => import("@/pages/SalaryLeadLoading"));
const SalaryLeadResult = lazy(() => import("@/pages/SalaryLeadResult"));
const RiasecLeadLanding = lazy(() => import("@/pages/RiasecLeadLanding"));
const RiasecLeadQuiz = lazy(() => import("@/pages/RiasecLeadQuiz"));
const RiasecLeadResult = lazy(() => import("@/pages/RiasecLeadResult"));
const PublicJobBoard = lazy(() => import("@/pages/PublicJobBoard"));
const JobMetiersHub = lazy(() => import("@/pages/JobMetiersHub"));
const PublicJobDetail = lazy(() => import("@/pages/PublicJobDetail"));
const EmploymentPilot = lazy(() => import("@/pages/EmploymentPilot"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const About = lazy(() => import("@/pages/About"));
const Fonctionnalites = lazy(() => import("@/pages/Fonctionnalites"));
const FeatureLandingRoute = lazy(() => import("@/pages/FeatureLandingPages").then((module) => ({ default: module.FeatureLandingRoute })));
const SitemapPage = lazy(() => import("@/pages/SitemapPage"));
const BandeARebond = lazy(() => import("@/pages/BandeARebond"));
const Temoignages = lazy(() => import("@/pages/Temoignages"));
const Presse = lazy(() => import("@/pages/Presse"));
const AuthorPage = lazy(() => import("@/pages/AuthorPage"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const SharedCv = lazy(() => import("@/pages/SharedCv"));
const LegalMentions = lazy(() => import("@/pages/LegalMentions"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const ConditionsGeneralesVente = lazy(() => import("@/pages/ConditionsGeneralesVente"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));

/** Branches du routeur. Un administrateur ayant terminé l'onboarding est un `member`. */
export type PublicSession = "visitor" | "onboarding" | "member" | "mentor";
export const PUBLIC_SESSIONS: readonly PublicSession[] = ["visitor", "onboarding", "member", "mentor"];

export interface PublicActions {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

/**
 * Définition unique des boutons de connexion et d'inscription des pages publiques.
 * - visiteur : la connexion ouvre /signin, l'inscription ouvre la fenêtre d'inscription ;
 * - compte connecté (onboarding ou complet) : l'inscription mène à /signup, qui
 *   redirige vers l'accueil de la session ; la connexion renvoie vers l'application ;
 * - mentor : l'inscription ne fait rien, un mentor ne se voit proposer ni compte
 *   utilisateur ni formule payante.
 */
export function publicActionsForSession(
  session: PublicSession,
  handlers: { openLogin: () => void; openSignupDialog: () => void; openSignupPage: () => void },
): PublicActions {
  const onOpenRegister = session === "visitor"
    ? handlers.openSignupDialog
    : session === "mentor"
      ? () => {}
      : handlers.openSignupPage;
  return { onOpenLogin: handlers.openLogin, onOpenRegister };
}

export interface PublicRouteContext {
  session: PublicSession;
  actions: PublicActions;
  /** Chemin logique courant (sans le préfixe /app). */
  location: string;
  /** Remonte l'analyse LinkedIn quand l'identité change. */
  analysisKey: string;
  onCvLeadUnlock: NonNullable<ComponentProps<typeof CvLeadAnalysis>["onUnlock"]>;
  signup: {
    /** Compte connecté sans question de persona en attente : /signup le renvoie à sa destination. */
    leaveForSignedInAccount: boolean;
    showPersonaQuestion: boolean;
    onPersonaComplete: () => void;
  };
  /** Destination d'un compte connecté qui ouvre /signin. */
  signedInSigninDestination: () => string;
}

type RouteParams = Record<string, string | undefined>;
type PublicRender = (ctx: PublicRouteContext, params: RouteParams) => ReactNode;

/**
 * - `marketing` : page publique avec son propre en-tête ; la navigation de l'application est masquée.
 * - `app` : la navigation de l'application reste visible pour un compte connecté.
 * - `public-home` : marketing uniquement à l'adresse physique « / » ; sous /app, c'est l'accueil membre.
 */
export type PublicLayout = "marketing" | "app" | "public-home";

interface PublicRouteBase {
  path: string;
  layout: PublicLayout;
}
export interface SharedPublicRoute extends PublicRouteBase {
  kind: "shared";
  render: PublicRender;
}
export interface SessionPublicRoute extends PublicRouteBase {
  kind: "session";
  /** Pourquoi le rendu dépend de la session (comportement volontaire, inchangé). */
  reason: string;
  variants: Partial<Record<PublicSession, PublicRender>>;
}
export type PublicRouteDefinition = SharedPublicRoute | SessionPublicRoute;

const shared = (path: string, layout: PublicLayout, render: PublicRender): SharedPublicRoute =>
  ({ kind: "shared", path, layout, render });
const bySession = (
  path: string,
  layout: PublicLayout,
  reason: string,
  variants: Partial<Record<PublicSession, PublicRender>>,
): SessionPublicRoute => ({ kind: "session", path, layout, reason, variants });

const editorial = (Page: ComponentType<PublicActions>): PublicRender =>
  (ctx) => <Page onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />;
const cvAnalysis = (signedIn: boolean): PublicRender => (ctx) => (
  <CvLeadAnalysis
    key={ctx.analysisKey}
    onOpenLogin={ctx.actions.onOpenLogin}
    onOpenRegister={ctx.actions.onOpenRegister}
    onUnlock={ctx.onCvLeadUnlock}
    isAuthenticated={signedIn}
  />
);
const linkedinAnalysis = (signedIn: boolean): PublicRender => (ctx) => (
  <LinkedinLeadAnalysis
    key={ctx.analysisKey}
    onOpenLogin={ctx.actions.onOpenLogin}
    onOpenRegister={ctx.actions.onOpenRegister}
    isAuthenticated={signedIn}
  />
);
const redirectTo = (to: string): PublicRender => () => <Redirect to={to} />;
const linkedinMember: PublicRender = (_ctx, params) => <Redirect to={linkedinMemberDestination(
  params.id, typeof window === "undefined" ? "" : window.location.search,
)} />;
const linkedinMemberReason = "Les visiteurs conservent le parcours public ; les comptes connectés retrouvent leurs analyses et le rapport demandé dans l’onglet LinkedIn du profil.";
const mentorSignIn: PublicRender = () => <SignIn mentorOnly />;
const signedInSignin: PublicRender = (ctx) => <Redirect to={ctx.signedInSigninDestination()} />;
const signedInAnalysisReason =
  "Présentation connectée des analyses : un visiteur voit la version publique, un compte connecté la version intégrée à l'application (bandeau et navigation).";

/**
 * Ordre = priorité : les chemins précis précèdent les chemins paramétrés qu'ils
 * recouvrent (ex. /emploi/metiers avant /emploi/:metier/:ville).
 */
export const PUBLIC_ROUTES: readonly PublicRouteDefinition[] = [
  // ── Accueil, inscription et connexion ─────────────────────────────────────
  bySession("/", "public-home",
    "Accueil selon la session : page publique pour un visiteur ou un compte en onboarding, espace mentor pour un mentor. L'accueil d'un compte complet est le tableau de bord privé, déclaré dans sa branche.",
    {
      visitor: editorial(BetaLanding),
      onboarding: editorial(BetaLanding),
      mentor: redirectTo("/mentor"),
    }),
  bySession("/beta", "app",
    "Ancienne URL de la bêta, redirigée vers l'accueil. Les mentors n'ont jamais eu cette ancienne URL (404).",
    { visitor: redirectTo("/"), onboarding: redirectTo("/"), member: redirectTo("/") }),
  bySession("/signup", "app",
    "Inscription : réservée aux visiteurs ; un compte connecté retourne à son accueil (ou à sa destination si la question de persona n'est pas en attente).",
    {
      visitor: (ctx) => ctx.signup.leaveForSignedInAccount
        ? <Redirect to={authReturnPath()} />
        : <SignupOverlayRoute showPersonaQuestion={ctx.signup.showPersonaQuestion} onPersonaComplete={ctx.signup.onPersonaComplete} />,
      onboarding: redirectTo("/"),
      member: redirectTo("/"),
      mentor: redirectTo("/"),
    }),
  bySession("/signup-persona", "app",
    "Parcours de persona : question posée après la création d'un compte utilisateur. Un visiteur revient à l'inscription ; un mentor n'y a pas accès (404).",
    { visitor: redirectTo("/signup"), onboarding: () => <SignupPersonaPage />, member: () => <SignupPersonaPage /> }),
  bySession("/login", "app",
    "Ancienne URL de connexion : un visiteur est redirigé vers /signin en conservant la requête (ex. erreur OAuth). Pour un compte connecté elle n'existe pas (404).",
    {
      visitor: () => {
        // Preserve any query (e.g. ?error=linkedin_auth_failed coming back from
        // the OAuth callback) when redirecting to /signin.
        const search = typeof window !== "undefined" ? window.location.search : "";
        return <Redirect to={`/signin${search}`} />;
      },
    }),
  bySession("/signin", "app",
    "Connexion : page réservée aux visiteurs. Un compte connecté rejoint son accueil (rapport LinkedIn en attente, espace mentor ou destination demandée).",
    { visitor: () => <SigninOverlayRoute />, onboarding: signedInSignin, member: signedInSignin, mentor: signedInSignin }),
  bySession("/forgot-password", "app",
    "Mot de passe oublié : réservé aux visiteurs ; un compte connecté reçoit la 404.",
    { visitor: () => <ForgotPassword /> }),
  bySession("/reset-password", "app",
    "Réinitialisation du mot de passe : réservée aux visiteurs ; un compte connecté reçoit la 404.",
    { visitor: () => <ResetPassword /> }),

  // ── Accès mentor ──────────────────────────────────────────────────────────
  shared("/mentor/invite/:token", "app", () => <MentorSignup />),
  bySession("/mentor/login", "app",
    "Accès mentor : connexion mentor pour un visiteur ou un compte utilisateur ; un mentor connecté rejoint son espace. Absent pendant l'onboarding incomplet (404).",
    { visitor: mentorSignIn, member: mentorSignIn, mentor: redirectTo("/mentor") }),
  bySession("/mentor", "app",
    "Accès mentor : connexion mentor pour un visiteur ou un compte utilisateur. Pour un mentor, son tableau de bord privé est déclaré dans la branche mentor. Absent pendant l'onboarding incomplet (404).",
    { visitor: mentorSignIn, member: mentorSignIn }),

  // ── Analyses de CV et LinkedIn ────────────────────────────────────────────
  bySession("/analyse-cv", "app", signedInAnalysisReason,
    { visitor: cvAnalysis(false), onboarding: cvAnalysis(true), member: cvAnalysis(true), mentor: cvAnalysis(true) }),
  shared("/analyse", "marketing", () => <CvLeadAnalysisLoading />),
  bySession(LINKEDIN_LEAD_RESULT_ROUTE, "app", linkedinMemberReason,
    { visitor: linkedinAnalysis(false), onboarding: linkedinMember, member: linkedinMember, mentor: linkedinMember }),
  shared(LINKEDIN_LEAD_LOADING_PATH, "app", () => <LinkedinLeadAnalysisLoading />),
  bySession(LINKEDIN_LEAD_PATH, "app", linkedinMemberReason,
    { visitor: linkedinAnalysis(false), onboarding: linkedinMember, member: linkedinMember, mentor: linkedinMember }),

  // ── Estimation de salaire (publique en entier pour l'instant) ─────────────
  shared(SALARY_LEAD_RESULT_ROUTE, "marketing", (ctx) => <SalaryLeadResult onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),
  shared(SALARY_LEAD_LOADING_PATH, "marketing", () => <SalaryLeadLoading />),
  shared(SALARY_LEAD_PATH, "marketing", (ctx) => <SalaryLeadAnalysis onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),

  // ── Test RIASEC (public en entier pour l'instant) ─────────────────────────
  shared(RIASEC_LEAD_RESULT_ROUTE, "marketing", (ctx) => <RiasecLeadResult onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),
  shared(RIASEC_LEAD_QUIZ_PATH, "marketing", () => <RiasecLeadQuiz />),
  shared(RIASEC_LEAD_PATH, "marketing", (ctx) => <RiasecLeadLanding onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),

  // ── Tarification ──────────────────────────────────────────────────────────
  bySession("/pricing", "app",
    "Tarification intégrée à la navigation pour les comptes connectés ; les visiteurs gardent l'en-tête public. Les mentors ne doivent voir aucune proposition d'achat : la page reste absente pour eux (404).",
    {
      visitor: (ctx) => <Pricing onOpenRegister={ctx.actions.onOpenRegister} />,
      onboarding: (ctx) => <Pricing onOpenRegister={ctx.actions.onOpenRegister} />,
      member: (ctx) => <Pricing onOpenRegister={ctx.actions.onOpenRegister} />,
    }),

  // ── Offres d'emploi ───────────────────────────────────────────────────────
  shared("/emploi/o/:id", "marketing", editorial(PublicJobDetail)),
  shared("/emploi/metiers", "marketing", editorial(JobMetiersHub)),
  shared("/emploi/:metier/:ville", "marketing", (ctx) =>
    <EmploymentPilot kind="pair" onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),
  shared(employmentPath("city"), "marketing", (ctx) =>
    <EmploymentPilot kind="city" onOpenLogin={ctx.actions.onOpenLogin} onOpenRegister={ctx.actions.onOpenRegister} />),
  shared("/emploi", "marketing", (ctx) => <PublicJobBoard onOpenRegister={ctx.actions.onOpenRegister} />),

  // ── Pages éditoriales ─────────────────────────────────────────────────────
  shared("/faq", "marketing", editorial(FAQ)),
  shared("/a-propos", "marketing", editorial(About)),
  shared("/fonctionnalites/:featureSlug", "marketing", (ctx, params) => (
    <FeatureLandingRoute slug={params.featureSlug ?? ""} onOpenRegister={ctx.actions.onOpenRegister} onOpenLogin={ctx.actions.onOpenLogin} />
  )),
  shared("/fonctionnalites", "marketing", editorial(Fonctionnalites)),
  shared("/plan-du-site", "marketing", editorial(SitemapPage)),
  shared("/bande-a-rebond", "marketing", editorial(BandeARebond)),
  shared("/temoignages", "marketing", editorial(Temoignages)),
  shared("/presse", "marketing", editorial(Presse)),
  shared("/auteur/:slug", "marketing", editorial(AuthorPage)),
  shared("/blog/auteur/:slug", "marketing", editorial(AuthorPage)),
  shared("/blog/:slug", "marketing", editorial(BlogPost)),
  shared("/blog", "marketing", editorial(Blog)),
  shared("/cv/share/:token", "app", () => <SharedCv />),

  // ── Pages légales et désinscription ───────────────────────────────────────
  shared("/legal", "marketing", editorial(LegalMentions)),
  shared("/cgu", "marketing", editorial(TermsOfService)),
  shared("/confidentialite", "marketing", editorial(PrivacyPolicy)),
  shared("/cgv", "marketing", editorial(ConditionsGeneralesVente)),
  // Désinscription : le lien des e-mails porte son jeton, indépendant de la session.
  // Les préférences d'un compte connecté restent dans « Mon compte » (/email-accounts).
  shared("/unsubscribe", "marketing", () => <Unsubscribe />),
];

/**
 * Correspondance identique à celle de wouter pour les motifs du registre :
 * insensible à la casse, barre oblique finale facultative, `:param` = un segment.
 */
export function matchesPublicPattern(pattern: string, path: string): boolean {
  const pathname = path.split(/[?#]/)[0] || "/";
  const split = (value: string) => value.replace(/\/+$/, "").split("/").slice(1);
  const expected = split(pattern);
  const actual = split(pathname);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => segment.startsWith(":")
    ? actual[index] !== ""
    : segment.toLowerCase() === actual[index].toLowerCase());
}

/** Première entrée du registre qui correspond au chemin logique (même priorité que le routeur). */
export function findPublicRoute(path: string): PublicRouteDefinition | undefined {
  return PUBLIC_ROUTES.find((route) => matchesPublicPattern(route.path, path));
}

/** Une page est « marketing » pour la navigation seulement si le registre la déclare ainsi. */
export function usesMarketingLayout(location: string, physicalLocation: string): boolean {
  const route = findPublicRoute(location);
  if (!route) return false;
  if (route.layout === "public-home") return physicalLocation === "/";
  return route.layout === "marketing";
}

export function publicRouteRender(route: PublicRouteDefinition, session: PublicSession): PublicRender | undefined {
  return route.kind === "shared" ? route.render : route.variants[session];
}

/** Routes du registre pour une branche de session, à placer avant les routes propres de la branche. */
export function renderPublicRoutes(ctx: PublicRouteContext): ReactElement[] {
  return PUBLIC_ROUTES.flatMap((route) => {
    const render = publicRouteRender(route, ctx.session);
    if (!render) return [];
    return [
      <Route key={route.path} path={route.path}>
        {(params: RouteParams) => render(ctx, params)}
      </Route>,
    ];
  });
}
