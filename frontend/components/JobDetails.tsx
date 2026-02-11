"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession as useAuthSession } from "next-auth/react";
import { useSession } from "../app/session-context";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useUserResumeStore } from "@/lib/userResumeStore";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import SignupPrompt from "@/components/SignupPrompt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CoverLetterEditorSkeleton from "./skeletons/CoverLetterEditorSkeleton";
import type {
  AnalyzeResult,
  AnalyzedJobDetail,
  DeepAnalyzeResponse,
  GreenhouseJob,
  JobSummary,
} from "@/type";

const CoverLetterEditor = dynamic(() => import("./CoverLetterEditor"), {
  loading: () => <CoverLetterEditorSkeleton />,
});

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

function JobSummaryContent({ jobSummary }: { jobSummary?: JobSummary | null }) {
  if (!jobSummary) {
    return (
      <p className="text-xs text-slate-500 px-2 py-2">
        No job summary available for this analysis.
      </p>
    );
  }
  const sections: { label: string; items: string[] }[] = [
    { label: "Core responsibilities", items: jobSummary.core_responsibilities ?? [] },
    { label: "Must-have skills", items: jobSummary.must_have_skills ?? [] },
    { label: "Nice-to-have skills", items: jobSummary.nice_to_have_skills ?? [] },
    { label: "Tools & stack", items: jobSummary.tools_and_stack ?? [] },
    { label: "Signals", items: jobSummary.signals ?? [] },
  ];
  return (
    <div className="space-y-4 px-2 py-1">
      {(jobSummary.title || jobSummary.seniority || jobSummary.domain) ? (
        <div className="space-y-1">
          {jobSummary.title ? (
            <p className="text-sm font-semibold text-white">{jobSummary.title}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {jobSummary.seniority ? (
              <span className="rounded bg-slate-700/60 px-2 py-0.5">{jobSummary.seniority}</span>
            ) : null}
            {jobSummary.domain ? (
              <span className="rounded bg-slate-700/60 px-2 py-0.5">{jobSummary.domain}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {sections.map(
        ({ label, items }) =>
          items.length > 0 && (
            <div key={label}>
              <p className="text-xs font-semibold text-slate-300 mb-1.5">{label}</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-400">
                {items.map((item, i) => (
                  <li key={`${label}-${i}`}>{item}</li>
                ))}
              </ul>
            </div>
          )
      )}
      {sections.every((s) => s.items.length === 0) && !jobSummary.title && !jobSummary.seniority && !jobSummary.domain ? (
        <p className="text-xs text-slate-500">No structured summary fields available.</p>
      ) : null}
    </div>
  );
}

function LearningResourcesContent({
  learningResources,
}: {
  learningResources?: DeepAnalyzeResponse["learning_resources"];
}) {
  const groups = (learningResources ?? []).filter((g) => g.relevant);
  if (groups.length === 0) {
    return (
      <p className="text-xs text-slate-500 px-2 py-2">
        No learning resources for this analysis. Run deep analysis to gather resources for missing skills.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={`resource-${group.skill}`}
          className="w-full h-auto px-2 py-1 flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-white">{group.skill}</p>
            <small className="text-xs text-emerald-300">
              {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
            </small>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {group.summary?.trim().length
              ? group.summary
              : "These resources were chosen to help you quickly ramp up on this gap using a mix of official docs and practical walkthroughs relevant to the role."}
          </p>
          {group.resources.length > 0 ? (
            <ul className="mt-2 space-y-2 text-xs text-slate-300 pl-4">
              {group.resources.slice(0, 4).map((resource) => (
                <li key={`${group.skill}-${resource.title}`}>
                  <p className="font-semibold text-slate-100">{resource.title}</p>
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
            <p className="mt-2 text-xs text-slate-400">No resources returned for this skill.</p>
          )}
        </div>
      ))}
    </div>
  );
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
  const { status } = useAuthSession();
  const hydrateUserBase = useUserBaseStore((s) => s.hydrateUserBase);
  const resumes = useUserResumeStore((state) => state.resumes);
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
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const getCallbackUrl = () =>
    typeof window === "undefined" ? "/" : window.location.href;

  const requireAuthForLlm = () => {
    if (status === "unauthenticated") {
      setShowSignupPrompt(true);
      return true;
    }
    return false;
  };
  const applyDeepAnalysis = (data: DeepAnalyzeResponse) => {
    setDeepAnalysis(data);

    setAnalysisResults((prev) => {
      if (prev[jobId]) return prev;
      return {
        ...prev,
        [jobId]: {
          job_id: data.job_id,
          grade: data.grade,
          rationale: data.rationale,
          missing_skills: data.missing_skills,
        },
      };
    });

    setAnalyzedJobIds((prev) => {
      if (prev.includes(jobId)) return prev;
      return [...prev, jobId];
    });

    if (job) {
      setAnalyzedJobDetails((prev) => ({
        ...prev,
        [jobId]: {
          job_id: jobId,
          title: job.title,
          company: prev[jobId]?.company ?? "",
          location: job.location?.name ?? "",
          apply_url: job.absolute_url ?? "",
        },
      }));
    }

    if (typeof window !== "undefined") {
      const resultsKey = `analysis_results_${data.session_id}`;
      const analyzedKey = `analyzed_jobs_${data.session_id}`;
      const detailsKey = `analyzed_job_details_${data.session_id}`;
      window.localStorage.setItem(
        resultsKey,
        JSON.stringify({
          ...analysisResults,
          [data.job_id]: {
            job_id: data.job_id,
            grade: data.grade,
            rationale: data.rationale,
            missing_skills: data.missing_skills,
          },
        })
      );
      window.localStorage.setItem(
        analyzedKey,
        JSON.stringify(
          analyzedJobIds.includes(jobId) ? analyzedJobIds : [...analyzedJobIds, jobId]
        )
      );
      if (job) {
        const existing = analyzedJobDetails[jobId];
        window.localStorage.setItem(
          detailsKey,
          JSON.stringify({
            ...analyzedJobDetails,
            [jobId]: {
              job_id: jobId,
              title: job.title,
              company: existing?.company ?? "",
              location: job.location?.name ?? "",
              apply_url: job.absolute_url ?? "",
            },
          })
        );
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadJob = async () => {
      setLoadingJob(true);
      setJobError(null);
      try {
        const response = await fetch(
          `/api/greenhouse/job?job_id=${jobId}`
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
  }, [jobId]);

  useEffect(() => {
    if (!sessionProfile || deepAnalysis || deepAnalyzing) return;
    const loadCached = async () => {
      try {
        const response = await fetch(
          `/api/analyze/deep?session_id=${sessionProfile.session_id}&job_id=${jobId}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as DeepAnalyzeResponse;
        applyDeepAnalysis(data);
      } catch { }
    };

    loadCached();
  }, [jobId, sessionProfile, deepAnalysis, deepAnalyzing]);

  const storeResult = useMemo(() => {
    if (status !== "authenticated") return null;
    for (const resume of resumes) {
      const found = (resume.analyzed_jobs ?? []).find(
        (entry) => entry.job_id === jobId
      );
      if (found) return found;
    }
    return null;
  }, [jobId, resumes, status]);

  const analysisResult = storeResult ?? analysisResults[jobId] ?? null;
  const hasDeepAnalysisContent =
    !!deepAnalysis &&
    (deepAnalysis.job_summary != null ||
      (deepAnalysis.learning_resources?.length ?? 0) > 0);
  const canAnalyze = !!sessionProfile && !analysisResult && !analyzing;
  const canDeepAnalyze =
    !!sessionProfile && !deepAnalyzing && !hasDeepAnalysisContent;

  const handleAnalyze = async () => {
    if (!sessionProfile || analysisResult) return;
    if (requireAuthForLlm()) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_ids: [jobId],
        }),
      });
      if (response.status === 402) {
        const detail = (await response.json().catch(() => ({}))) as {
          required?: number;
          available?: number;
        };
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
      if (error instanceof Error && error.message === "PAYMENT_REQUIRED") {
        return;
      }
      setAnalysisError(
        error instanceof Error ? error.message : "Unexpected analysis error."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeepAnalyze = async () => {
    if (!sessionProfile) return;
    if (requireAuthForLlm()) return;
    setDeepAnalyzing(true);
    setDeepAnalysisError(null);
    try {
      const response = await fetch("/api/analyze/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_id: jobId,
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
        throw new Error(detail || "Deep analysis failed.");
      }
      const data = (await response.json()) as DeepAnalyzeResponse;
      applyDeepAnalysis(data);
      hydrateUserBase();
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENT_REQUIRED") {
        return;
      }
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

  return (
    <>
      <SignupPrompt
        open={showSignupPrompt}
        onOpenChange={setShowSignupPrompt}
        onGoogle={() => signIn("google", { callbackUrl: getCallbackUrl() })}
        onLinkedIn={() => signIn("linkedin", { callbackUrl: getCallbackUrl() })}
        title="Save your progress"
        message="Create an account to save your session and unlock more features."
      />
      <div className="flex flex-col md:flex-row p-2 gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6 flex flex-col gap-6 w-full md:w-7/12">
        <div className="w-full h-auto">
          {loadingJob ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-3/4 rounded bg-slate-800" />
              <div className="h-4 w-1/2 rounded bg-slate-800" />
              <div className="mt-4 flex gap-2">
                <div className="h-5 w-20 rounded-full bg-slate-800" />
                <div className="h-5 w-24 rounded-full bg-slate-800" />
              </div>
            </div>
          ) : jobError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {jobError}
            </div>
          ) : job ? (
            <div className="grid grid-cols-1 md:grid-cols-2  gap-4">
              <div className="flex flex-col gap-2 w-full h-full">
                <div>
                  <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                  {job.location?.name ? (
                    <p className="text-sm text-slate-400">{job.location.name}</p>
                  ) : null}
                </div>
                {job.absolute_url ? (
                  <a
                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-300 hover:underline"
                    href={job.absolute_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on company site →
                  </a>
                ) : null}
              </div>
              <ButtonGroup className="self-start md:justify-self-end">
                <Button
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100 disabled:opacity-60"
                  variant="outline"
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                >
                  {analyzing ? "Analyzing..." : "Analyze"}
                </Button>
                <Button
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100 disabled:opacity-60"
                  variant="outline"
                  type="button"
                  onClick={handleDeepAnalyze}
                  disabled={!canDeepAnalyze}
                >
                  {deepAnalyzing ? "Deep analyzing..." : "Deep analyze"}
                </Button>
              </ButtonGroup>
            </div>
          ) : null}
        </div>

        <div className="w-full h-auto overflow-hidden max-h-[500px] overflow-y-auto bg-slate-950/80 p-4 rounded-md gap-4 flex flex-col job-details-description">
          <h2 className="text-lg font-semibold text-white">Job description</h2>
          {decodedContent ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-slate-300"
              dangerouslySetInnerHTML={{ __html: decodedContent }}
            />
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No job description available.
            </p>
          )}
        </div>

        {job?.questions?.length ? (
          <div className="w-full">
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

      <div className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-6 w-full md:w-5/12">
        <div className="w-full h-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Match analysis</h2>
              <p className="text-xs text-slate-400">
                {analysisResult
                  ? "Deep analysis available for this job."
                  : "Run analysis to grade this job against your profile."}
              </p>
            </div>
            <ButtonGroup className="flex flex-wrap">

              <Button
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                variant="outline"
                type="button"
                asChild
              >
                <Link
                  href={
                    `/jobs/${jobId}/resume-review` +
                    (() => {
                      const q = new URLSearchParams();
                      if (job?.title) q.set("title", job.title);
                      if (analyzedJobDetails[jobId]?.company)
                        q.set("company", analyzedJobDetails[jobId].company);
                      const s = q.toString();
                      return s ? `?${s}` : "";
                    })()
                  }
                >
                  Resume review
                </Link>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                    variant="outline"
                    type="button"
                  >
                    Cover letter
                  </Button>
                </DialogTrigger>
                <DialogContent variant="fullscreen">
                  <DialogHeader>
                    <DialogTitle>Cover letter editor</DialogTitle>
                    <DialogDescription>
                      Generate, review, and accept AI suggestions before applying.
                    </DialogDescription>
                  </DialogHeader>
                  <CoverLetterEditor
                    sessionId={sessionProfile?.session_id ?? null}
                    jobId={jobId}
                    jobTitle={job?.title ?? null}
                    companyName={analyzedJobDetails[jobId]?.company ?? null}
                  />
                </DialogContent>
              </Dialog>
            </ButtonGroup>
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
          ) : analyzing ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Spinner className="size-4 text-slate-200" />
              <span>Analyzing this job…</span>
            </div>
          ) : null}

          {analysisResult && payRanges.length > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200 flex flex-col gap-2">
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
                    <div
                      key={`${range.title ?? "range"}-${range.min_cents ?? 0}`}
                      className="flex flex-col gap-1"
                    >
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

        {deepAnalyzing && !deepAnalysis ? (
          <div className="w-full h-auto p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Spinner className="size-4 text-slate-600" />
              <span className="text-slate-600">Deep analyzing… gathering job summary and learning resources.</span>
            </div>
          </div>
        ) : null}

        {hasDeepAnalysisContent && deepAnalysis ? (
          <div className="w-full h-auto">
            <h3 className="text-sm font-semibold text-white mb-2">
              Deep analysis
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Structured job summary and learning resources for missing skills.
            </p>
            <Tabs defaultValue="job-summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-lg bg-slate-800/80 p-1">
                <TabsTrigger value="job-summary" className="rounded-md data-[state=active]:bg-slate-700">
                  Job summary
                </TabsTrigger>
                <TabsTrigger value="learning-resources" className="rounded-md data-[state=active]:bg-slate-700">
                  Learning resources
                </TabsTrigger>
              </TabsList>
              <TabsContent value="job-summary" className="mt-3 space-y-3">
                <JobSummaryContent jobSummary={deepAnalysis.job_summary} />
              </TabsContent>
              <TabsContent value="learning-resources" className="mt-3 space-y-3">
                <LearningResourcesContent learningResources={deepAnalysis.learning_resources} />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
}
