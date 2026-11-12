import { useDismissedJobs } from "@/hooks/use-dismissed-jobs";
import { requestJobSearch, searchFailureProperties } from "@/lib/jobSearchTransport";
import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobSearchPrompt } from "@/components/JobSearchPrompt";
import { JobSearchFilters, JobSearchSort } from "@/components/JobSearchFilters";
import { JobSearchCriteriaSummary } from "@/components/JobSearchCriteriaSummary";
import { useJobConsultations, useJobSearchScope } from "@/hooks/use-job-consultations";
import { neutralSearchOptions, restoreSearchOptions, orderSearchOffers, relevanceSearchOptions, type SearchOptions } from "@shared/jobSearchOptions";
import {
  Briefcase,
  MapPin,
  Clock,
  Lightbulb,
  Search,
  TrendingUp,
  RefreshCw,
  Wrench,
  AlertTriangle,
  X,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import SEO from "@/components/SEO";
import { JobOpportunityCard } from "@/components/JobOpportunityCard";
import { JobOpportunityDrawer } from "@/components/JobOpportunityDrawer";
import { PageBanner, PageContainer } from "@/components/PageHeader";
import { usePublicSearchHistory } from "@/lib/usePublicSearchHistory";
import { useLastJobSearch, type LastJobSearchCriteria } from "@/lib/useLastJobSearch";
import { findMatchingApplication } from "@/lib/jobApplicationMatching";
import { usePaywallStatus } from "@/hooks/use-subscription";
import { PaywallChoiceDialog } from "@/components/PaywallChoiceDialog";
import { JobScoresPaywallBanner } from "@/components/JobScoresPaywallBanner";
import { isJobScoreLocked, jobScoreAccessContext, JOB_SCORE_PAYWALL_INSERT_INDEX } from "@/lib/jobScoreAccess";
import { useLocation, useSearch } from "wouter";

const MAINTENANCE_MODE = false;

function pendingJobQuery(): string | null {
  try { return window.sessionStorage.getItem("pendingJobQuery"); }
  catch { return null; } // Optional prefill is unavailable when browser storage is blocked.
}

const LOADING_STEPS = [
  "Analyse de votre requête en cours…",
  "Extraction des critères clés…",
  "Recherche dans la base d'offres…",
  "Calcul des scores de correspondance…",
  "Tri par pertinence…",
  "Résultats presque prêts !",
];

function SearchLoadingCard({ totalJobs }: { totalJobs: number | null }) {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    setStepIndex(0);
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, []);
  return (
    <Card className="p-8 text-center mb-6" data-testid="card-search-loading">
      <RefreshCw className="w-8 h-8 mx-auto mb-4 text-primary animate-spin" />
      <p className="text-base font-medium text-foreground mb-1">
        {LOADING_STEPS[stepIndex]}
      </p>
      {totalJobs && (
        <p className="text-sm text-muted-foreground">
          Analyse de {totalJobs.toLocaleString("fr-FR")}+ offres en temps réel
        </p>
      )}
    </Card>
  );
}

export default function JobRecommendations() {
  const scope = useJobSearchScope();
  // A different identity gets a fresh draft, mutation state and result batch.
  return <ScopedJobRecommendations key={scope} scope={scope} />;
}

function ScopedJobRecommendations({ scope }: { scope: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: paywall, isLoading: paywallLoading, isError: paywallError, refetch: refetchPaywall } = usePaywallStatus();
  const [, setLocation] = useLocation();
  const locationSearch = useSearch();

  const { lastSearch, setLastSearch, loading: restorationLoading } = useLastJobSearch(scope);
  const contextualQuery = new URLSearchParams(locationSearch).get("query")?.trim() ||
    pendingJobQuery()?.trim() || "";
  const queryEdited = useRef(!!contextualQuery);
  const optionsEdited = useRef(false);
  const [options, setOptions] = useState<SearchOptions>(() => restoreSearchOptions(lastSearch?.options));
  const [submittedOptions, setSubmittedOptions] = useState<SearchOptions>(() => restoreSearchOptions(lastSearch?.options));
  const requestBusy = useRef(false);
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current++; }, []);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const restoredScope = useRef<string | null>(null);
  const { addEntry: addHistoryEntry } = usePublicSearchHistory();

  const [query, setQuery] = useState(contextualQuery || lastSearch?.query || "");
  const [results, setResults] = useState<any[] | null>(null);
  const consultations = useJobConsultations(results);
  const [resultAccessContext, setResultAccessContext] = useState<string | null>(null);
  const [scoreClock, setScoreClock] = useState(() => new Date());
  const accessContext = jobScoreAccessContext(currentUser?.id, paywall, scoreClock);
  const attemptedRefreshContext = useRef<string | null>(null);
  const refreshingScoreRights = useRef(false);
  const scorePreviewIdsRef = useRef<string[]>([]);
  const attemptedPreviewRef = useRef<string | null>(null);
  const verifiedScores = !!accessContext && resultAccessContext === accessContext && !paywallLoading && !paywallError;
  useEffect(() => {
    const timer = setInterval(() => setScoreClock(new Date()), 60_000);
    const refreshClock = () => setScoreClock(new Date());
    window.addEventListener("focus", refreshClock);
    return () => { clearInterval(timer); window.removeEventListener("focus", refreshClock); };
  }, []);
  const [criteria, setCriteria] = useState<LastJobSearchCriteria | null>(null);
  const [totalJobs, setTotalJobs] = useState<number | null>(
    lastSearch?.totalActiveJobs || null
  );

  const [relaxedLevel, setRelaxedLevel] = useState<"no_remote" | "no_location" | null>(null);
  const [relaxedNoticeDismissed, setRelaxedNoticeDismissed] = useState(false);

  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useDismissedJobs(currentUser?.id);
  const [fading, setFading] = useState<Set<string>>(new Set());

  const [detailJob, setDetailJob] = useState<any | null>(null);
  const [showScorePaywall, setShowScorePaywall] = useState(false);

  const lastQueryRef = useRef<string>("");

  // Stats — total active jobs (fetched once)
  const statsQuery = useQuery<{ totalActiveJobs: number }>({
    queryKey: ["/api/public/job-pool-stats"],
  });
  useEffect(() => {
    if (statsQuery.data?.totalActiveJobs) {
      setTotalJobs((prev) => prev || statsQuery.data!.totalActiveJobs);
    }
  }, [statsQuery.data]);

  // User applications — to compute isApplied per result
  const applicationsQuery = useQuery<any[]>({
    queryKey: ["/api/applications", currentUser?.id],
    queryFn: async () => {
      const r = await fetch(`/api/applications/${currentUser!.id}`);
      if (!r.ok) throw new Error("Impossible de vérifier les offres enregistrées dans le CRM");
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error("Réponse inattendue lors de la vérification du CRM");
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const applications = useMemo(
    () => applicationsQuery.data || [],
    [applicationsQuery.data],
  );

  const searchMutation = useMutation({
    mutationFn: async (request: { query: string; options: SearchOptions; id: number; scope: string; exclusions?: string[] }) => {
      const searchQuery = request.query;
      const requestedAccessContext = accessContext;
      lastQueryRef.current = searchQuery;
      const searchId = crypto.randomUUID();
      import("@/lib/posthog").then(({ capture }) =>
        capture("job_search_launched", { search_id: searchId, source: "app_recommendations" })
      );
      const data = await requestJobSearch({
                query: searchQuery,
                options: relevanceSearchOptions(request.options),
                requestedSort: request.options.sort,
                anonymousExcludedIds: request.exclusions,
                disablePersonalization: true,
                freeScoreOfferIds: refreshingScoreRights.current && scorePreviewIdsRef.current.length
                  ? scorePreviewIdsRef.current : undefined,
      }, () => request.id === requestVersion.current && request.scope === scopeRef.current, searchId, 35_000, "app_recommendations");
      return { ...data, scoreAccessContext: requestedAccessContext, requestId: request.id, requestScope: request.scope };
    },
    onSuccess: (data, variables) => {
      if (data.requestId !== requestVersion.current || data.requestScope !== scopeRef.current) return;
      requestBusy.current = false;
      const jobs: any[] = Array.isArray(data.jobs) ? data.jobs : [];
      setResults(jobs);
      setResultAccessContext(data.scoreAccessContext);
      setCriteria(data.criteria || null);
      setTotalJobs(typeof data.totalActiveJobs === "number" ? data.totalActiveJobs : null);
      setRelaxedLevel(data.relaxedLevel ?? null);
      setRelaxedNoticeDismissed(false);
      const q = variables.query.trim();
      import("@/lib/posthog").then(({ capture }) =>
        capture("job_search_succeeded", { ...data.searchTelemetry, result_count: jobs.length, source: "app_recommendations" })
      );
      if (q.length >= 3) {
        addHistoryEntry({
          query: q,
          criteria: data.criteria || null,
          resultCount: jobs.length,
        });
      }
      setLastSearch({
        query: q,
        jobs,
        criteria: data.criteria || null,
        totalActiveJobs: data.totalActiveJobs ?? null,
        scoreAccessContext: data.scoreAccessContext,
        options: variables.options,
      });
      if (!refreshingScoreRights.current) {
        setFading(new Set());
      }
      refreshingScoreRights.current = false;
    },
    onError: (_err, variables) => {
      if (variables.id !== requestVersion.current || variables.scope !== scopeRef.current) return;
      requestBusy.current = false;
      refreshingScoreRights.current = false;
      import("@/lib/posthog").then(({ capture }) =>
        capture("job_search_failed", { ...searchFailureProperties(_err), source: "app_recommendations" })
      );
    },
  });
  const runSearch = (q: string, selection = options) => {
    if (requestBusy.current || q.trim().length < 3 || scope === "unknown") return;
    if (selection.unconsultedOnly && !consultations.available) return;
    requestBusy.current = true;
    queryEdited.current = true;
    optionsEdited.current = true;
    const snapshot = structuredClone(selection);
    setSubmittedOptions(snapshot);
    setCriteria(null);
    if (!refreshingScoreRights.current) setResults(null);
    searchMutation.mutate({ query: q, options: snapshot,
      id: ++requestVersion.current, scope, exclusions: consultations.anonymousExcludedIds?.slice() });
  };
  useEffect(() => {
    if (restorationLoading || scope === "unknown" || restoredScope.current === scope) return;
    restoredScope.current = scope;
    const restoredOptions = restoreSearchOptions(lastSearch?.options);
    if (!optionsEdited.current) {
      setOptions(restoredOptions);
      setSubmittedOptions(restoredOptions);
    }
    if (!queryEdited.current) setQuery(lastSearch?.query ?? "");
    // Restore fields only. Stored results and score contexts are not evidence
    // of current rights, and never initiate a search.
  }, [scope, restorationLoading, lastSearch]);
  const applySort = (sort: SearchOptions["sort"]) => {
    if (requestBusy.current || !lastQueryRef.current) return;
    setOptions(current => ({ ...current, sort }));
    setSubmittedOptions(current => ({ ...current, sort }));
    if (lastSearch) setLastSearch({ ...lastSearch, options: { ...submittedOptions, sort } });
  };

  const resolveCurrency = (job: any): string => {
    if (job.currency) return job.currency;
    const country = (currentUser?.country || "FR").toUpperCase();
    const eurCountries = ["FR","DE","ES","IT","NL","BE","PT","AT","FI","IE","LU","GR","SK","SI","EE","LV","LT","MT","CY"];
    if (eurCountries.includes(country)) return "EUR";
    if (country === "GB") return "GBP";
    if (country === "CH") return "CHF";
    if (country === "CA") return "CAD";
    if (country === "AU") return "AUD";
    if (country === "US") return "USD";
    return "EUR";
  };

  const saveToJobCRMMutation = useMutation({
    mutationFn: async (job: any) => {
      if (!currentUser?.id) throw new Error("User not authenticated");
      const response = await apiRequest("/api/applications", "POST", {
        userId: currentUser.id,
        company: job.company,
        position: job.title,
        location: job.location,
        jobUrl: job.url,
        jobDescription: job.description || "",
        status: "saved",
        salaryMin: job.salaryMin ?? undefined,
        salaryMax: job.salaryMax ?? undefined,
        currency: resolveCurrency(job),
        notes: `Source: ${job.source} – Score ${job.matchScore ?? 0}%`,
      });
      return response.json();
    },
    onSuccess: (data, job) => {
      setSavedJobIds((prev) => new Set(prev).add(job.id));
      queryClient.invalidateQueries({ queryKey: ["/api/applications", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress", currentUser?.id] });
      toast({
        title: t("smartJobs.savedToCRM", "Sauvegardé"),
        description: t(
          "smartJobs.openingApplication",
          "Ouverture de votre candidature..."
        ),
      });
      if (data?.id) {
        setLocation(`/jobs?openApplication=${data.id}`);
      }
    },
    onError: () => {
      toast({
        title: t("common.error", "Erreur"),
        description: t("smartJobs.failedToSave", "Impossible d'enregistrer la candidature"),
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchMutation.isPending) return;
    if (!query.trim() || query.trim().length < 3) return;
    runSearch(query.trim());
  };

  const consumedEmploymentQuery = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (scope === "unknown") return;
    const params = new URLSearchParams(locationSearch);
    // Contextual arrivals prefill only. Keep their priority through delayed
    // identity/storage restoration, independently of commercial rights.
    const urlQuery = params.get("query");
    const pending = (urlQuery !== consumedEmploymentQuery.current ? urlQuery : null) || pendingJobQuery();
    if (pending && pending.trim().length >= 3) {
      consumedEmploymentQuery.current = urlQuery;
      try { sessionStorage.removeItem("pendingJobQuery"); } catch { /* Browser storage may be blocked. */ }
      // Arrivée depuis un lead magnet (salaire, RIASEC) : la ville choisie et
      // `run=1` lancent la recherche tout de suite, une seule fois.
      let arrival: SearchOptions | null = null;
      if (urlQuery && params.has("locations")) {
        try {
          const locations = restoreSearchOptions({ locations: JSON.parse(params.get("locations") || "[]") }).locations;
          arrival = { ...options, locations };
        } catch { /* Lieu illisible : on garde seulement le métier. */ }
      }
      const autoRun = Boolean(urlQuery) && params.get("run") === "1";
      if (params.has("query")) {
        params.delete("query");
        params.delete("locations");
        params.delete("run");
        window.history.replaceState(window.history.state,"",`${window.location.pathname}${params.size?`?${params}`:""}`);
      }
      queryEdited.current = true;
      setQuery(pending.trim());
      if (arrival) {
        optionsEdited.current = true;
        setOptions(arrival);
      }
      if (autoRun) runSearch(pending.trim(), arrival ?? options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, locationSearch]);

  // Only an explicitly submitted batch may refresh its rights. A plan, test
  // generation or Paris-day change locks scores until server verification.
  useEffect(() => {
    const previousQuery = lastQueryRef.current;
    if (!accessContext || paywallError || paywallLoading || !results || !previousQuery || searchMutation.isPending ||
        resultAccessContext === accessContext || attemptedRefreshContext.current === accessContext) return;
    attemptedRefreshContext.current = accessContext;
    refreshingScoreRights.current = true;
    runSearch(previousQuery, submittedOptions);
  }, [accessContext, paywallError, paywallLoading, results, resultAccessContext, searchMutation.isPending]);

  // Match CRM entries before filtering so previously selected offers never reappear.
  const decorated = useMemo(() => {
    return (applicationsQuery.isSuccess ? results || [] : []).map((job) => {
      const existingApplication = findMatchingApplication(job, applications);
      return {
        ...job,
        scoreLocked: isJobScoreLocked(job, verifiedScores),
        isApplied: !!existingApplication,
        existingApplicationId: existingApplication?.id ?? null,
      };
    });
  }, [results, applications, applicationsQuery.isSuccess, verifiedScores]);

  const filteredJobs = useMemo(() => {
    // Geography is part of the submitted server filters, never a second
    // client-side name-based panel with different administrative aliases.
    return decorated.filter(job => !job.existingApplicationId && !savedJobIds.has(job.id));
  }, [decorated, savedJobIds]);

  const referenceJobs = filteredJobs.filter((j) => !dismissed.has(String(j.id)));
  const visibleJobs = orderSearchOffers(referenceJobs, submittedOptions.sort);
  // Rights refreshes depend on the reference batch, never on presentation order.
  scorePreviewIdsRef.current = referenceJobs.slice(0, JOB_SCORE_PAYWALL_INSERT_INDEX).map(job => String(job.id));
  const previewKey = JSON.stringify([accessContext, scorePreviewIdsRef.current]);
  const incompletePreview = referenceJobs.slice(0, JOB_SCORE_PAYWALL_INSERT_INDEX).some(job => job.scoreLocked);
  useEffect(() => {
    if (paywall?.plan !== "free" || !verifiedScores || !incompletePreview || searchMutation.isPending ||
        attemptedPreviewRef.current === previewKey) return;
    const previousQuery = lastQueryRef.current;
    if (!previousQuery) return;
    attemptedPreviewRef.current = previewKey;
    refreshingScoreRights.current = true;
    runSearch(previousQuery, submittedOptions);
  }, [previewKey, incompletePreview, verifiedScores, paywall?.plan, searchMutation.isPending]);
  const lockedJobsCount = visibleJobs.filter(job => job.scoreLocked).length;

  const drawerList = visibleJobs.filter(job => !job.scoreLocked);
  const drawerIdx = detailJob
    ? drawerList.findIndex((j) => j.id === detailJob.id)
    : -1;
  const drawerJob = detailJob ? drawerList.find(job => job.id === detailJob.id) ?? null : null;

  return (
    <>
      <SEO
        title="Mes offres d'emploi"
        description="Recherchez parmi des milliers d'offres d'emploi en France."
        noindex={true}
      />
      <PageContainer>
        <div className="-mx-3 sm:-mx-4 md:mx-0 -mt-8 md:mt-0 px-3 sm:px-4 md:px-0 pt-8 md:pt-0 pb-24 md:pb-0 bg-[#0A3400] md:bg-transparent mb-4 relative md:static overflow-hidden md:overflow-visible">
          <img src="/bg-waves.png" aria-hidden="true" className="md:hidden absolute inset-0 w-full h-full object-cover pointer-events-none select-none" style={{ opacity: 0.6, zIndex: 1 }} />
          <div className="z-[2]">
            <PageBanner
              title={t("smartJobs.pageTitle", "Mes offres d'emploi")}
              subtitle="Décrivez le job qui vous fait vibrer — l'IA cherche dans des milliers d'offres en temps réel."
            />
          </div>
        </div>

        <div style={{ maxWidth: "min(900px, 100%)" }}>

        {/* Maintenance banner */}
        {MAINTENANCE_MODE && (
          <div className="flex items-start gap-3 rounded-lg px-4 py-3 mb-4 bg-amber-50 border border-amber-200 text-amber-800">
            <Wrench className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-sm">Maintenance en cours</p>
              <p className="text-sm text-amber-700 mt-0.5">La recherche d'offres est temporairement indisponible. Nous revenons très vite.</p>
            </div>
          </div>
        )}

        {/* Search + Filters + results block */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <JobSearchPrompt
              showTypewriter
              value={query}
              onChange={value => { queryEdited.current = true; setQuery(value); }}
              onSubmit={handleSearch}
              filtersSlot={<JobSearchFilters value={options} onChange={value => { optionsEdited.current = true; setOptions(value); }}
                historyAvailable={consultations.available} />}
              isPending={searchMutation.isPending}
              size="lg"
              disabled={MAINTENANCE_MODE}
              buttonDisabled={MAINTENANCE_MODE || scope === "unknown" || searchMutation.isPending || query.trim().length < 3}
              buttonTestId="button-search-jobs"
            />
          </div>
        </div>

        <div className="mb-4 flex justify-end">
          <JobSearchSort value={submittedOptions.sort} onChange={applySort}
            disabled={searchMutation.isPending || !lastQueryRef.current} />
        </div>
        {consultations.notice && <p role="status" className="text-sm text-amber-800 mt-2 mb-4">{consultations.notice}</p>}

        {/* Loading */}
        {searchMutation.isPending && (
          <div className="mt-4">
            <SearchLoadingCard totalJobs={totalJobs} />
          </div>
        )}

        {/* Error */}
        {searchMutation.isError && (
          <Card
            className="p-4 mb-4 mt-4 border-destructive/30 flex items-center justify-between gap-4 flex-wrap"
            data-testid="card-search-error"
          >
            <p className="text-sm text-destructive">
              {(() => {
                const msg = (searchMutation.error as Error)?.message || "";
                const name = (searchMutation.error as any)?.name || "";
                if (
                  name === "TimeoutError" ||
                  msg.includes("Délai") ||
                  msg.includes("aborted") ||
                  msg.includes("abort")
                ) {
                  return "La recherche a pris trop de temps. Réessayez dans quelques instants.";
                }
                if (
                  msg === "Failed to fetch" ||
                  msg.includes("fetch") ||
                  msg.includes("réseau") ||
                  msg.includes("network")
                ) {
                  return "Erreur réseau — la recherche n'a pas abouti. Réessayez.";
                }
                return msg || "Erreur lors de la recherche";
              })()}
            </p>
            {lastQueryRef.current && (
              <Button
                size="sm"
                onClick={() => runSearch(lastQueryRef.current, submittedOptions)}
                data-testid="button-retry-search"
              >
                Réessayer
              </Button>
            )}
          </Card>
        )}

        {/* Relaxed-search notice */}
        {relaxedLevel && !relaxedNoticeDismissed && results && results.length > 0 && (
          <div
            data-testid="banner-relaxed-search"
            className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-3"
            style={{
              backgroundColor: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.4)",
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#d97706" }} />
            <span className="text-sm flex-1" style={{ color: "#92400e" }}>
              {relaxedLevel === "no_remote"
                ? "Aucune offre trouvée avec filtre télétravail — résultats sans contrainte de mode de travail"
                : "Aucune offre trouvée dans cette région — résultats nationaux"}
            </span>
            <button
              aria-label="Fermer"
              onClick={() => setRelaxedNoticeDismissed(true)}
              className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Only completed results own a summary, including an empty result set. */}
        {results !== null && !searchMutation.isPending && !searchMutation.isError &&
          restoredScope.current === scope && <JobSearchCriteriaSummary criteria={criteria} />}

        {/* Results header */}
        {results && results.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" data-testid="badge-job-count">
                {visibleJobs.length} offre{visibleJobs.length > 1 ? "s" : ""}
                {visibleJobs.length !== filteredJobs.length &&
                  ` (sur ${filteredJobs.length})`}
              </Badge>
              {totalJobs && (
                <span className="text-xs text-muted-foreground">
                  sur {totalJobs.toLocaleString("fr-FR")}+ offres analysées
                </span>
              )}
            </div>
            {paywallLoading ? <span className="h-4 w-40 animate-pulse rounded bg-muted" aria-label="Vérification des droits de score" /> :
              paywallError ? <span className="flex items-center gap-2 text-xs text-amber-800"><span>Droits de score non vérifiés.</span><button type="button" onClick={() => void refetchPaywall()} className="font-semibold underline">Réessayer</button></span> :
                <span className="text-xs text-muted-foreground">{paywall?.plan === "free" ? "Score détaillé sur vos 5 meilleures offres ; offres et candidature restent accessibles." : "Scores de toutes les offres inclus."}</span>}
          </div>
        )}

        {/* Results */}
        {results && applicationsQuery.isPending && (
          <p className="text-sm text-muted-foreground mt-4" role="status">
            Vérification des offres déjà enregistrées dans votre CRM…
          </p>
        )}
        {results && applicationsQuery.isError && (
          <Card className="p-4 mt-4 border-destructive/30 text-sm text-destructive" role="alert">
            Impossible de vérifier les offres déjà enregistrées dans votre CRM. Réessayez dans quelques instants.
          </Card>
        )}
        {results === null && !searchMutation.isPending && (
          <Card className="p-8 text-center mt-4" data-testid="card-empty-state">
            <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="text-h3 mb-2">Décrivez le poste idéal</h3>
            <p className="text-sm text-muted-foreground">
              Notre IA explorera des milliers d'offres pour trouver les plus
              pertinentes.
            </p>
          </Card>
        )}

        {results && results.length === 0 && !searchMutation.isPending && (
          <Card className="p-8 text-center mt-4" data-testid="card-no-results">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="text-h3 mb-2">Aucune offre trouvée</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Aucune offre ne correspond à vos critères. Quelques idées pour élargir
              votre recherche :
            </p>
            <div
              className="grid gap-3 mx-auto text-left"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                maxWidth: 600,
              }}
            >
              {[
                {
                  icon: MapPin,
                  tip: "Essayez une ville proche ou \"Île-de-France\" au lieu d'un arrondissement précis",
                },
                {
                  icon: Lightbulb,
                  tip: "Utilisez un intitulé plus générique (ex. \"développeur\" plutôt que \"développeur React senior\")",
                },
                {
                  icon: Clock,
                  tip: "Supprimez la contrainte de type de contrat pour voir plus d'offres",
                },
              ].map(({ icon: Icon, tip }, i) => (
                <div
                  key={i}
                  className="flex gap-2 p-3 rounded-md bg-muted/40"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {results && results.length > 0 && applicationsQuery.isSuccess && visibleJobs.length === 0 && !searchMutation.isPending && (
          <Card className="p-6 text-center mt-4" data-testid="card-no-new-jobs">
            <h3 className="text-h3 mb-2">Aucune nouvelle offre à afficher</h3>
            <p className="text-sm text-muted-foreground">
              Les offres déjà enregistrées dans votre CRM ne figurent plus ici. Essayez une autre recherche ou élargissez le filtre de localisation.
            </p>
          </Card>
        )}

        {visibleJobs.length > 0 && (
          <div className="space-y-3">
            {visibleJobs.map((job, index) => (
              <Fragment key={job.id}>
              {paywall?.plan === "free" && !paywallError && verifiedScores && lockedJobsCount > 0 &&
                index === JOB_SCORE_PAYWALL_INSERT_INDEX && (
                <JobScoresPaywallBanner
                  lockedCount={lockedJobsCount}
                  visibleScoreCount={visibleJobs.length - lockedJobsCount}
                  onUnlock={() => setShowScorePaywall(true)}
                />
              )}
              <JobOpportunityCard
                job={job}
                isNew={consultations.isNew(String(job.id))}
                newLabel={i18n.language.startsWith("en") ? "New" : "Nouveau"}
                onConsultDetail={() => { void consultations.markConsulted(job); }}
                scoreLocked={job.scoreLocked}
                onUnlockScore={() => setShowScorePaywall(true)}
                isSaved={savedJobIds.has(job.id)}
                existingApplicationId={job.existingApplicationId}
                isFading={fading.has(job.id)}
                showWhyMatch={false}
                showAgentButton={false}
                showApplyButton={false}
                onDismiss={() => {
                  if (job.scoreLocked) return;
                  setFading((prev) => new Set([...prev, job.id]));
                  setTimeout(() => {
                    setDismissed((prev) => new Set([...prev, String(job.id)]));
                  }, 700);
                }}
                onOpenExistingApplication={() => {
                  if (job.existingApplicationId) {
                    setLocation(`/jobs?openApplication=${job.existingApplicationId}`);
                  }
                }}
                onSave={() => saveToJobCRMMutation.mutate(job)}
                saveDisabled={saveToJobCRMMutation.isPending}
                onOpenDetail={() => { if (!job.scoreLocked) setDetailJob(job); }}
              />
              </Fragment>
            ))}
          </div>
        )}
        </div>
      </PageContainer>

      <JobOpportunityDrawer
        job={drawerJob}
        open={!!drawerJob}
        onOpenChange={(o) => !o && setDetailJob(null)}
        hasPrev={drawerIdx > 0}
        hasNext={drawerIdx >= 0 && drawerIdx < drawerList.length - 1}
        onPrev={() =>
          drawerIdx > 0 && setDetailJob(drawerList[drawerIdx - 1])
        }
        onNext={() =>
          drawerIdx >= 0 &&
          drawerIdx < drawerList.length - 1 &&
          setDetailJob(drawerList[drawerIdx + 1])
        }
        isSaved={detailJob ? savedJobIds.has(detailJob.id) || !!detailJob.existingApplicationId : false}
        isApplied={!!detailJob?.isApplied}
        saveDisabled={saveToJobCRMMutation.isPending}
        onDismiss={() => {
          if (!detailJob) return;
          const id = detailJob.id;
          // Move to the next job before dismissing, or previous if last, or close if none left
          const nextJob =
            drawerIdx >= 0 && drawerIdx < drawerList.length - 1
              ? drawerList[drawerIdx + 1]
              : drawerIdx > 0
                ? drawerList[drawerIdx - 1]
                : null;
          setFading((prev) => new Set([...prev, id]));
          setTimeout(() => {
            setDismissed((prev) => new Set([...prev, String(id)]));
          }, 700);
          setDetailJob(nextJob);
        }}
        onSave={() => detailJob && saveToJobCRMMutation.mutate(detailJob)}
      />
      <PaywallChoiceDialog open={showScorePaywall} onOpenChange={setShowScorePaywall} reason="scores" />
    </>
  );
}
