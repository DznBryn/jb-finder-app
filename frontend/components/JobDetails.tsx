"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "../app/session-context";
import type {
  AnalyzeResult,
  AnalyzedJobDetail,
  DeepAnalyzeResponse,
  GreenhouseJob,
} from "../type";

type JobDetailsProps = {
  jobId: string;
};

function getGradeBadgeClasses(grade: string | null | undefined) {
  switch ((grade ?? "").toUpperCase()) {
    case "A":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "B":
      return "border-lime-500/40 bg-lime-500/10 text-lime-200";
    case "C":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "D":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    default:
      return "border-slate-600 bg-slate-800/60 text-slate-200";
  }
}

function decodeHtml(content: string) {
  if (typeof window === "undefined") return content;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = content;
  return textarea.value;
}

export default function JobDetails({ jobId }: JobDetailsProps) {
  const {
    sessionProfile,
    analysisResults,
    setAnalysisResults,
    analysisBest,
    setAnalysisBest,
    analyzedJobIds,
    setAnalyzedJobIds,
    analyzedJobDetails,
    setAnalyzedJobDetails,
  } = useSession();
  const [job, setJob] = useState<GreenhouseJob | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepAnalysisError, setDeepAnalysisError] = useState<string | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalyzeResponse | null>(
    null
  );
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  useEffect(() => {
    let isMounted = true;
    const loadJob = async () => {
      setLoadingJob(true);
      setJobError(null);
      try {
        const response = await fetch(
          `${apiBase}/api/greenhouse/job?job_id=${jobId}`
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to load job details.");
        }
        const data = (await response.json()) as GreenhouseJob;
        if (isMounted) {
          setJob(data);
        }
      } catch (error) {
        if (isMounted) {
          setJobError(
            error instanceof Error ? error.message : "Unexpected job error."
          );
        }
      } finally {
        if (isMounted) {
          setLoadingJob(false);
        }
      }
    };
    loadJob();
    return () => {
      isMounted = false;
    };
  }, [apiBase, jobId]);

  const analysisResult = analysisResults[jobId] ?? null;
  const canAnalyze = !!sessionProfile && !analysisResult && !analyzing;
  const canDeepAnalyze = !!sessionProfile && !deepAnalyzing;

  const handleAnalyze = async () => {
    if (!sessionProfile || analysisResult) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_ids: [jobId],
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
      if (job) {
        const existing = analyzedJobDetails[jobId];
        const detail: AnalyzedJobDetail = {
          job_id: jobId,
          title: job.title,
          company: existing?.company ?? "",
          location: job.location?.name ?? "",
          apply_url: job.absolute_url ?? "",
        };
        setAnalyzedJobDetails((prev) => ({ ...prev, [jobId]: detail }));
        if (typeof window !== "undefined") {
          const detailsKey = `analyzed_job_details_${sessionProfile.session_id}`;
          const merged = { ...analyzedJobDetails, [jobId]: detail };
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

  const handleDeepAnalyze = async () => {
    if (!sessionProfile) return;
    setDeepAnalyzing(true);
    setDeepAnalysisError(null);
    try {
      const response = await fetch(`${apiBase}/api/analyze/deep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_id: jobId,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Deep analysis failed.");
      }
      const data = (await response.json()) as DeepAnalyzeResponse;
      setDeepAnalysis(data);
      if (!analysisResults[jobId]) {
        const base: AnalyzeResult = {
          job_id: data.job_id,
          grade: data.grade,
          rationale: data.rationale,
          missing_skills: data.missing_skills,
        };
        const mergedResults = { ...analysisResults, [jobId]: base };
        setAnalysisResults(mergedResults);
        if (typeof window !== "undefined") {
          const resultsKey = `analysis_results_${sessionProfile.session_id}`;
          window.localStorage.setItem(resultsKey, JSON.stringify(mergedResults));
        }
      }
      if (!analyzedJobIds.includes(jobId)) {
        const mergedAnalyzed = Array.from(new Set([...analyzedJobIds, jobId]));
        setAnalyzedJobIds(mergedAnalyzed);
        if (typeof window !== "undefined") {
          const storageKey = `analyzed_jobs_${sessionProfile.session_id}`;
          window.localStorage.setItem(storageKey, JSON.stringify(mergedAnalyzed));
        }
      }
      if (job) {
        const existing = analyzedJobDetails[jobId];
        const detail: AnalyzedJobDetail = {
          job_id: jobId,
          title: job.title,
          company: existing?.company ?? "",
          location: job.location?.name ?? "",
          apply_url: job.absolute_url ?? "",
        };
        setAnalyzedJobDetails((prev) => ({ ...prev, [jobId]: detail }));
        if (typeof window !== "undefined") {
          const detailsKey = `analyzed_job_details_${sessionProfile.session_id}`;
          const merged = { ...analyzedJobDetails, [jobId]: detail };
          window.localStorage.setItem(detailsKey, JSON.stringify(merged));
        }
      }
    } catch (error) {
      setDeepAnalysisError(
        error instanceof Error ? error.message : "Unexpected deep analysis error."
      );
    } finally {
      setDeepAnalyzing(false);
    }
  };

  const payRanges = useMemo(() => {
    if (!job?.pay_input_ranges || job.pay_input_ranges.length === 0) return [];
    return job.pay_input_ranges;
  }, [job]);

  const decodedContent = useMemo(() => {
    if (!job?.content) return "";
    return decodeHtml(job.content);
  }, [job?.content]);

  console.log('analysisResult', job);

  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-6 w-full md:w-2/3">
        <div className="w-full h-auto ">
          {loadingJob ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-48 rounded bg-slate-800" />
              <div className="h-4 w-32 rounded bg-slate-800" />
              <div className="h-3 w-64 rounded bg-slate-800" />
            </div>
          ) : jobError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {jobError}
            </div>
          ) : job ? (
            <div className="space-y-2">
              <p className="text-xl font-semibold text-white">{job.title}</p>
              <p className="text-sm text-slate-400">{job.location?.name}</p>
              {job.absolute_url ? (
                <a
                  className="text-xs font-semibold text-emerald-300"
                  href={job.absolute_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open official job post →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="w-full h-auto">
          <h2 className="text-lg font-semibold text-white">Job description</h2>
          {loadingJob ? (
            <div className="mt-3 space-y-2 animate-pulse">
              <div className="h-3 w-full rounded bg-slate-800" />
              <div className="h-3 w-5/6 rounded bg-slate-800" />
              <div className="h-3 w-4/6 rounded bg-slate-800" />
            </div>
          ) : decodedContent ? (
            <div
              className="prose prose-invert mt-3 max-w-none space-y-3 text-sm text-slate-200:important"
              dangerouslySetInnerHTML={{ __html: decodedContent }}
            />
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No job description available.
            </p>
          )}
        </div>

        {job?.questions?.length ? (
          <div className="w-">
            <h2 className="text-lg font-semibold text-white">
              Application questions
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-300">
              {job.questions.map((question, index) => (
                <li key={`${question.label}-${index}`}>
                  {question.label}
                  {question.required ? " (required)" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-6 w-full md:w-1/3">
        <div className="w-full h-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Match analysis</h2>
              <p className="text-xs text-slate-400">
                {analysisResult
                  ? "Analysis available for this job."
                  : "Run analysis to grade this job against your profile."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
              >
                {analyzing ? "Analyzing..." : "Analyze this job"}
              </button>
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={handleDeepAnalyze}
                disabled={!canDeepAnalyze}
              >
                {deepAnalyzing ? "Deep analyzing..." : "Deep analysis"}
              </button>
            </div>
          </div>

          {analysisError ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {analysisError}
            </div>
          ) : null}
          {deepAnalysisError ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {deepAnalysisError}
            </div>
          ) : null}

          {analysisResult ? (
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`rounded-full border px-3 py-1 ${getGradeBadgeClasses(
                    analysisResult.grade
                  )}`}
                >
                  Grade {analysisResult.grade}
                </span>
                {analysisBest === jobId ? (
                  <span className="text-[10px] uppercase text-emerald-200">
                    Best match
                  </span>
                ) : null}
              </div>
              <p>{analysisResult.rationale}</p>
              {analysisResult.missing_skills?.length ? (
                <p className="text-slate-400">
                  Missing skills: {analysisResult.missing_skills.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

        </div>

        {deepAnalysis?.learning_resources?.length ? (
          <div className="w-full h-auto">
            <h3 className="text-sm font-semibold text-white">
              Deep analysis resources
            </h3>
            <div className="mt-3 space-y-3">
              {deepAnalysis.learning_resources
                .filter((group) => group.relevant)
                .map((group) => (
                  <div
                    key={`resource-${group.skill}`}
                    className="w-full h-auto px-2 py-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white">
                        {group.skill}
                      </p>
                      <span className="text-[10px] uppercase text-slate-400">
                        {group.category}
                      </span>
                    </div>
                    {group.resources.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-xs text-slate-300 pl-4">
                        {group.resources.slice(0, 4).map((resource) => (
                          <li key={`${group.skill}-${resource.title}`}>
                            <p className="font-semibold text-slate-100">
                              {resource.title}
                            </p>
                            <p className="text-slate-400">
                              {resource.type}
                              {resource.notes ? ` • ${resource.notes}` : ""}
                            </p>
                            {resource.url ? (
                              <a
                                className="text-emerald-300"
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open resource →
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        No resources returned for this skill.
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {payRanges.length > 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200 flex flex-col gap-2">
            <p className="font-semibold text-emerald-100">Pay transparency</p>
            <div className="space-y-2">
              {payRanges.map((range) => {
                const min =
                  typeof range.min_cents === "number"
                    ? range.min_cents / 100
                    : null;
                const max =
                  typeof range.max_cents === "number"
                    ? range.max_cents / 100
                    : null;
                const currency = range.currency_type ?? "USD";
                return (
                  <div key={`${range.title ?? "range"}-${range.min_cents ?? 0}`} className="flex flex-col gap-1">
                    {range.title ? <p className="text-xs">{range.title}</p> : null}
                    {min !== null && max !== null ? (
                      <p className="text-base font-semibold">
                        {min.toLocaleString()}–{max.toLocaleString()} {currency}
                      </p>
                    ) : null}
                    
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
