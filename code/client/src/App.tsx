import { AnalysisQuotaPaywall } from "@/components/AnalysisQuota";
import { useState, useEffect, useRef, Component, lazy, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Switch, Route, useLocation, useSearch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus, PaywallStatus } from "@/hooks/use-subscription";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useLandscapePhone } from "@/hooks/use-landscape-phone";
import { identifyUser, capture, captureAccountCreated, capturePageview, updateCommercialPerson } from "@/lib/posthog";
import { useCsrfToken } from "@/hooks/use-csrf-token";
import { HelmetProvider } from "react-helmet-async";
import { useWorkflowNotifications } from "@/hooks/use-workflow-notifications";
import WaitlistModal from "@/components/WaitlistModal";
import { hasPendingCheckoutIntent, resumeCheckoutAfterAuth } from "@/components/PricingPlans";
import homepageHeroUrl from "@assets/Hero_1774465812932.webp";
import type { CvSignupSeed } from "@/types/cvSignup";
import { isSignupPersonaQuestionPending as hasPendingSignupPersonaQuestion } from "@shared/signupJourney";
import { authReturnPath, authRouteLocation } from "@/lib/authNavigation";
import { useBrowserLocation } from "wouter/use-browser-location";
import { MemberRouter } from "@/lib/memberRouter";
import { appPath, isAppPath, isLegacyMemberPath } from "@shared/appPaths";
import AuthTransition from "@/components/AuthTransition";
import { Redirect } from "@/components/RouteRedirect";
import {
  publicActionsForSession,
  renderPublicRoutes,
  usesMarketingLayout,
  type PublicRouteContext,
  type PublicSession,
} from "@/lib/publicRoutes";
import { signupCompletionPath } from "@shared/signupJourney";
import {
  clearLinkedinLeadLoadingProfile,
  clearLinkedinLeadPreview,
  LINKEDIN_LEAD_LEGACY_RESULT_KEY,
  LINKEDIN_LEAD_PATH,
  LINKEDIN_LEAD_PENDING_KEY,
  linkedinResumePath,
  LINKEDIN_PROFILE_PATH,
} from "@/lib/linkedinLeadJourney";

// Private navigation (including agenda/search panels) is not needed to paint
// the public homepage. Its own boundaries keep route content mounted while
// these chunks load after sign-in.
const DesktopNav = lazy(() => import("@/components/DesktopNav"));
const MobileNav = lazy(() => import("@/components/MobileNav"));
const TopBar = lazy(() => import("@/components/TopBar"));
const BootcampActionFloater = lazy(() => import("@/components/bootcamp/BootcampActionFloater")
  .then(module => ({ default: module.BootcampActionFloater })));
const AiQuotaBanner = lazy(() => import("@/components/AiQuotaBanner"));
const AdminPlanTestBanner = lazy(() => import("@/components/AdminPlanTestBanner"));

const loadSignUpModal = () => import("@/components/SignUpModal");
const SignUpModal = lazy(loadSignUpModal);
const loadBetaLanding = () => import("@/pages/BetaLanding");
const OffboardingPage = lazy(() => import("@/pages/OffboardingPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// The public homepage is behind the auth check, so without an early hint the
// browser discovers both its route chunk and its LCP image too late.
if (typeof window !== "undefined" && window.location.pathname === "/") {
  void loadBetaLanding();
  if (!document.head.querySelector('link[data-homepage-hero-preload]')) {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = homepageHeroUrl;
    preload.setAttribute("fetchpriority", "high");
    preload.setAttribute("data-homepage-hero-preload", "true");
    document.head.appendChild(preload);
  }
}
const Learn = lazy(() => import("@/pages/Learn"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const JobRecommendations = lazy(() => import("@/pages/JobRecommendations"));
// Preserve tracking deep links; C13 can explicitly open the existing search
// screen under /app/jobs without moving either product's default entry point.
function MemberJobsRoute() {
  const search = useSearch();
  return new URLSearchParams(search).get("view") === "search" ? <JobRecommendations /> : <Jobs />;
}
const Network = lazy(() => import("@/pages/Network"));
const Business = lazy(() => import("@/pages/Business"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const Community = lazy(() => import("@/pages/Community"));
const CommunityGroup = lazy(() => import("@/pages/CommunityGroup"));
const Interviews = lazy(() => import("@/pages/Interviews"));
const Actions = lazy(() => import("@/pages/Actions"));
const Profile = lazy(() => import("@/pages/Profile"));
const MyProgram = lazy(() => import("@/pages/MyProgram"));
const RebondIA = lazy(() => import("@/pages/RebondIA"));
const RebondIAV2 = lazy(() => import("@/pages/RebondIAV2"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const AdminMicrolearning = lazy(() => import("@/pages/AdminMicrolearning"));
const AdminWellbeing = lazy(() => import("@/pages/AdminWellbeing"));
const Wellbeing = lazy(() => import("@/pages/Wellbeing"));
const AdminOnboarding = lazy(() => import("@/pages/AdminOnboarding"));
const AdminOffboarding = lazy(() => import("@/pages/AdminOffboarding"));
const AdminDiscovery = lazy(() => import("@/pages/admin/AdminDiscovery"));
const DiscoveryManager = lazy(() => import("@/components/discovery/DiscoveryManager"));
const AdminAbTesting = lazy(() => import("@/pages/AdminAbTesting"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminSimulatedUserView = lazy(() => import("@/pages/AdminSimulatedUserView"));
const AdminReferrals = lazy(() => import("@/pages/AdminReferrals"));
const AdminWorkflows = lazy(() => import("@/pages/admin/AdminWorkflows"));
const AdminArtifacts = lazy(() => import("@/pages/AdminArtifacts"));
const AdminBlogPosts = lazy(() => import("@/pages/AdminBlogPosts"));
const AdminBlogCategories = lazy(() => import("@/pages/AdminBlogCategories"));
const AdminDailySuggestions = lazy(() => import("@/pages/AdminDailySuggestions"));
const AdminAiLogs = lazy(() => import("@/pages/AdminAiLogs"));
const AdminRobotLogs = lazy(() => import("@/pages/AdminRobotLogs"));
const AdminJobSearchEvidence = lazy(() => import("@/pages/AdminJobSearchEvidence"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminBootcamps = lazy(() => import("@/pages/admin/AdminBootcamps"));
const AdminActivation = lazy(() => import("@/pages/admin/AdminActivation"));
const AdminUserJourneys = lazy(() => import("@/pages/admin/AdminUserJourneys"));
const AdminModuleFeedback = lazy(() => import("@/pages/admin/AdminModuleFeedback"));
const AdminGoogleReviews = lazy(() => import("@/pages/admin/AdminGoogleReviews"));
const AdminHelpGuide = lazy(() => import("@/pages/AdminHelpGuide"));
const AdminWorkdayHealth = lazy(() => import("@/pages/admin/AdminWorkdayHealth"));
const AdminSitemapHealth = lazy(() => import("@/pages/admin/AdminSitemapHealth"));
const AdminEmploymentPages = lazy(() => import("@/pages/admin/AdminEmploymentPages"));
const AdminCvEnrichments = lazy(() => import("@/pages/admin/AdminCvEnrichments"));
const AdminPress = lazy(() => import("@/pages/AdminPress"));
const AdminSocialPosts = lazy(() => import("@/pages/AdminSocialPosts"));
const AdminJobSources = lazy(() => import("@/pages/AdminJobSources"));
const HelpGuidePage = lazy(() => import("@/pages/HelpGuidePage"));
const BootcampPage = lazy(() => import("@/pages/BootcampPage"));
const DigitalAssets = lazy(() => import("@/pages/DigitalAssets"));
const LessonViewer = lazy(() => import("@/pages/LessonViewer"));
const ModuleViewer = lazy(() => import("@/pages/ModuleViewer"));
const TestLearning = lazy(() => import("@/pages/TestLearning"));
const EmailAccounts = lazy(() => import("@/pages/EmailAccounts"));
const TargetCompaniesPage = lazy(() => import("@/pages/TargetCompaniesPage"));
const MentorDashboard = lazy(() => import("@/pages/MentorDashboard"));
const MentorDiscovery = lazy(() => import("@/pages/MentorDiscovery"));
const MenteeProfilePage = lazy(() => import("@/pages/MenteeProfilePage"));
const MyCercle = lazy(() => import("@/pages/MyCercle"));
const CvStudio = lazy(() => import("@/pages/CvStudio"));
const CvCoachPage = lazy(() => import("@/pages/CvCoachPage"));
const MyCvs = lazy(() => import("@/pages/MyCvs"));
const Candidature = lazy(() => import("@/pages/Candidature"));
const PublicJobAction = lazy(() => import("@/pages/PublicJobAction"));
const CandidatureReady = lazy(() =>
  import("@/pages/Candidature").then((m) => ({ default: m.CandidatureReady }))
);
const NotFound = lazy(() => import("@/pages/not-found"));

// Trial length mirrors server/lib/constants.ts TRIAL_DURATION_MS (14 days).
// Kept as a client-only literal since server modules aren't importable here.
const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function ProtectedSignInRedirect() {
  return <Redirect to={authRouteLocation("/signin", authReturnPath())} />;
}

// Scroll to top on forward navigation, preserve scroll on back/forward.
// The pop flag is consumed by the location effect when wouter notices a
// pathname change, AND cleared by a safety timeout otherwise — so a
// query-only popstate (e.g. ?step=… via useUrlStep) doesn't poison the
// next genuine forward navigation.
function ScrollToTop() {
  const [location] = useLocation();
  const isPopRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isPopRef.current = true;
      // Safety: clear after wouter has had time to process the popstate.
      // If pathname changed, the location effect below already cleared it.
      window.setTimeout(() => {
        isPopRef.current = false;
      }, 50);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isPopRef.current) {
      isPopRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

// Redirect masterclass slug to /my-program
function MasterclassRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/my-program", { replace: true });
  }, [setLocation]);
  return null;
}

// Redirect class slug to first lesson/module of that class
function ClassRedirect({ masterclassSlug, classSlug }: { masterclassSlug: string; classSlug: string }) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const fetchFirstModule = async () => {
      try {
        // First, get the class by slug
        const classResponse = await fetch(`/api/classes/by-slug/${classSlug}`);
        if (!classResponse.ok) {
          console.error("Failed to fetch class");
          setLocation("/my-program", { replace: true });
          return;
        }
        const classData = await classResponse.json();
        
        // Then get modules for that class
        const modulesResponse = await fetch(`/api/classes/${classData.id}/modules`);
        if (!modulesResponse.ok) {
          console.error("Failed to fetch modules");
          setLocation("/my-program", { replace: true });
          return;
        }
        const modules = await modulesResponse.json();
        
        if (modules.length > 0) {
          // Sort by order and get first module
          const firstModule = modules.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))[0];
          if (firstModule.slug) {
            setLocation(`/learn/${masterclassSlug}/${classSlug}/module/${firstModule.slug}`, { replace: true });
          } else {
            setLocation("/my-program", { replace: true });
          }
        } else {
          setLocation("/my-program", { replace: true });
        }
      } catch (error) {
        console.error("Error fetching first module:", error);
        setLocation("/my-program", { replace: true });
      }
    };
    
    fetchFirstModule();
  }, [masterclassSlug, classSlug, setLocation]);
  
  return null;
}

// Visit state types based on user authentication and history
type VisitState = 
  | "first_visit"           // Never registered, first time seeing the site
  | "returning_unauthenticated" // Had an account but not logged in (logout/expired)
  | "authenticated_incomplete" // Logged in but hasn't completed onboarding
  | "authenticated_complete";  // Logged in and completed onboarding

function Router() {
  const { isAuthenticated, isLoading, user, refetch, isFetching } = useAuth();
  const isMentor = (user as any)?.role === 'mentor';
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showSignupPersonaQuestion, setShowSignupPersonaQuestion] = useState(false);
  const [cvLeadSignupSeed, setCvLeadSignupSeed] = useState<CvSignupSeed | null>(null);
  const [isPreparingCvLeadSignup, setIsPreparingCvLeadSignup] = useState(false);
  const [location, setLocation] = useLocation();
  const [physicalLocation] = useBrowserLocation();
  // Initialize locationReady immediately if window.location.pathname is available (fixes Chrome Mac blank page)
  const [locationReady, setLocationReady] = useState(() => {
    // Check if we can read the pathname immediately (SSR-safe)
    if (typeof window !== 'undefined' && window.location?.pathname) {
      return true;
    }
    return false;
  });
  
  // Read OAuth/email signup markers synchronously so the legacy offboarding
  // redirect cannot win before the marker-handling effects run.
  const signupPersonaQuestionPending = typeof window !== "undefined" &&
    hasPendingSignupPersonaQuestion(
      window.location.search,
      sessionStorage.getItem("signupPersonaPending") === "true",
      sessionStorage.getItem("newlyRegistered") === "true",
      sessionStorage.getItem("signupFlow"),
    );
  // A prior account's browser flag cannot mark a newly created account as
  // onboarded while its signup persona question is still pending.
  const hasCompletedOnboarding = !!(
    (user as any)?.hasCompletedOnboarding ||
    (!signupPersonaQuestionPending && localStorage.getItem("hasSeenOnboarding") === "true")
  );
  
  // Check if user has ever registered (stored in localStorage after first successful registration)
  const hasAccount = localStorage.getItem("hasAccount") === "true";
  
  // Check if current path is an admin or lesson route
  const isAdminRoute = location.startsWith('/admin');
  const isLessonRoute = location.startsWith('/learn/');
  const isFeatureMarketingRoute = location === '/fonctionnalites' || location.startsWith('/fonctionnalites/');
  const isLinkedinLeadRoute = !isAppPath(physicalLocation) && (location === LINKEDIN_LEAD_PATH || location.startsWith(`${LINKEDIN_LEAD_PATH}/`));
  
  // Determine visit state
  const getVisitState = (): VisitState => {
    if (isAuthenticated) {
      return hasCompletedOnboarding ? "authenticated_complete" : "authenticated_incomplete";
    } else {
      return hasAccount ? "returning_unauthenticated" : "first_visit";
    }
  };
  
  const visitState = getVisitState();
  
  // Wait for wouter location to be properly initialized (fixes Chrome PC blank page issue)
  useEffect(() => {
    // Location is ready once it's a non-empty string or we've had a chance to initialize
    if (location || window.location.pathname) {
      setLocationReady(true);
    }
  }, [location]);
  
  // Version control for localStorage: reset flags if version changes (do this FIRST)
  useEffect(() => {
    const ONBOARDING_VERSION = "2.0";
    const storedVersion = localStorage.getItem("onboardingVersion");
    
    if (storedVersion !== ONBOARDING_VERSION) {
      localStorage.removeItem("hasSeenOnboarding");
      localStorage.removeItem("onboardingInProgress");
      localStorage.setItem("onboardingVersion", ONBOARDING_VERSION);
    }
  }, []);
  
  // Determine if we should redirect to onboarding on first render
  useEffect(() => {
    // Wait for authentication to finish loading before making routing decisions
    if (isLoading) return;

    // Platform is in coming-soon / waitlist mode: do NOT auto-show onboarding
    // for unauthenticated visitors. They see the WaitlistModal instead.
  }, [visitState, isAdminRoute, isLessonRoute, isLoading, isAuthenticated, hasAccount, hasCompletedOnboarding, location, setLocation]);

  // Identify user in PostHog when authenticated
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const u = user as any;
    identifyUser({
      id: u.id,
      role: u.role,
      analyticsInternal: u.analyticsInternal,
      createdAt: u.createdAt,
      authProvider: u.authProvider,
      offboardingPersona: u.offboardingPersona,
      analyticsPersona: u.analyticsPersona,
      hasCompletedOnboarding: u.hasCompletedOnboarding,
      cvParsed: u.cvParsed,
      trialEndsAt: u.trialEndsAt,
      emailPreferences: {
        emailUnsubscribed: u.emailUnsubscribed,
        unsubscribedActivation: u.unsubscribedActivation,
        unsubscribedNotifications: u.unsubscribedNotifications,
        unsubscribedMarketing: u.unsubscribedMarketing,
        unsubscribedJobDigest: u.unsubscribedJobDigest,
      },
    });
  }, [isLoading, isAuthenticated, user]);

  // Keep only the opaque analysis ID between authentication redirects.
  // It contains no CV content or generated report.
  useEffect(() => {
    if (isLoading || !isAuthenticated || isMentor || location.startsWith("/mentor/")) return;
    if (!sessionStorage.getItem("pendingCvLeadAnalysisId")) return;
    if (location !== "/analyse-cv") setLocation("/analyse-cv");
  }, [isLoading, isAuthenticated, location, setLocation]);

  // Restore the exact LinkedIn report after OAuth. Do not interrupt mentor,
  // signup-persona, or offboarding flows; those routes own their own steps.
  useEffect(() => {
    if (isLoading || !isAuthenticated || isMentor || location.startsWith("/mentor/")) return;
    if (location === "/signup-persona" || location.startsWith("/offboarding")) return;
    const pendingId = sessionStorage.getItem(LINKEDIN_LEAD_PENDING_KEY);
    if (!pendingId) return;
    const destination = linkedinResumePath(pendingId, window.location.pathname, window.location.search);
    if (`${window.location.pathname}${window.location.search}` !== destination) setLocation(destination, { replace: true });
  }, [isLoading, isAuthenticated, isMentor, location, setLocation]);

  // Subscription status query — gated on auth to avoid 401s for guests
  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/stripe/subscription"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && !!user,
  });
  const { data: commercialStatus } = useQuery<PaywallStatus>({
    queryKey: ["/api/paywall/status"],
    retry: false, staleTime: 30_000,
    enabled: isAuthenticated && !!user,
  });
  useEffect(() => {
    if (!user || !commercialStatus || commercialStatus.adminTest || commercialStatus.paywallExempt) return;
    updateCommercialPerson({
      candidatures_used: commercialStatus.quotas.candidates.used,
      coach_sessions_used: (commercialStatus.quotas.coachSessions ?? commercialStatus.quotas.simulations).used,
    });
  }, [commercialStatus, user]);

  // Update PostHog identify with the live subscription snapshot — the single
  // source of truth for subscription_plan/status/started_at (see identifyUser).
  useEffect(() => {
    if (!user || !subscription) return;
    const u = user as any;
    identifyUser({
      id: u.id,
      subscription: {
        plan: subscription.plan,
        status: subscription.status ?? null,
        startedAt: subscription.startedAt ?? null,
      },
    });
  }, [subscription, user]);

  // Detect subscription_cancelled when cancel_at_period_end becomes true
  // (explicit resiliation of a paid plan while it is still active).
  useEffect(() => {
    if (!user || !subscription?.cancelAtPeriodEnd) return;
    const u = user as any;
    const flagKey = `phSubCancelled:${u.id}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, "1");
    const wasTrial = subscription.status === "trialing";
    const daysActive = subscription.startedAt
      ? Math.max(0, Math.round((Date.now() - subscription.startedAt * 1000) / DAY_MS))
      : null;
    capture("subscription_cancelled", { plan: "premium", was_trial: wasTrial, reason: null, days_active: daysActive });
  }, [subscription, user]);

  // Detect an unconverted trial expiry (essai terminé sans passage au payant).
  // Client-only heuristic: fires the first time the user is seen back on the
  // app after their trial window has lapsed without becoming active/trialing.
  // Guarded to the last 30 days so legacy free accounts (trial ended long ago)
  // never emit a stale event on login.
  useEffect(() => {
    if (!user || !subscription) return;
    if (subscription.plan !== "free") return;
    if (subscription.status === "active" || subscription.status === "trialing") return;
    const u = user as any;
    const trialEnd = u.trialEndsAt
      ? new Date(u.trialEndsAt).getTime()
      : u.createdAt
        ? new Date(u.createdAt).getTime() + TRIAL_DAYS * DAY_MS
        : null;
    if (!trialEnd || trialEnd > Date.now()) return;
    if (Date.now() - trialEnd > 30 * DAY_MS) return;
    const flagKey = `phTrialExpired:${u.id}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, "1");
    const startedAt = u.createdAt ? new Date(u.createdAt).getTime() : trialEnd - TRIAL_DAYS * DAY_MS;
    const daysActive = Math.max(0, Math.round((trialEnd - startedAt) / DAY_MS));
    capture("subscription_cancelled", { plan: "premium", was_trial: true, reason: "trial_expired", days_active: daysActive });
  }, [subscription, user]);

  // Resume a pricing checkout after either local or OAuth authentication.
  // This runs before onboarding redirects so the user's subscription intent wins.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !hasPendingCheckoutIntent()) return;
    resumeCheckoutAfterAuth();
  }, [isLoading, isAuthenticated]);

  // Only fire signup events when the OAuth callback's server-issued marker is
  // present. Persist it once first so other URL-cleanup effects cannot consume it.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const u = user as any;
    const provider = u.authProvider === "linkedin" || u.authProvider === "google"
      ? u.authProvider
      : null;
    if (!provider) return;

    const params = new URLSearchParams(window.location.search);
    const callbackProvider = params.get("provider");
    const markerKey = `pendingSocialSignup:${u.id}`;
    if (params.get("new") === "true" && callbackProvider === provider) {
      sessionStorage.setItem(markerKey, provider);
    }
    if (sessionStorage.getItem(markerKey) !== provider) return;

    const firedKey = `phAccountCreated:${u.id}`;
    if (!localStorage.getItem(firedKey)) {
      localStorage.setItem(firedKey, "1");

      capture("account_created", {
        method: provider,
        with_cv: false,
        $set: { registration_method: provider },
      });

      const trialFlagKey = `phTrialFired:${u.id}`;
      if (!localStorage.getItem(trialFlagKey)) {
        localStorage.setItem(trialFlagKey, "1");
        capture("trial_started", { plan: "premium", trial_days: TRIAL_DAYS, source: "onboarding" });
      }
    }

    sessionStorage.removeItem(markerKey);
    if (params.has("new")) {
      params.delete("new");
      params.delete("provider");
      const newSearch = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash);
    }
  }, [isLoading, isAuthenticated, user]);

  // New social registrations return to the page where signup began. Open the
  // one-question signup dialog there, without sending users to another route.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || isMentor || location.startsWith("/mentor/")) return;
    const signupFlow = sessionStorage.getItem("signupFlow");
    if (signupFlow === "cv") {
      sessionStorage.removeItem("newlyRegistered");
      sessionStorage.removeItem("signupFlow");
      return;
    }
    if (location === "/signup-persona") return;
    const params = new URLSearchParams(window.location.search);
    const hasQuestionMarker = params.get("signupPersona") === "1";
    const hasPendingQuestion = sessionStorage.getItem("signupPersonaPending") === "true" ||
      (sessionStorage.getItem("newlyRegistered") === "true" && sessionStorage.getItem("signupFlow") !== "cv");
    if (!hasQuestionMarker && !hasPendingQuestion) return;

    const returnTo = params.get("signupReturnTo");
    if (hasQuestionMarker && returnTo) {
      sessionStorage.setItem("signupReturnTo", signupCompletionPath(returnTo));
    }

    for (const marker of ["signupPersona", "signupReturnTo", "provider", "new"]) params.delete(marker);
    const search = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
    // The persisted timestamp wins over stale browser flags (including Back).
    if ((user as any).offboardingCompletedAt) {
      sessionStorage.removeItem("signupPersonaPending");
      sessionStorage.removeItem("newlyRegistered");
      if (!showSignupPersonaQuestion && !hasPendingCheckoutIntent()) {
        const destination = sessionStorage.getItem("signupReturnTo");
        sessionStorage.removeItem("signupReturnTo");
        if (destination) setLocation(signupCompletionPath(destination), { replace: true });
      }
      return;
    }
    if (hasPendingCheckoutIntent() || sessionStorage.getItem("pendingCvLeadAnalysisId")) return;
    const u = user as any;
    const trialFlagKey = `phTrialFired:${u.id}`;
    if (!localStorage.getItem(trialFlagKey)) {
      localStorage.setItem(trialFlagKey, "1");
      capture("trial_started", { plan: "premium", trial_days: TRIAL_DAYS, source: "onboarding" });
    }
    // Consume the registration flag and keep the persona question in the
    // signup dialog on the page where account creation began.
    sessionStorage.removeItem("newlyRegistered");
    setShowOnboardingDialog(false);
    sessionStorage.setItem("signupPersonaPending", "true");
    setShowSignupPersonaQuestion(true);
    // /signup already owns its compact dialog; never mount a second one.
    if (physicalLocation !== "/signup") setShowSignupModal(true);
  }, [isLoading, isAuthenticated, user, location, physicalLocation, setLocation]);

  // Trigger offboarding for existing users who never saw it (offboardingCompletedAt === null)
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || isMentor || location.startsWith("/mentor/")) return;
    if (hasPendingCheckoutIntent()) return;
    if (signupPersonaQuestionPending) return;
    if (isAdminRoute || isLessonRoute || isFeatureMarketingRoute || isLinkedinLeadRoute || location === "/signup-persona" || physicalLocation === "/") return;
    if (location === "/analyse-cv" || location === "/analyse") return;
    if (location === "/estimation-salaire" || location.startsWith("/estimation-salaire/")) return;
    if (location === "/test-riasec" || location.startsWith("/test-riasec/")) return;
    if (location === "/mentor" || location === "/mentor/login") return;
    // Only for users who have completed onboarding (i.e. are on the platform proper)
    if (!hasCompletedOnboarding) return;
    // Skip if already shown or completed
    const u = user as any;
    if (u.offboardingCompletedAt) return;
    // Avoid showing on every reload — use a session flag
    if (sessionStorage.getItem("offboardingChecked") === "true") return;
    sessionStorage.setItem("offboardingChecked", "true");
    // Persona "delphine" hosts the AI voice-chat diagnostic that determines
    // the actual persona (eugene/etienne/mixte) and routes accordingly.
    setLocation("/offboarding?persona=delphine");
  }, [isLoading, isAuthenticated, user, hasCompletedOnboarding, signupPersonaQuestionPending, isAdminRoute, isLessonRoute, isFeatureMarketingRoute, isLinkedinLeadRoute, location, physicalLocation]);
  
  // Show loading state while location is initializing (prevents blank page on Chrome PC)
  if (!locationReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }
  
  // Handlers
  const handleOnboardingComplete = () => {
    setShowOnboardingDialog(false);
    // After onboarding, redirect to signin page
    setLocation("/signin");
  };

  const handleCancelOnboarding = () => {
    localStorage.removeItem("onboardingInProgress");
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboardingDialog(false);
    setLocation("/");
  };

  const handleOpenLogin = () => {
    if (isAuthenticated) {
      setLocation("/app");
      return;
    }
    localStorage.setItem("hasSeenOnboarding", "true");
    localStorage.removeItem("onboardingInProgress");
    setShowOnboardingDialog(false);
    setShowSignupModal(false);
    setLocation(authRouteLocation("/signin", authReturnPath()));
  };
  const handleOpenRegister = () => {
    if (isAuthenticated) {
      if (signupPersonaQuestionPending || showSignupPersonaQuestion) {
        setShowSignupModal(true);
      } else {
        setLocation(isMentor ? "/mentor" : "/app");
      }
      return;
    }
    localStorage.removeItem("hasSeenOnboarding");
    localStorage.removeItem("onboardingInProgress");
    setShowOnboardingDialog(false);
    setLocation("/signup");
  };

  const handleOpenSignupModal = () => {
    if (isAuthenticated) {
      handleOpenRegister();
      return;
    }
    localStorage.removeItem("hasSeenOnboarding");
    localStorage.removeItem("onboardingInProgress");
    setShowOnboardingDialog(false);
    setCvLeadSignupSeed(null);
    setIsPreparingCvLeadSignup(false);
    setShowSignupPersonaQuestion(false);
    setShowSignupModal(true);
  };

  const handleSignupPersonaComplete = () => {
    sessionStorage.removeItem("signupPersonaPending");
    setShowSignupPersonaQuestion(false);
    setShowSignupModal(false);
  };

  const handleCvLeadUnlock = ({
    pendingAnalysisId,
    status = "ready",
    signupSeed,
  }: {
    pendingAnalysisId: string;
    status?: "preparing" | "ready" | "failed";
    signupSeed?: CvSignupSeed;
  }) => {
    if (status === "preparing") {
      sessionStorage.setItem("pendingCvLeadAnalysisId", pendingAnalysisId);
    } else if (sessionStorage.getItem("pendingCvLeadAnalysisId") !== pendingAnalysisId) {
      // The visitor closed the modal while the CV signup seed was loading.
      return;
    }
    if (!isAuthenticated) {
      if (status === "failed") {
        sessionStorage.removeItem("pendingCvLeadAnalysisId");
        setIsPreparingCvLeadSignup(false);
        setShowSignupModal(false);
        return;
      }
      setIsPreparingCvLeadSignup(status === "preparing");
      if (signupSeed) setCvLeadSignupSeed(signupSeed);
      setShowSignupModal(true);
    }
  };

  // Shared context for the public route registry: the session decides the
  // signup/login actions once, instead of each router branch copying them.
  const publicRouteContext = (session: PublicSession): PublicRouteContext => ({
    session,
    actions: publicActionsForSession(session, {
      openLogin: handleOpenLogin,
      openSignupDialog: handleOpenSignupModal,
      openSignupPage: handleOpenRegister,
    }),
    location,
    analysisKey: String((user as any)?.id ?? "anonymous"),
    onCvLeadUnlock: handleCvLeadUnlock,
    signup: {
      leaveForSignedInAccount: isAuthenticated && !signupPersonaQuestionPending && !showSignupPersonaQuestion,
      showPersonaQuestion: showSignupPersonaQuestion,
      onPersonaComplete: handleSignupPersonaComplete,
    },
    // Sign-in is a visitor-only page; authenticated accounts reach their home.
    signedInSigninDestination: () => {
      const pendingLinkedinId = isMentor ? null : sessionStorage.getItem(LINKEDIN_LEAD_PENDING_KEY);
      return pendingLinkedinId ? linkedinResumePath(pendingLinkedinId, window.location.pathname, window.location.search) : isMentor ? "/mentor" : authReturnPath();
    },
  });

  const handleOpenWaitlist = () => {
    setShowWaitlistModal(true);
  };
  
  // A first-time visitor can read the public homepage while auth is checked.
  // Keep the loading gate for private routes and known returning accounts so
  // an authenticated visitor does not briefly see marketing before their app.
  const markedAuthReturn = signupPersonaQuestionPending &&
    !isMentor && !location.startsWith("/mentor/") && physicalLocation !== "/signup";
  if (markedAuthReturn && !showSignupModal &&
      (!isAuthenticated || (!showSignupPersonaQuestion && !(user as any)?.offboardingCompletedAt))) {
    return <div className="min-h-dvh bg-[#0F172A]"><AuthTransition
      error={!isLoading && !isFetching && !isAuthenticated}
      onRetry={() => void refetch()}
    /></div>;
  }
  if (isLoading && physicalLocation !== "/" && !showSignupModal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // For unauthenticated users (first visit or returning), show marketing page with appropriate overlays
  if (!isLoading && !isAuthenticated && isAppPath(physicalLocation)) {
    return <ProtectedSignInRedirect />;
  }
  if (!isAuthenticated || physicalLocation === "/" || physicalLocation === "/signup" || showSignupModal) {
    return (
      <>
        <Switch>
          {renderPublicRoutes(publicRouteContext("visitor"))}
          <Route path="/extension/save" component={() => (
            <div className="flex items-center justify-center min-h-screen">
              <p>Sauvegarde de l'offre depuis l'extension Rebond…</p>
            </div>
          )} />
          <Route path="/extension/profile" component={() => (
            <div className="flex items-center justify-center min-h-screen">
              <p>Chargement du profil pour le formulaire de candidature…</p>
            </div>
          )} />
          <Route path="/learn/:masterclassSlug/:classSlug/module/:moduleSlug">
            {(params) => <Redirect to={`/learn/${params!.masterclassSlug}/${params!.classSlug}/${params!.moduleSlug}`} />}
          </Route>
          <Route path="/learn/:masterclassSlug/:classSlug/:lessonSlug" component={LessonViewer} />
          <Route path="/learn/:masterclassSlug/:classSlug">
            {(params) => <ClassRedirect masterclassSlug={params.masterclassSlug} classSlug={params.classSlug} />}
          </Route>
          <Route path="/learn/:masterclassSlug" component={MasterclassRedirect} />
          <Route path="/offboarding" component={OffboardingPage} />
          {/* Routes privées — rediriger vers /signin si non authentifié */}
          <Route path="/job-recommendations"><ProtectedSignInRedirect /></Route>
          <Route path="/jobs/:slug?"><ProtectedSignInRedirect /></Route>
          <Route path="/contacts"><ProtectedSignInRedirect /></Route>
          <Route path="/interviews"><ProtectedSignInRedirect /></Route>
          <Route path="/network"><ProtectedSignInRedirect /></Route>
          <Route path="/business"><ProtectedSignInRedirect /></Route>
          <Route path="/dashboard"><ProtectedSignInRedirect /></Route>
          <Route path="/profile"><ProtectedSignInRedirect /></Route>
          <Route path="/my-cvs"><ProtectedSignInRedirect /></Route>
          <Route path="/actions"><ProtectedSignInRedirect /></Route>
          <Route path="/target-companies"><ProtectedSignInRedirect /></Route>
          <Route path="/community/:id?"><ProtectedSignInRedirect /></Route>
          <Route path="/cercles"><ProtectedSignInRedirect /></Route>
          <Route path="/rebond-ia"><ProtectedSignInRedirect /></Route>
          <Route path="/rebond-ia-v2"><ProtectedSignInRedirect /></Route>
          <Route path="/cv-studio"><ProtectedSignInRedirect /></Route>
          <Route path="/my-program"><ProtectedSignInRedirect /></Route>
          <Route path="/resielience"><ProtectedSignInRedirect /></Route>
          <Route path="/email-accounts"><ProtectedSignInRedirect /></Route>
          <Route path="/wellbeing"><ProtectedSignInRedirect /></Route>
          <Route component={NotFound} />
        </Switch>
        <WaitlistModal
          isOpen={showWaitlistModal}
          onClose={() => setShowWaitlistModal(false)}
          source="website"
        />
        {showSignupModal && <SignUpModal
          open={showSignupModal}
          showPersonaQuestion={showSignupPersonaQuestion}
          onPersonaComplete={handleSignupPersonaComplete}
          initialCvSignup={cvLeadSignupSeed}
          isPreparingCvSignup={isPreparingCvLeadSignup}
          onClose={() => {
            if (isPreparingCvLeadSignup || cvLeadSignupSeed?.returnTo === "/analyse-cv") {
              sessionStorage.removeItem("pendingCvLeadAnalysisId");
            }
            setShowSignupModal(false);
            setCvLeadSignupSeed(null);
            setIsPreparingCvLeadSignup(false);
          }}
          onSwitchToLogin={() => {
            setShowSignupModal(false);
            handleOpenLogin();
          }}
        />}
      </>
    );
  }
  

  // Legacy member alias; public LinkedIn redirects live in the session registry.
  // The destination still goes through the profile's role/onboarding branch.
  if (physicalLocation === "/app/analyse-linkedin") {
    return <Redirect to={LINKEDIN_PROFILE_PATH} />;
  }

  // Mentor: restricted access — only /jobs, /profile, /mentor and the public registry.
  if (isAuthenticated && (user as any)?.role === 'mentor') {
    return (
      <Switch>
        {renderPublicRoutes(publicRouteContext("mentor"))}
        <Route path="/jobs/:slug?" component={Jobs} />
        <Route path="/profile" component={Profile} />
        <Route path="/mentor/mentee/:menteeId" component={MenteeProfilePage} />
        <Route path="/mentor" component={MentorDashboard} />
        <Route path="/mentor/discover" component={MentorDiscovery} />
        <Route path="/rebond-ia"><Redirect to="/mentor/discover" /></Route>
        <Route path="/rebond-ia-v2"><Redirect to="/mentor/discover" /></Route>
        <Route path="/application-agent"><Redirect to="/mentor/discover" /></Route>
        <Route path="/cv-studio"><Redirect to="/mentor/discover" /></Route>
        <Route path="/learn/:rest*"><Redirect to="/mentor/discover" /></Route>
        <Route path="/email-accounts" component={EmailAccounts} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Authenticated but hasn't completed onboarding - show marketing with onboarding
  if (isAuthenticated && !hasCompletedOnboarding && !isAdminRoute && !isLessonRoute) {
    return (
      <>
        <Switch>
          {renderPublicRoutes(publicRouteContext("onboarding"))}
          <Route path="/profile">{() => new URLSearchParams(window.location.search).get("tab") === "linkedin"
            ? <Profile /> : <NotFound />}</Route>
          <Route path="/learn/:masterclassSlug/:classSlug/module/:moduleSlug">
            {(params) => <Redirect to={`/learn/${params!.masterclassSlug}/${params!.classSlug}/${params!.moduleSlug}`} />}
          </Route>
          <Route path="/learn/:masterclassSlug/:classSlug/:lessonSlug" component={LessonViewer} />
          <Route path="/learn/:masterclassSlug/:classSlug">
            {(params) => <ClassRedirect masterclassSlug={params.masterclassSlug} classSlug={params.classSlug} />}
          </Route>
          <Route path="/learn/:masterclassSlug" component={MasterclassRedirect} />
          {/* Routes privées — rediriger vers / (onboarding) si pas encore complété */}
          <Route path="/job-recommendations">{() => <Redirect to="/" />}</Route>
          <Route path="/jobs/:slug?">{() => <Redirect to="/" />}</Route>
          <Route path="/contacts">{() => <Redirect to="/" />}</Route>
          <Route path="/interviews">{() => <Redirect to="/" />}</Route>
          <Route path="/network">{() => <Redirect to="/" />}</Route>
          <Route path="/business">{() => <Redirect to="/" />}</Route>
          <Route path="/dashboard">{() => <Redirect to="/" />}</Route>
          <Route path="/rebond-ia-v2">{() => <Redirect to="/" />}</Route>
          <Route component={NotFound} />
        </Switch>
        {showSignupModal && (
          <Suspense fallback={null}>
            <SignUpModal
              open={showSignupModal}
              showPersonaQuestion={showSignupPersonaQuestion}
              onPersonaComplete={handleSignupPersonaComplete}
              onClose={() => setShowSignupModal(false)}
              onSwitchToLogin={handleOpenLogin}
            />
          </Suspense>
        )}
      </>
    );
  }

  // Authenticated and completed onboarding - show full app
  return (
    <>
    <Switch>
      {renderPublicRoutes(publicRouteContext("member"))}
      <Route path="/my-program" component={MyProgram} />
      <Route path="/resielience">{() => <Redirect to="/my-program?tab=equilibre" />}</Route>
      <Route path="/wellbeing" component={Wellbeing} />
      <Route path="/rebond-ia" component={Dashboard} />
      <Route path="/rebond-ia-v2">{() => null}</Route>
      <Route path="/test-learning" component={TestLearning} />
      {/* Redirect /module/ URLs to the new LessonViewer URL format */}
      <Route path="/learn/:masterclassSlug/:classSlug/module/:moduleSlug">
        {(params) => <Redirect to={`/learn/${params!.masterclassSlug}/${params!.classSlug}/${params!.moduleSlug}`} />}
      </Route>
      {/* Lesson route: show my-program as background behind the fixed overlay */}
      <Route path="/learn/:masterclassSlug/:classSlug/:lessonSlug" component={MyProgram} />
      <Route path="/learn/:masterclassSlug/:classSlug">
        {(params) => <ClassRedirect masterclassSlug={params.masterclassSlug} classSlug={params.classSlug} />}
      </Route>
      <Route path="/learn/:masterclassSlug" component={MasterclassRedirect} />
      <Route path="/learn" component={MyProgram} />
      <Route path="/job-recommendations" component={JobRecommendations} />
      <Route path="/target-companies" component={TargetCompaniesPage} />
      <Route path="/jobs/:slug?" component={MemberJobsRoute} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/interviews" component={Interviews} />
      <Route path="/actions" component={Actions} />
      <Route path="/network" component={Network} />
      <Route path="/business" component={Business} />
      <Route path="/community" component={Community} />
      <Route path="/community/:id" component={CommunityGroup} />
      <Route path="/cercles" component={MyCercle} />
      <Route path="/profile" component={Profile} />
      <Route path="/referrals" component={Referrals} />
      {/* /cv-studio is rendered as a fixed overlay (see AppContent below) to
          avoid double-mounting the page. We still need a Switch entry so the
          NotFound route doesn't match — Dashboard acts as a harmless backdrop
          (it stays hidden behind the overlay), mirroring the /rebond-ia pattern. */}
      <Route path="/cv-studio" component={Dashboard} />
      <Route path="/my-cvs" component={MyCvs} />
      <Route path="/application-agent" component={Dashboard} />
      <Route path="/email-accounts" component={EmailAccounts} />
      <Route path="/help-guide" component={HelpGuidePage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/microlearning" component={AdminMicrolearning} />
      <Route path="/admin/wellbeing" component={AdminWellbeing} />
      <Route path="/admin/onboarding" component={AdminOnboarding} />
      <Route path="/admin/offboarding" component={AdminOffboarding} />
      <Route path="/admin/discovery" component={AdminDiscovery} />
      <Route path="/admin/ab-testing" component={AdminAbTesting} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/simulated-user-view" component={AdminSimulatedUserView} />
      <Route path="/admin/referrals" component={AdminReferrals} />
      <Route path="/admin/workflows" component={AdminWorkflows} />
      <Route path="/admin/emails" component={AdminWorkflows} />
      <Route path="/admin/automation" component={AdminWorkflows} />
      <Route path="/admin/email-templates" component={AdminWorkflows} />
      <Route path="/admin/artifacts" component={AdminArtifacts} />
      <Route path="/admin/digital-assets" component={DigitalAssets} />
      <Route path="/admin/blog/posts" component={AdminBlogPosts} />
      <Route path="/admin/blog/categories" component={AdminBlogCategories} />
      <Route path="/admin/press" component={AdminPress} />
      <Route path="/admin/social-posts" component={AdminSocialPosts} />
      <Route path="/admin/daily-suggestions" component={AdminDailySuggestions} />
      <Route path="/admin/ai-logs" component={AdminAiLogs} />
      <Route path="/admin/robot-logs" component={AdminRobotLogs} />
      <Route path="/admin/job-search-evidence" component={AdminJobSearchEvidence} />
      <Route path="/admin/ats-health" component={AdminWorkdayHealth} />
      <Route path="/admin/workday-health">
        {() => <Redirect to="/admin/ats-health" />}
      </Route>
      <Route path="/admin/sitemap-health" component={AdminSitemapHealth} />
      <Route path="/admin/employment-pages" component={AdminEmploymentPages} />
      <Route path="/admin/cv-enrichments" component={AdminCvEnrichments} />
      <Route path="/admin/bootcamps" component={AdminBootcamps} />
      <Route path="/admin/activation" component={AdminActivation} />
      <Route path="/admin/user-journeys" component={AdminUserJourneys} />
      <Route path="/admin/module-feedback" component={AdminModuleFeedback} />
      <Route path="/admin/google-reviews" component={AdminGoogleReviews} />
      <Route path="/admin/help-guide" component={AdminHelpGuide} />
      <Route path="/admin/job-sources" component={AdminJobSources} />
      <Route path="/offboarding" component={OffboardingPage} />
      <Route path="/bootcamp" component={BootcampPage} />
      <Route path="/candidature/new" component={() => {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
            <div className="h-10 w-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Préparation de votre candidature...</p>
            <p className="text-xs text-muted-foreground">L'extension Rebond initialise votre dossier</p>
          </div>
        );
      }} />
      <Route path="/extension/save" component={() => (
        <div className="flex items-center justify-center min-h-screen">
          <p>Sauvegarde de l'offre depuis l'extension Rebond…</p>
        </div>
      )} />
      <Route path="/extension/profile" component={() => (
        <div className="flex items-center justify-center min-h-screen">
          <p>Chargement du profil pour le formulaire de candidature…</p>
        </div>
      )} />
      <Route path="/candidature/:id/ready" component={CandidatureReady} />
      <Route path="/emploi-action" component={PublicJobAction} />
      <Route path="/candidature/:id" component={Candidature} />
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
    <Suspense fallback={null}>
      <BootcampActionFloater />
    </Suspense>
    {isAuthenticated && (user as any)?.id &&
      !location.startsWith('/candidature') &&
      !location.startsWith('/offboarding') &&
      !/^\/learn\/[^/]+\/[^/]+\/(?!module\/)/.test(location) &&
      location !== '/rebond-ia' &&
      location !== '/cv-studio' &&
      location !== '/application-agent' && null}
    {showSignupModal && (
      <Suspense fallback={null}>
        <SignUpModal
          open={showSignupModal}
          showPersonaQuestion={showSignupPersonaQuestion}
          onPersonaComplete={handleSignupPersonaComplete}
          onClose={() => setShowSignupModal(false)}
          onSwitchToLogin={handleOpenLogin}
        />
      </Suspense>
    )}
    </>
  );
}

const BANNER_HEIGHT = 248;

// ─── Global ErrorBoundary ─────────────────────────────────────────────────────
// Catches any unhandled render error in the app and shows a diagnostic message
// instead of a blank white page.

// Timestamp-based guard: stores the epoch ms of the last auto-reload.
// Allows another auto-reload if >60s have passed, preventing infinite loops
// while still recovering when the first reload didn't land fresh assets
// (e.g. because sessionStorage persisted across a failed reload attempt).
const CHUNK_RELOAD_KEY = "__chunk_reload_ts__";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

function isChunkLoadErr(msg: string) {
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("dynamically imported module")
  );
}

function canAutoReload(): boolean {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!raw) return true;
    return Date.now() - parseInt(raw, 10) > CHUNK_RELOAD_COOLDOWN_MS;
  } catch (_) {
    return false;
  }
}

function cacheBustReload() {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch (_) {}
  try {
    // Hard reload: drop query params added by a previous cacheBustReload attempt,
    // then force a fresh GET so the server's no-store index.html is re-fetched.
    window.location.replace(window.location.pathname + window.location.hash);
  } catch (_) {
    window.location.reload();
  }
}

interface ErrorBoundaryFullState { hasError: boolean; error?: Error; isChunkError: boolean; retryTimedOut: boolean }

class GlobalErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryFullState> {
  private retryTimer?: number;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false, retryTimedOut: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryFullState {
    const isChunk = isChunkLoadErr(error.message);
    return { hasError: true, error, isChunkError: isChunk, retryTimedOut: false };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Render crash:", error.message, info.componentStack);
    if (!isChunkLoadErr(error.message) || !canAutoReload()) return;

    if (import.meta.env.DEV) {
      // During a dev-server restart Vite may return 502 for a lazy module.
      // An immediate reload consumes the single-reload guard while the server
      // is still down, leaving the tab on a permanent error screen.
      const moduleUrl = error.message.match(/https?:\/\/[^\s)]+/)?.[0];
      const url = moduleUrl ? new URL(moduleUrl, window.location.href) : null;
      if (url?.origin === window.location.origin) {
        const started = Date.now();
        const retryWhenAvailable = async () => {
          try {
            const response = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
            if (response.ok && /javascript/.test(response.headers.get("content-type") || "")) {
              cacheBustReload();
              return;
            }
          } catch {
            // The server is still restarting. Keep the current page visible.
          }
          if (Date.now() - started < 45_000) {
            this.retryTimer = window.setTimeout(() => { void retryWhenAvailable(); }, 1500);
          } else {
            this.setState({ retryTimedOut: true });
          }
        };
        void retryWhenAvailable();
        return;
      }
    }
    cacheBustReload();
  }
  componentWillUnmount() {
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
  }
  render() {
    if (this.state.hasError) {
      const willAutoReload = this.state.isChunkError && !this.state.retryTimedOut && canAutoReload();

      if (willAutoReload) {
        return (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8f6f3", padding: 32 }}>
            <div style={{ maxWidth: 480, textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#0F172A", marginBottom: 8 }}>Mise à jour en cours…</p>
              <p style={{ fontSize: 13, color: "#64748B" }}>L'application se rechargera quand le serveur sera disponible.</p>
            </div>
          </div>
        );
      }

      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8f6f3", padding: 32 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>Une erreur inattendue s'est produite</p>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16, fontFamily: "monospace", background: "#f1f5f9", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all" }}>
              {this.state.error?.message}
            </p>
            <button
              onClick={cacheBustReload}
              style={{ background: "#2D9326", color: "white", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── SilentBoundary ───────────────────────────────────────────────────────────
// Used around dialogs/overlays: a crash makes the dialog disappear silently
// rather than propagating and blanking the whole page.
interface ErrorBoundaryState { hasError: boolean; error?: Error }
class SilentBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SilentBoundary] Dialog/overlay crash suppressed:", error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── DashboardBoundary ────────────────────────────────────────────────────────
// Wraps the Dashboard route — shows an in-page error card instead of blanking the page.
class DashboardBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DashboardBoundary] Dashboard crash:", error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Le tableau de bord n'a pas pu se charger</p>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16, fontFamily: "monospace", background: "#f1f5f9", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all" }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#2D9326", color: "white", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Prevents a crash inside LessonViewer (or any overlay) from blanking the entire page.
class LessonErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LessonErrorBoundary] Caught render error:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "#0A3400", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "white", textAlign: "center", padding: 32 }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Une erreur s'est produite</p>
            <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 24 }}>Le module n'a pas pu se charger.</p>
            <button
              onClick={() => window.location.assign("/app/my-program")}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
            >
              Retour à mes masterclasses
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  useWorkflowNotifications((user as any)?.id);
  const lastAuthIdentity = useRef<string | null>(null);
  const hasObservedAuthState = useRef(false);
  useEffect(() => {
    // Earlier versions put personal report previews in sessionStorage.
    sessionStorage.removeItem(LINKEDIN_LEAD_LEGACY_RESULT_KEY);
  }, []);
  const [location] = useLocation();
  const search = useSearch();
  const [physicalLocation] = useBrowserLocation();
  const isLandscapePhone = useLandscapePhone();
  const signupPersonaQuestionPending = typeof window !== "undefined" &&
    hasPendingSignupPersonaQuestion(
      window.location.search,
      sessionStorage.getItem("signupPersonaPending") === "true",
      sessionStorage.getItem("newlyRegistered") === "true",
      sessionStorage.getItem("signupFlow"),
    );
  const hasCompletedOnboarding = !!(
    (user as any)?.hasCompletedOnboarding ||
    (!signupPersonaQuestionPending && localStorage.getItem("hasSeenOnboarding") === "true")
  );
  const isAdminRoute = location.startsWith('/admin');
  const isMentor = (user as any)?.role === 'mentor';
  const isMentorSignInRoute = (location === '/mentor' || location === '/mentor/login') && !isMentor;
  const isMenteeProfileRoute = location.startsWith('/mentor/mentee/');
  const isLinkedinLeadRoute = location === LINKEDIN_LEAD_PATH || location.startsWith(`${LINKEDIN_LEAD_PATH}/`);
  // Derived from the public route registry: an unregistered URL is never marketing.
  const isMarketingRoute = usesMarketingLayout(location, physicalLocation);
  const isLessonOverlayRoute = /^\/learn\/[^/]+\/[^/]+\/(?!module\/)/.test(location);
  const isRebondIaOverlayRoute = location === '/rebond-ia';
  const isRebondIaV2OverlayRoute = location === '/rebond-ia-v2';
  const isCvStudioOverlayRoute = location === '/cv-studio';
  const isCvCoachOverlayRoute = location === '/application-agent';
  const isHelpGuideRoute = location === '/help-guide';
  const isCandidatureRoute = location.startsWith('/candidature');
  const isOffboardingRoute = location.startsWith('/offboarding');
  // Signed-in CV/LinkedIn analyses use PageBanner/PageContainer, which require the
  // app's green banner and navigation: the registry declares them with the app layout.
  const showNav = !isLoading && isAuthenticated && (hasCompletedOnboarding || isAdminRoute || isMentor || isLinkedinLeadRoute) && !isMentorSignInRoute && !isMenteeProfileRoute && !isMarketingRoute;

  // Private report data lives only in memory. Drop it (and the pending claim
  // token) when the signed-in identity leaves, so a later account cannot reuse it.
  useEffect(() => {
    if (isLoading) return;
    const identity = isAuthenticated && (user as any)?.id ? String((user as any).id) : null;
    if (hasObservedAuthState.current && identity !== lastAuthIdentity.current) {
      const previousIdentity = lastAuthIdentity.current;
      if (previousIdentity) {
        queryClient.removeQueries({
          predicate: (query) => {
            const [namespace, owner] = query.queryKey;
            return typeof namespace === "string"
              && (namespace === "/api/v2/rebond-ia" || namespace.startsWith("/api/v2/rebond-ia/"))
              && String(owner ?? "") === previousIdentity;
          },
        });
      }
      clearLinkedinLeadPreview();
      clearLinkedinLeadLoadingProfile();
      if (lastAuthIdentity.current && (!identity || identity !== lastAuthIdentity.current)) {
        sessionStorage.removeItem(LINKEDIN_LEAD_PENDING_KEY);
        sessionStorage.removeItem("linkedinLeadAnalysisLoading");
        sessionStorage.removeItem("linkedinLeadAnalysisError");
      }
    }
    lastAuthIdentity.current = identity;
    hasObservedAuthState.current = true;
  }, [isAuthenticated, isLoading, user]);

  // Keep a same-origin member destination so the fullscreen v2 overlay can
  // close back to the page from which it was opened.
  const lastMemberLocation = useRef<string | null>(null);
  useEffect(() => {
    if (location === "/rebond-ia-v2") {
      if (lastMemberLocation.current && !lastMemberLocation.current.startsWith("/rebond-ia-v2")) {
        sessionStorage.setItem("rebond-ia-v2-origin", appPath(lastMemberLocation.current));
      }
      return;
    }
    if (location.startsWith("/app/")) return;
    if (location === "/" || isLegacyMemberPath(location)) {
      const hash = typeof window === "undefined" ? "" : window.location.hash;
      lastMemberLocation.current = `${location}${search ? `?${search}` : ""}${hash}`;
    }
  }, [location, search]);

  // Run at the application boundary, before page-level URL cleanup can discard
  // ?ref. The server returns an opaque, expiring attribution token (never the
  // referral code) which signup flows submit later.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    const expiresAt = Number(localStorage.getItem("referralAttributionExpiresAt") || 0);
    if (expiresAt && expiresAt <= Date.now()) {
      localStorage.removeItem("referralAttributionToken");
      localStorage.removeItem("referralAttributionExpiresAt");
    }
    if (!code || (localStorage.getItem("referralAttributionToken") && expiresAt > Date.now())) return;
    fetch("/api/referrals/click", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (data.attributionToken) {
        localStorage.setItem("referralAttributionToken", data.attributionToken);
        localStorage.setItem("referralAttributionExpiresAt", String(Date.now() + 30 * DAY_MS));
        capture("referral_clicked");
      }
    }).catch(() => {});
  }, []);

  // Capture a $pageview on every SPA route change with the correct app_section.
  // capture_pageview:false in posthog init prevents the duplicate on first load.
  useEffect(() => {
    if (!isLoading && !isLegacyMemberPath(physicalLocation)) {
      capturePageview(physicalLocation, { mentor: isAuthenticated && isMentor });
    }
  }, [physicalLocation, isLoading, isAuthenticated, isMentor]);

  // Scroll tracking for parallax banner/wave effect
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    if (!showNav) return;
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showNav]);

  // Clamp scroll offset: both elements stop moving once banner is fully gone
  const scrollOffset = Math.min(scrollY, BANNER_HEIGHT);

  // Keep the requested /plan entry point on the existing canonical tariff page.
  if (location === "/plan") {
    return <Redirect to={`/pricing${window.location.search}${window.location.hash}`} />;
  }

  if (isMenteeProfileRoute) {
    return (
      <GlobalErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        }>
          <Router />
        </Suspense>
      </GlobalErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <DiscoveryManager user={isAuthenticated ? user as any : null} blocked={signupPersonaQuestionPending} />
      </Suspense>
      {/* Layer 1b : fond blanc du corps de page (sous la vague) */}
      {showNav && (
        <div className="fixed z-[1] hidden md:block bg-background"
          style={{ top: "56px", left: "256px", right: 0, bottom: 0 }}
        />
      )}
      {/* Layer 2 : vague décorative – remonte avec le scroll, puis reste stable */}
      {showNav && (
        <img
          src="/bg-waves.png"
          alt=""
          aria-hidden="true"
          className="hidden md:block pointer-events-none select-none z-[2]"
          style={{
            position: "fixed",
            top: `-${BANNER_HEIGHT}px`,
            left: 0,
            right: 0,
            height: `calc(100% + ${BANNER_HEIGHT}px)`,
            width: "100%",
            objectFit: "cover",
            opacity: 0.6,
            transform: `translateY(${BANNER_HEIGHT - scrollOffset}px)`,
            willChange: "transform",
          }}
        />
      )}
      <Suspense fallback={null}>
        {showNav && <TopBar />}
        {showNav && <DesktopNav />}
      </Suspense>
      {/* Bannière verte – remonte au scroll et disparaît */}
      {showNav && !isLandscapePhone && (
        <div
          className="fixed z-[1] hidden md:block"
          style={{
            top: "56px",
            left: "256px",
            right: "0",
            height: `${BANNER_HEIGHT}px`,
            backgroundColor: "#0A3400",
            borderRadius: "20px 0 0 0",
            boxShadow: "0px 0px 24px 1px #00000014",
            transform: `translateY(-${scrollOffset}px)`,
            willChange: "transform",
          }}
        />
      )}
      {/* pt-14 = TopBar seul (mobile) ; md:pt-[92px] = titre à 60px du haut de la bannière (56 TopBar + 60 + 24 p-6 = 92) */}
      <main className={showNav ? `${isLandscapePhone ? "" : "md:ml-64"} pt-14 md:pt-[92px] min-h-screen relative z-[3]` : ""}>
        <Suspense fallback={null}>
          {showNav && !isMentor && location !== "/email-accounts" && <AiQuotaBanner />}
          {showNav && !["/rebond-ia-v2","/app/rebond-ia-v2"].includes(location.split("?")[0]) && <AdminPlanTestBanner enabled={String((user as any)?.role ?? "").toLowerCase() === "admin"} />}
        </Suspense>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        }>
          <Router />
        </Suspense>
      </main>
      {/* LessonViewer as fixed overlay — sibling of <main> so it escapes z-[3] stacking context.
          NOTE: intentionally does NOT require hasCompletedOnboarding — lesson routes must work
          even for users whose onboarding flag is missing (incognito / cache cleared). */}
      {isLessonOverlayRoute && !isMentor && isAuthenticated && (
        <LessonErrorBoundary>
          <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
            <Suspense fallback={null}>
              <LessonViewer />
            </Suspense>
          </div>
        </LessonErrorBoundary>
      )}
      {/* Coach Rebond IA as fixed overlay — same modal pattern as masterclass lessons */}
      {isRebondIaOverlayRoute && !isMentor && isAuthenticated && hasCompletedOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "hsl(var(--background))" }}>
          <Suspense fallback={null}>
            <RebondIA />
          </Suspense>
        </div>
      )}
      {isRebondIaV2OverlayRoute && !isMentor && isAuthenticated && hasCompletedOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "hsl(var(--background))" }}>
          <Suspense fallback={null}>
            <RebondIAV2 />
          </Suspense>
        </div>
      )}
      {/* CV Studio as fixed overlay — escapes <main>'s z-[3] stacking context */}
      {isCvStudioOverlayRoute && !isMentor && isAuthenticated && hasCompletedOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "hsl(var(--background))" }}>
          <Suspense fallback={null}>
            <CvStudio />
          </Suspense>
        </div>
      )}
      {/* CV Coach as fixed overlay */}
      {isCvCoachOverlayRoute && !isMentor && isAuthenticated && hasCompletedOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "hsl(var(--background))" }}>
          <Suspense fallback={null}>
            <CvCoachPage />
          </Suspense>
        </div>
      )}
      {/* Help Guide as fixed overlay — full-page like LessonViewer */}
      {isHelpGuideRoute && isAuthenticated && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "hsl(var(--background))" }}>
          <Suspense fallback={null}>
            <HelpGuidePage />
          </Suspense>
        </div>
      )}
      {/* Offboarding as fixed overlay — works for new users (no hasCompletedOnboarding required).
          Guard: if the user navigates back to /offboarding after completing, the overlay must NOT
          re-appear. offboardingCompletedAt is set immediately in the TanStack cache by
          markComplete() (setQueryData) before setLocation("/") fires, so this check is instant. */}
      {isOffboardingRoute && !isMentor && isAuthenticated && !(user as any)?.offboardingCompletedAt && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "radial-gradient(ellipse at 70% 110%, #1f6b1a 0%, #2D9326 60%)" }}>
          <Suspense fallback={null}>
            <OffboardingPage />
          </Suspense>
        </div>
      )}
      <Suspense fallback={null}>
        {showNav && <MobileNav />}
      </Suspense>
    </div>
  );
}

function App() {
  // Fetches a CSRF token on mount and stores it globally for apiRequest to attach
  // as X-CSRF-Token on mutating requests. See server/auth/csrf.ts.
  useCsrfToken();

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider>
          <TooltipProvider>
            <MemberRouter>
              <ScrollToTop />
              <AnalysisQuotaPaywall />
              <GlobalErrorBoundary>
                <AppContent />
              </GlobalErrorBoundary>
            </MemberRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
// Exposed so routing tests can mount the real session branches without the app chrome.
export { Router as AppRouter };
