"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type {
  AnalyzeResult,
  AnalyzedJobDetail,
  SessionContextValue,
  SessionProfile,
} from "@/type";

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(
    null
  );
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, AnalyzeResult | null>
  >({});
  const [analysisBest, setAnalysisBest] = useState<string | null>(null);
  const [analyzedJobIds, setAnalyzedJobIds] = useState<string[]>([]);
  const [analyzedJobDetails, setAnalyzedJobDetails] = useState<
    Record<string, AnalyzedJobDetail>
  >({});
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  const clearSessionStorage = (sessionId: string) => {
    window.localStorage.removeItem("session_id");
    window.localStorage.removeItem(`analyzed_jobs_${sessionId}`);
    window.localStorage.removeItem(`analysis_results_${sessionId}`);
    window.localStorage.removeItem(`analyzed_job_details_${sessionId}`);
    window.localStorage.removeItem(`title_terms_${sessionId}`);

    setSessionProfile(null);
    setSelectedJobs([]);
    setAnalysisResults({});
    setAnalysisBest(null);
    setAnalyzedJobIds([]);
    setAnalyzedJobDetails({});
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sessionId = window.localStorage.getItem("session_id");
    if (!sessionId) return;

    const idsKey = `analyzed_jobs_${sessionId}`;
    const storedAnalyzed = window.localStorage.getItem(idsKey);
    if (storedAnalyzed) {
      try {
        const parsed = JSON.parse(storedAnalyzed) as string[];
        if (Array.isArray(parsed)) {
          setAnalyzedJobIds(parsed);
        }
      } catch {}
    }
    const resultsKey = `analysis_results_${sessionId}`;
    const storedResults = window.localStorage.getItem(resultsKey);
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults) as Record<
          string,
          AnalyzeResult | null
        >;
        if (parsed && typeof parsed === "object") {
          setAnalysisResults(parsed);
        }
      } catch {}
    }
    const detailsKey = `analyzed_job_details_${sessionId}`;
    const storedDetails = window.localStorage.getItem(detailsKey);
    if (storedDetails) {
      try {
        const parsed = JSON.parse(storedDetails) as Record<
          string,
          AnalyzedJobDetail
        >;
        if (parsed && typeof parsed === "object") {
          setAnalyzedJobDetails(parsed);
        }
      } catch {}
    }

    if (sessionProfile?.session_id === sessionId) return;

    const loadProfile = async () => {
      try {
        const response = await fetch(
          `${apiBase}/api/session/profile?session_id=${sessionId}`
        );
        if (!response.ok) {
          // If the backend says the session doesn't exist (or expired), clear local storage.
          if (response.status === 404) {
            clearSessionStorage(sessionId);
          }
          return;
        }
        const data = (await response.json()) as SessionProfile;
        setSessionProfile(data);
      } catch {}
    };

    loadProfile();
  }, [apiBase, sessionProfile?.session_id]);

  return (
    <SessionContext.Provider
      value={{
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
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
