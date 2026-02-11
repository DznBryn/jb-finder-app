"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { signIn, useSession as useAuthSession } from "next-auth/react";
import { useSession } from "../app/session-context";
import MatchesSkeleton from "./skeletons/MatchesSkeleton";
import UploadResume from "./UploadResume";
import { useUserBaseStore } from "@/lib/userBaseStore";
import type {
  AnalyzeResult,
  AnalyzedJobDetail,
  ApplyResult,
  MatchFilters,
  MatchResult,
  SelectionResponse,
  SessionProfile,
} from "@/type";

import LandingHero from "./LandingHero";
import SignupPrompt from "./SignupPrompt";

const MatchesSection = dynamic(() => import("./MatchesSection"), {
  loading: () => <MatchesSkeleton />,
});

export default function HomepageClient({ matchOnly = false }: { matchOnly?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const { status: authStatus, data: authData } = useAuthSession();
  const {
    sessionProfile,
    setSessionProfile,
    selectedJobs,
    setSelectedJobs,
    analysisResults,
    setAnalysisResults,
    analysisBest,
    setAnalysisBest,
    analyzedJobIds,
    setAnalyzedJobIds,
    analyzedJobDetails,
    setAnalyzedJobDetails,
  } = useSession();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [hasLoadedMatches, setHasLoadedMatches] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [filterTitleTerms, setFilterTitleTerms] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("either");
  const [filterPayRange, setFilterPayRange] = useState("any");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const hydrateUserBase = useUserBaseStore((s) => s.hydrateUserBase);
  const [titleOptions, setTitleOptions] = useState<
    Array<{ title: string; count: number }>
  >([]);
  const [locationOptions, setLocationOptions] = useState<
    Array<{ location: string; count: number }>
  >([]);
  const [activeFilters, setActiveFilters] = useState<MatchFilters | null>(null);
  const [lockedTitleTerms, setLockedTitleTerms] = useState<string[]>([]);
  const [hasLoadedLockedTerms, setHasLoadedLockedTerms] = useState(false);
  const [selectionResult, setSelectionResult] =
    useState<SelectionResponse | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [applyResults, setApplyResults] = useState<
    Record<string, ApplyResult | null>
  >({});
  const [applyTone, setApplyTone] = useState("concise");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  
  const getCallbackUrl = () =>
    typeof window === "undefined" ? "/" : window.location.href;

  const requireAuthForLlm = () => {
    if (authStatus === "unauthenticated") {
      setShowSignupPrompt(true);
      return true;
    }
    return false;
  };


  const matchesPageSize = 25;
  const matchesCacheVersion = "v1";
  const matchesCachePrefix = `matches_cache_${matchesCacheVersion}`;
  const analyzedSelectedIds = new Set(
    analyzedJobIds.filter((jobId: string) => selectedJobs.includes(jobId))
  );
  const sortedMatches = [...matches].sort((a, b) => {
    const gradeOrder = ["A", "B", "C", "D"];
    const aPinned = analyzedSelectedIds.has(a.job_id);
    const bPinned = analyzedSelectedIds.has(b.job_id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const aGrade = analysisResults[a.job_id]?.grade ?? "D";
      const bGrade = analysisResults[b.job_id]?.grade ?? "D";
      return gradeOrder.indexOf(aGrade) - gradeOrder.indexOf(bGrade);
    }
    return 0;
  });
  const unanalyzedSelected = selectedJobs.filter(
    (jobId: string) => !analyzedJobIds.includes(jobId)
  );
  const visibleJobIds = sortedMatches.map((match) => match.job_id);
  const handleSelectAllVisible = () => {
    setSelectedJobs((prev: string[]) => {
      const alreadySelected = new Set(prev);
      const newSelection = [...prev];
      for (const jobId of visibleJobIds) {
        if (alreadySelected.has(jobId)) continue;
        alreadySelected.add(jobId);
        newSelection.push(jobId);
      }
      return newSelection;
    });
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploading(true);
    setErrorMessage(null);
    setMatches([]);
    setMatchesError(null);
    setHasLoadedMatches(false);
    setActiveFilters(null);
    setFilterTitleTerms("");
    setFilterLocation("");
    setFilterWorkMode("either");
    setFilterPayRange("any");
    setFilterIndustry("all");
    setLockedTitleTerms([]);
    setHasLoadedLockedTerms(false);
    setSelectedJobs([]);
    setAnalysisResults({});
    setAnalysisBest(null);
    setAnalysisError(null);
    setAnalyzedJobIds([]);
    if (sessionProfile?.session_id && typeof window !== "undefined") {
      window.localStorage.removeItem(`title_terms_${sessionProfile.session_id}`);
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (sessionProfile?.session_id) {
      formData.set("session_id", sessionProfile.session_id);
    }
    const userId = (authData?.user as { id?: string })?.id;
    if (userId) {
      formData.set("user_id", userId);
    }

    try {
      const response = await fetch(`/api/resume/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Upload failed.");
      }

      const data = (await response.json()) as SessionProfile;
      setSessionProfile(data);
      const inferredTitles = Array.isArray(data.inferred_titles)
        ? data.inferred_titles
          .filter((term: string) => typeof term === "string")
          .map((term: string) => term.trim())
          .filter(Boolean)
        : [];
      setFilterTitleTerms(inferredTitles.join(", "));
      setLockedTitleTerms(inferredTitles);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `title_terms_${data.session_id}`,
          JSON.stringify(inferredTitles)
        );
      }
      if (typeof window !== "undefined") {
        const storageKey = `analyzed_jobs_${data.session_id}`;
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as string[];
            if (Array.isArray(parsed)) {
              setAnalyzedJobIds(parsed);
            }
          } catch { }
        }
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("session_id", data.session_id);
      }
      if (typeof window !== "undefined") {
        clearMatchesCache(data.session_id);
      }
      setMatchesPage(1);
      await fetchMatches(
        1,
        inferredTitles.length > 0
          ? {
            title_terms: inferredTitles,
            location_pref: null,
            work_mode: null,
            pay_range: null,
            industry: null,
          }
          : null,
        data
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected upload error."
      );
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (typeof window === "undefined") return;
    
    const sessionId = sessionProfile?.session_id;
    const userId = (authData?.user as { id?: string } | undefined)?.id;
    const convertKey = sessionId
      ? `session_converted_${sessionId}`
      : "signup_bonus_ensured";

    if (!window.localStorage.getItem(convertKey)) {
      fetch("/api/auth/convert-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sessionId != null ? { session_id: sessionId } : {}
        ),
      })
        .then((response) => {
          if (response.ok) {
            window.localStorage.setItem(convertKey, "1");
          }
        })
        .catch(() => {});
    }

    if (!sessionId || !userId) return;

    const selectionKey = `selected_jobs_${sessionId}`;
    const syncKey = `selected_jobs_synced_${sessionId}_${userId}`;
    
    if (window.localStorage.getItem(syncKey)) return;
    
    const storedSelections = window.localStorage.getItem(selectionKey);
    
    if (!storedSelections) return;
    
    try {
      const parsed = JSON.parse(storedSelections) as string[];
      
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      
      const uniqueJobIds = Array.from(new Set(parsed));
      
      fetch("/api/jobs/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_ids: uniqueJobIds,
          user_id: userId,
        }),
      })
        .then((response) => {
          if (!response.ok) return;
          window.localStorage.setItem(syncKey, "1");
          window.localStorage.removeItem(selectionKey);
        })
        .catch(() => {});
    } catch { }
  }, [authData?.user, authStatus, sessionProfile?.session_id]);

  useEffect(() => {
    let isMounted = true;
    
    const loadTitles = async () => {
      try {
        const response = await fetch("/api/filters/titles");
        if (!response.ok) return;
        const data = (await response.json()) as {
          titles: Array<{ title: string; count: number }>;
        };
        if (isMounted && Array.isArray(data.titles)) {
          setTitleOptions(data.titles);
        }
      } catch { }
    };
    
    const loadLocations = async () => {
      try {
        const response = await fetch("/api/filters/locations");
        if (!response.ok) return;
        const data = (await response.json()) as {
          locations: Array<{ location: string; count: number }>;
        };
        if (isMounted && Array.isArray(data.locations)) {
          setLocationOptions(data.locations);
        }
      } catch { }
    };
    
    loadTitles();
    
    loadLocations();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionProfile || hasLoadedLockedTerms) return;
    
    const key = `title_terms_${sessionProfile.session_id}`;
    const stored = window.localStorage.getItem(key);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter((term) => typeof term === "string")
            .map((term) => term.trim())
            .filter(Boolean);
          if (sanitized.length > 0) {
            setLockedTitleTerms(sanitized);
            setFilterTitleTerms((current) =>
              current.trim().length > 0 ? current : sanitized.join(", ")
            );
          }
        }
      } catch { }
    }
    setHasLoadedLockedTerms(true);
  }, [sessionProfile, hasLoadedLockedTerms]);

  const safeStorageGet = (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeStorageSet = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch { }
  };

  const safeStorageRemove = (key: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch { }
  };

  const normalizeFilters = (filters: MatchFilters | null) => {
    if (!filters) return null;
    return {
      title_terms: [...(filters.title_terms ?? [])].map((t) => t.trim()).filter(Boolean).sort(),
      location_pref: filters.location_pref ?? null,
      work_mode: filters.work_mode ?? null,
      pay_range: filters.pay_range ?? null,
      industry: filters.industry ?? null,
    };
  };

  const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  };

  const getMatchesCacheKey = (
    sessionId: string,
    page: number,
    filters: MatchFilters | null
  ) => {
    const normalized = normalizeFilters(filters);
    const filtersKey = stableStringify(normalized);
    return `${matchesCachePrefix}_${sessionId}_${page}_${matchesPageSize}_${filtersKey}`;
  };

  const clearMatchesCache = (sessionId: string) => {
    if (typeof window === "undefined") return;
    const prefix = `${matchesCachePrefix}_${sessionId}_`;
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => safeStorageRemove(key));
  };

  const applyMatchesPayload = (data: {
    matches: MatchResult[];
    page: number;
    page_size: number;
    total: number;
    title_terms?: string[];
  }) => {
    setMatches(data.matches);
    setMatchesPage(data.page);
    setMatchesTotal(data.total);
    setHasLoadedMatches(true);
    const titleTerms = data.title_terms ?? [];
    if (titleTerms.length > 0) {
      setFilterTitleTerms((current) =>
        current.trim().length > 0 ? current : titleTerms.join(", ")
      );
    }
    if (!activeFilters && lockedTitleTerms.length === 0) {
      setLockedTitleTerms(titleTerms);
      if (sessionProfile?.session_id) {
        safeStorageSet(
          `title_terms_${sessionProfile.session_id}`,
          JSON.stringify(titleTerms)
        );
      }
    }
  };

  useEffect(() => {
    if (!sessionProfile?.session_id) return;
    if (!hasLoadedLockedTerms) return;
    if (hasLoadedMatches) return;
    
    const effectiveFilters =
      activeFilters ??
      (lockedTitleTerms.length > 0
        ? {
          title_terms: lockedTitleTerms,
          location_pref: null,
          work_mode: null,
          pay_range: null,
          industry: null,
        }
        : null);

    const cacheKey = getMatchesCacheKey(sessionProfile.session_id, 1, effectiveFilters);
    const cached = safeStorageGet(cacheKey);

    if (!cached) return;

    try {
      const data = JSON.parse(cached) as {
        matches: MatchResult[];
        page: number;
        page_size: number;
        total: number;
        title_terms?: string[];
      };
      applyMatchesPayload(data);
    } catch {
      safeStorageRemove(cacheKey);
    }
  }, [
    activeFilters,
    hasLoadedLockedTerms,
    hasLoadedMatches,
    lockedTitleTerms,
    sessionProfile?.session_id,
  ]);

  const fetchMatches = async (
    page: number,
    filters: MatchFilters | null,
    sessionOverride?: SessionProfile
  ) => {
    const activeSession = sessionOverride ?? sessionProfile;
    if (!activeSession) return;

    setLoadingMatches(true);
    setMatchesError(null);
    
    try {
      const effectiveFilters =
        filters ??
        activeFilters ??
        (lockedTitleTerms.length > 0
          ? {
            title_terms: lockedTitleTerms,
            location_pref: null,
            work_mode: null,
            pay_range: null,
            industry: null,
          }
          : null);
      const cacheKey = getMatchesCacheKey(
        activeSession.session_id,
        page,
        effectiveFilters
      );
      const cached = safeStorageGet(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached) as {
            matches: MatchResult[];
            page: number;
            page_size: number;
            total: number;
            title_terms?: string[];
          };
          applyMatchesPayload(data);
          if (filters != null) setActiveFilters(effectiveFilters);
          setLoadingMatches(false);
          return;
        } catch {
          safeStorageRemove(cacheKey);
        }
      }
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.session_id,
          page,
          filters: effectiveFilters,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to load matches.");
      }
      const data = (await response.json()) as {
        matches: MatchResult[];
        page: number;
        page_size: number;
        total: number;
        title_terms?: string[];
      };

      applyMatchesPayload(data);
      
      if (filters != null) setActiveFilters(effectiveFilters);
      
      safeStorageSet(cacheKey, JSON.stringify(data));
    } catch (error) {
      setMatchesError(
        error instanceof Error ? error.message : "Unexpected match error."
      );
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleApplyFilters = async () => {
    const titleTerms = filterTitleTerms
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
    const payload: MatchFilters = {
      title_terms: titleTerms,
      location_pref: filterLocation || null,
      work_mode: filterWorkMode || null,
      pay_range: filterPayRange || null,
      industry: filterIndustry === "all" ? null : filterIndustry,
    };
    setLockedTitleTerms(titleTerms);
    if (sessionProfile?.session_id) {
      window.localStorage.setItem(
        `title_terms_${sessionProfile.session_id}`,
        JSON.stringify(titleTerms)
      );
    }
    setActiveFilters(payload);
    setMatchesPage(1);
    setSelectedJobs([]);
    await fetchMatches(1, payload);
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs((prev: string[]) => {
      if (prev.includes(jobId)) {
        return prev.filter((id: string) => id !== jobId);
      }
      return [...prev, jobId];
    });
  };

  const handleSaveSelections = async () => {
    if (!sessionProfile || selectedJobs.length === 0) return;
    requireAuthForLlm();

    setSelectionError(null);
    setSelectionResult(null);

    try {
      const uniqueJobIds = Array.from(new Set(selectedJobs));
      if (authStatus === "authenticated") {
        const userId = (authData?.user as { id?: string } | undefined)?.id;
        if (!userId) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              `selected_jobs_${sessionProfile.session_id}`,
              JSON.stringify(uniqueJobIds)
            );
          }
          setSelectionResult({
            accepted_job_ids: uniqueJobIds,
            rejected_job_ids: [],
          });
          return;
        }
        const response = await fetch("/api/jobs/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionProfile.session_id,
            job_ids: uniqueJobIds,
            user_id: userId,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Selection failed.");
        }

        const data = (await response.json()) as SelectionResponse;
        setSelectionResult(data);
      } else {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `selected_jobs_${sessionProfile.session_id}`,
            JSON.stringify(uniqueJobIds)
          );
        }
        setSelectionResult({
          accepted_job_ids: uniqueJobIds,
          rejected_job_ids: [],
        });
      }
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Unexpected selection error."
      );
    }
  };

  const handleAnalyzeSelections = async () => {
    if (
      !sessionProfile ||
      selectedJobs.length === 0 ||
      unanalyzedSelected.length === 0
    ) {
      return;
    }
    if (requireAuthForLlm()) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress(null);
    try {
      const total = unanalyzedSelected.length;
      setAnalysisProgress({ current: 0, total, percent: 0 });

      const nextResults: Record<string, AnalyzeResult | null> = {
        ...analysisResults,
      };
      const nextAnalyzedIds = new Set<string>(analyzedJobIds);
      const nextDetails: Record<string, AnalyzedJobDetail> = {
        ...analyzedJobDetails,
      };

      let bestJobId: string | null = analysisBest;
      let bestRank = bestJobId ? -1 : Number.POSITIVE_INFINITY;
      let bestScore = bestJobId
        ? matches.find((m) => m.job_id === bestJobId)?.score ?? -1
        : -1;
      const gradeRank = (grade: string) =>
        ["A", "B", "C", "D"].indexOf((grade ?? "D").toUpperCase());

      for (let index = 0; index < total; index += 1) {
        const jobId = unanalyzedSelected[index];
        const response = await fetch(`/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionProfile.session_id,
            job_ids: [jobId],
          }),
        });

        if (response.status === 402) {
          const data = (await response.json().catch(() => ({}))) as {
            detail?: { required?: number; available?: number };
            required?: number;
            available?: number;
          };
          const detail = data.detail ?? data;
          const { useCheckoutModalStore } = await import(
            "@/lib/checkoutModalStore"
          );
          useCheckoutModalStore.getState().openFor402(detail);
          throw new Error("PAYMENT_REQUIRED");
        }
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Analysis failed.");
        }

        const data = (await response.json()) as {
          results: AnalyzeResult[];
        };

        const result = data.results?.[0];
        if (result) {
          nextResults[result.job_id] = result;
          nextAnalyzedIds.add(result.job_id);

          const match = matches.find((item) => item.job_id === result.job_id);
          if (match) {
            nextDetails[result.job_id] = {
              job_id: match.job_id,
              title: match.title,
              company: match.company,
              location: match.location,
              apply_url: match.apply_url,
            };

            const rank = gradeRank(result.grade);
            if (
              bestJobId === null ||
              bestRank < 0 ||
              rank < bestRank ||
              (rank === bestRank && match.score > bestScore)
            ) {
              bestJobId = result.job_id;
              bestRank = rank;
              bestScore = match.score;
            }
          }
        }

        const current = index + 1;
        setAnalysisProgress({
          current,
          total,
          percent: Math.min(99, Math.floor((current / total) * 100)),
        });
      }

      setAnalysisResults(nextResults);
      setAnalyzedJobIds(Array.from(nextAnalyzedIds));
      setAnalyzedJobDetails(nextDetails);
      setAnalysisBest(bestJobId);
      hydrateUserBase();

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `analyzed_jobs_${sessionProfile.session_id}`,
          JSON.stringify(Array.from(nextAnalyzedIds))
        );
        window.localStorage.setItem(
          `analysis_results_${sessionProfile.session_id}`,
          JSON.stringify(nextResults)
        );
        window.localStorage.setItem(
          `analyzed_job_details_${sessionProfile.session_id}`,
          JSON.stringify(nextDetails)
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENT_REQUIRED") {
        return;
      }
      setAnalysisError(
        error instanceof Error ? error.message : "Unexpected analysis error."
      );
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const handlePrepareApply = async (jobId: string) => {
    if (!sessionProfile) return;
    if (requireAuthForLlm()) return;

    const response = await fetch("/api/apply/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionProfile.session_id,
        job_id: jobId,
        cover_letter_tone: applyTone,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ApplyResult;
    setApplyResults((prev: Record<string, ApplyResult | null>) => ({
      ...prev,
      [jobId]: data,
    }));
  };

  const matchGridProps = {
    matchesError: matchesError,
    hasLoadedMatches: hasLoadedMatches,
    loadingMatches: loadingMatches,
    matches: sortedMatches,
    matchesPage: matchesPage,
    matchesTotal: matchesTotal,
    matchesPageSize: matchesPageSize,
    activeFilters: activeFilters,
    filterTitleTerms: filterTitleTerms,
    titleOptions: titleOptions,
    locationOptions: locationOptions,
    filterLocation: filterLocation,
    filterWorkMode: filterWorkMode,
    filterPayRange: filterPayRange,
    filterIndustry: filterIndustry,
    onFilterTitleTermsChange: setFilterTitleTerms,
    onFilterLocationChange: setFilterLocation,
    onFilterWorkModeChange: setFilterWorkMode,
    onFilterPayRangeChange: setFilterPayRange,
    onFilterIndustryChange: setFilterIndustry,
    onApplyFilters: handleApplyFilters,
    onFetchMatches: (page: number, filters: MatchFilters | null) =>
      fetchMatches(page, filters),
    analysisResults: analysisResults,
    selectedJobs: selectedJobs,
    unanalyzedSelected: unanalyzedSelected,
    analyzedJobIds: analyzedJobIds,
    analyzedJobDetails: analyzedJobDetails,
    analysisBest: analysisBest,
    analyzing: analyzing,
    analysisProgress: analysisProgress,
    selectionError: selectionError,
    analysisError: analysisError,
    selectionResult: selectionResult,
    applyTone: applyTone,
    applyResults: applyResults,
    onAnalyzeSelections: handleAnalyzeSelections,
    onSelectAllVisible: handleSelectAllVisible,
    onDeselectAll: () => setSelectedJobs([]),
    onSaveSelections: handleSaveSelections,
    onToggleJobSelection: toggleJobSelection,
    onApplyToneChange: setApplyTone,
    onPrepareApply: handlePrepareApply,
  };

  const showMatchesSection = !!sessionProfile;
  const showMatchesLoading =
    showMatchesSection && loadingMatches && !hasLoadedMatches;

  if (matchOnly) {
    if (!sessionProfile) {
      return (
        <div className="mx-auto flex min-h-[40vh] flex-col items-center justify-center gap-4 px-2 py-8">
          <p className="text-slate-500">Loading session…</p>
        </div>
      );
    }
    return (
      <div className="landing-page">
        <div className="mx-auto flex min-h-[70vh] flex-col items-center gap-8 px-2 py-4 md:py-12 justify-start">
          {showMatchesLoading && <MatchesSkeleton variant="landing" />}
          {!showMatchesLoading && <MatchesSection {...matchGridProps} />}
        </div>
      </div>
    );
  }

  return (
    <>
      <SignupPrompt
        open={showSignupPrompt}
        onOpenChange={setShowSignupPrompt}
        onGoogle={() => signIn("google", { callbackUrl: getCallbackUrl() })}
        onLinkedIn={() => signIn("linkedin", { callbackUrl: getCallbackUrl() })}
      />
      <div className="landing-page">
        <div
          className={`mx-auto flex min-h-[70vh] flex-col items-center ${showMatchesLoading && !showMatchesSection ? 'gap-2' : 'gap-8'} px-2 py-4 md:py-12 ${showMatchesSection ? "justify-start" : "max-w-2xl justify-center"}`}
        >
          {!showMatchesSection && <LandingHero />}
          <UploadResume
            uploading={uploading}
            errorMessage={errorMessage}
            sessionProfile={sessionProfile}
            onUpload={handleUpload}
            variant={!showMatchesSection ? "landing" : "default"}
          />

          {showMatchesLoading && <MatchesSkeleton variant="landing" />}
          {showMatchesSection && !showMatchesLoading && (<MatchesSection {...matchGridProps} />)}
        </div>
      </div>
    </>
  );
}
