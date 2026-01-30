"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "../app/session-context";
import MatchesSkeleton from "./skeletons/MatchesSkeleton";
import UploadResume from "./UploadResume";
import type {
  AnalyzeResult,
  AnalyzedJobDetail,
  ApplyResult,
  MatchFilters,
  MatchResult,
  SelectionResponse,
  SessionProfile,
} from "../type";

const MatchesSection = dynamic(() => import("./MatchesSection"), {
  loading: () => <MatchesSkeleton />,
});

export default function HomepageClient() {
  const [uploading, setUploading] = useState(false);
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
  const [activeFilters, setActiveFilters] = useState<MatchFilters | null>(null);
  const [lockedTitleTerms, setLockedTitleTerms] = useState<string[]>([]);
  const [hasLoadedLockedTerms, setHasLoadedLockedTerms] = useState(false);
  const [selectionResult, setSelectionResult] =
    useState<SelectionResponse | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applyResults, setApplyResults] = useState<
    Record<string, ApplyResult | null>
  >({});
  const [applyTone, setApplyTone] = useState("concise");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const matchesPageSize = 25;
  const analyzedSelectedIds = new Set(
    analyzedJobIds.filter((jobId) => selectedJobs.includes(jobId))
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
    (jobId) => !analyzedJobIds.includes(jobId)
  );
  const visibleJobIds = sortedMatches.map((match) => match.job_id);
  const handleSelectAllVisible = () => {
    setSelectedJobs((prev) => {
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
    // Submit the resume file to the backend and store the parsed output.
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

    try {
      const response = await fetch(`${apiBase}/api/resume/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Upload failed.");
      }

      const data = (await response.json()) as SessionProfile;
      console.log(data);
      setSessionProfile(data);
      const inferredTitles = Array.isArray(data.inferred_titles)
        ? data.inferred_titles
            .filter((term) => typeof term === "string")
            .map((term) => term.trim())
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
          } catch {}
        }
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("session_id", data.session_id);
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
      } catch {
        // Ignore malformed stored data.
      }
    }
    setHasLoadedLockedTerms(true);
  }, [sessionProfile, hasLoadedLockedTerms]);

  const fetchMatches = async (
    page: number,
    filters: MatchFilters | null,
    sessionOverride?: SessionProfile
  ) => {
    // Fetch ranked matches for the current session.
    const activeSession = sessionOverride ?? sessionProfile;
    if (!activeSession) return;

    setLoadingMatches(true);
    setMatchesError(null);
    console.log(activeSession);
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
            }
          : null);
      const response = await fetch(`${apiBase}/api/matches`, {
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
      console.log(data);
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
      if (!filters && !activeFilters && lockedTitleTerms.length === 0) {
        setLockedTitleTerms(titleTerms);
        if (activeSession?.session_id) {
          window.localStorage.setItem(
            `title_terms_${activeSession.session_id}`,
            JSON.stringify(titleTerms)
          );
        }
      }
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
    await fetchMatches(1, payload);
  };

  const toggleJobSelection = (jobId: string) => {
    // Track which jobs the user wants to analyze/apply.
    setSelectedJobs((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId);
      }
      return [...prev, jobId];
    });
  };

  const handleSaveSelections = async () => {
    // Persist selections for the current session.
    if (!sessionProfile || selectedJobs.length === 0) return;

    setSelectionError(null);
    setSelectionResult(null);

    try {
      const response = await fetch(`${apiBase}/api/jobs/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_ids: selectedJobs,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Selection failed.");
      }

      const data = (await response.json()) as SelectionResponse;
      setSelectionResult(data);
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
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_ids: unanalyzedSelected,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Analysis failed.");
      }
      const data = (await response.json()) as {
        results: AnalyzeResult[];
        best_match_job_id?: string | null;
      };
      const mapped = data.results.reduce<Record<string, AnalyzeResult>>(
        (acc, result) => {
          acc[result.job_id] = result;
          return acc;
        },
        {}
      );
      const mergedResults = { ...analysisResults, ...mapped };
      setAnalysisResults(mergedResults);
      setAnalysisBest(data.best_match_job_id ?? null);
      const analyzedIds = data.results.map((result) => result.job_id);
      const mergedAnalyzed = Array.from(
        new Set([...analyzedJobIds, ...analyzedIds])
      );
      setAnalyzedJobIds(mergedAnalyzed);
      if (typeof window !== "undefined") {
        const storageKey = `analyzed_jobs_${sessionProfile.session_id}`;
        window.localStorage.setItem(storageKey, JSON.stringify(mergedAnalyzed));
        const resultsKey = `analysis_results_${sessionProfile.session_id}`;
        window.localStorage.setItem(resultsKey, JSON.stringify(mergedResults));
      }
      const detailsMap = data.results.reduce<Record<string, AnalyzedJobDetail>>(
        (acc, result) => {
          const match = matches.find((item) => item.job_id === result.job_id);
          if (!match) return acc;
          acc[result.job_id] = {
            job_id: match.job_id,
            title: match.title,
            company: match.company,
            location: match.location,
            apply_url: match.apply_url,
          };
          return acc;
        },
        {}
      );
      if (Object.keys(detailsMap).length > 0) {
        setAnalyzedJobDetails((prev) => ({ ...prev, ...detailsMap }));
        if (typeof window !== "undefined") {
          const detailsKey = `analyzed_job_details_${sessionProfile.session_id}`;
          const merged = { ...analyzedJobDetails, ...detailsMap };
          window.localStorage.setItem(detailsKey, JSON.stringify(merged));
        }
      }
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Unexpected analysis error."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePrepareApply = async (jobId: string) => {
    // Request cover letter and apply URL.
    if (!sessionProfile) return;

    const response = await fetch(`${apiBase}/api/apply/prepare`, {
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
    setApplyResults((prev) => ({ ...prev, [jobId]: data }));
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
    filterLocation: filterLocation,
    filterWorkMode: filterWorkMode,
    filterPayRange: filterPayRange,
    onFilterTitleTermsChange: setFilterTitleTerms,
    onFilterLocationChange: setFilterLocation,
    onFilterWorkModeChange: setFilterWorkMode,
    onFilterPayRangeChange: setFilterPayRange,
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
  return (
    <>
      <UploadResume
        uploading={uploading}
        errorMessage={errorMessage}
        sessionProfile={sessionProfile}
        onUpload={handleUpload}
      />
      <MatchesSection {...matchGridProps} />
    </>
  );
}

