"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUserBaseStore } from "@/lib/userBaseStore";
import type { ResumeReviewResponse, ResumeTextResponse } from "../type";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ResumeReviewProps = {
  sessionId: string | null;
  jobId: string;
  jobTitle?: string | null;
  companyName?: string | null;
  resumeId?: string | null;
};

const DESKTOP_TABS = [
  { id: "overview", label: "Overview" },
  { id: "improvement-areas", label: "Improvement Areas" },
  { id: "suggested-edits", label: "Suggested Edits" },
] as const;

type TabId = (typeof DESKTOP_TABS)[number]["id"];

function ReviewSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 transition-opacity duration-300",
        className
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function SuggestedEditsContent({
  review,
}: {
  review: ResumeReviewResponse;
}) {
  return (
    <div className="space-y-3">
      {review.changes.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
            Areas to change
          </p>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {review.changes.map((item) => (
              <li key={`change-${item}`} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.rewording.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
            Suggested rewording
          </p>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {review.rewording.map((item) => (
              <li key={`reword-${item}`} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.vocabulary.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
            Key vocabulary to add
          </p>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {review.vocabulary.map((item) => (
              <li key={`vocab-${item}`} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ResumeReview({
  sessionId,
  jobId,
  jobTitle,
  companyName,
  resumeId,
}: ResumeReviewProps) {
  const [resumeText, setResumeText] = useState<string>("");
  const [loadingResume, setLoadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [review, setReview] = useState<ResumeReviewResponse | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [resumeExpanded, setResumeExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const hydrateUserBase = useUserBaseStore((s) => s.hydrateUserBase);

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    const loadResume = async () => {
      setLoadingResume(true);
      setResumeError(null);
      try {
        const response = await fetch(
          `/api/session/resume?session_id=${sessionId}`
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to load resume text.");
        }
        const data = (await response.json()) as ResumeTextResponse;
        if (isMounted) {
          setResumeText(data.resume_text);
        }
      } catch (error) {
        if (isMounted) {
          setResumeError(
            error instanceof Error ? error.message : "Unable to load resume."
          );
        }
      } finally {
        if (isMounted) setLoadingResume(false);
      }
    };

    loadResume();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !jobId) return;
    let isMounted = true;
    const loadLatestReview = async () => {
      try {
        const res = await fetch(
          `/api/resume/review/latest?session_id=${encodeURIComponent(sessionId)}&job_id=${encodeURIComponent(jobId)}`
        );
        if (res.ok && isMounted) {
          const data = (await res.json()) as ResumeReviewResponse;
          setReview(data);
        }
      } catch {}
    };
    loadLatestReview();
    return () => {
      isMounted = false;
    };
  }, [sessionId, jobId]);

  const runReview = async () => {
    if (!sessionId || reviewing) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const response = await fetch("/api/resume/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
          resume_id: resumeId,
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
        throw new Error(detail || "Resume review failed.");
      }
      
      const data = (await response.json()) as ResumeReviewResponse;
      setReview(data);
      hydrateUserBase();
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENT_REQUIRED") {
        return;
      }
      setReviewError(
        error instanceof Error ? error.message : "Resume review failed."
      );
    } finally {
      setReviewing(false);
    }
  };

  const resumePreview = useMemo(() => {
    if (!resumeText) return "";
    return resumeText.trim();
  }, [resumeText]);

  const subheading = [jobTitle, companyName].filter(Boolean).join(", ") || "this role";

  if (!sessionId) {
    return (
      <p className="text-sm text-slate-500">
        Upload a resume to generate a tailored review.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Resume Review
          </h1>
          <p className="mt-1 text-sm text-slate-400">{subheading}</p>
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto sm:self-end"
          variant="default"
          size="lg"
          onClick={runReview}
          disabled={reviewing || !resumePreview}
        >
          {reviewing ? (
            <>
              <Spinner className="size-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            "Run resume review"
          )}
        </Button>
      </div>


      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col col-span-6">
          <button
            type="button"
            onClick={() => setResumeExpanded((e) => !e)}
            className={cn(
              "flex lg:hidden items-center justify-between border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-left",
              resumeExpanded ? "rounded-t-xl border-b-0" : "rounded-xl"
            )}
          >
            <span className="text-sm font-medium text-white">Your Resume</span>
            {resumeExpanded ? (
              <ChevronUp className="size-4 text-slate-400" />
            ) : (
              <ChevronDown className="size-4 text-slate-400" />
            )}
          </button>

          <div
            className={cn(
              "flex flex-col overflow-hidden border border-slate-700/60 bg-slate-800/40",
              "lg:flex lg:rounded-xl",
              !resumeExpanded && "hidden lg:flex"
            )}
          >

            <div className="hidden shrink-0 border-b border-slate-700/50 bg-slate-800/60 px-4 py-2.5 lg:block">
              <p className="text-sm font-medium text-slate-200">Your Resume</p>
            </div>
            <div
              className={cn(
                "min-h-[200px] max-h-[45vh] overflow-y-auto px-4 py-4 lg:max-h-[70vh] lg:min-h-[300px]",
                "relative",
                "scroll-smooth",
              )}
            >
              {loadingResume ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Spinner className="size-4 text-slate-200" />
                  <span className="text-sm">Loading resume…</span>
                </div>
              ) : resumeError ? (
                <span className="text-sm text-red-300">{resumeError}</span>
              ) : resumePreview ? (
                <pre
                  className={cn(
                    "whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300",
                    "select-text"
                  )}
                >
                  {resumePreview}
                </pre>
              ) : (
                <span className="text-sm text-slate-500">Resume text unavailable.</span>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-[280px] lg:min-h-[320px] col-span-6">
          {reviewError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {reviewError}
            </div>
          ) : review ? (
            <>
              <div className="space-y-4 animate-in fade-in duration-300 md:hidden">
                <ReviewSectionCard title="Summary">
                  <p className="text-sm leading-relaxed text-slate-300">
                    {review.summary}
                  </p>
                </ReviewSectionCard>

                {review.strengths.length > 0 && (
                  <ReviewSectionCard title="Key Strengths">
                    <ul className="space-y-2">
                      {review.strengths.map((item) => (
                        <li
                          key={`strength-${item}`}
                          className="flex items-start gap-2 text-sm text-slate-300"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ReviewSectionCard>
                )}

                {review.missing_required_skills.length > 0 && (
                  <ReviewSectionCard title="Missing Skills">
                    <ul className="space-y-2">
                      {review.missing_required_skills.map((skill) => (
                        <li
                          key={`missing-${skill}`}
                          className="flex items-start gap-2 text-sm text-slate-300"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                          <span>{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </ReviewSectionCard>
                )}

                {review.gaps.length > 0 && (
                  <ReviewSectionCard title="Improvement Areas">
                    <ul className="space-y-2">
                      {review.gaps.map((item) => (
                        <li
                          key={`gap-${item}`}
                          className="flex items-start gap-2 text-sm text-slate-300"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </ReviewSectionCard>
                )}

                {(review.changes.length > 0 ||
                  review.rewording.length > 0 ||
                  review.vocabulary.length > 0) && (
                    <ReviewSectionCard title="Suggested Resume Edits">
                      <SuggestedEditsContent review={review} />
                    </ReviewSectionCard>
                  )}
              </div>

              <div className="hidden md:block md:min-h-[320px]">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as TabId)}
                  className="flex flex-col h-full"
                >
                  <TabsList className="w-full justify-start flex-wrap gap-2 h-auto rounded-xl border border-slate-700/60 bg-slate-800/60 p-1.5">
                    {DESKTOP_TABS.map(({ id, label }) => (
                      <TabsTrigger
                        key={id}
                        value={id}
                        className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-slate-700/80 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-slate-600/80"
                      >
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent
                    value="overview"
                    className="mt-4 flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 data-[state=inactive]:hidden"
                  >
                    <ReviewSectionCard title="Summary">
                      <p className="text-sm leading-relaxed text-slate-300">
                        {review.summary}
                      </p>
                    </ReviewSectionCard>
                    <ReviewSectionCard title="Key Insights">
                      {review.strengths.length > 0 ? (
                        <ul className="space-y-2">
                          {review.strengths.map((item) => (
                            <li
                              key={`strength-${item}`}
                              className="flex items-start gap-2 text-sm text-slate-300"
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">No strengths identified.</p>
                      )}
                    </ReviewSectionCard>
                    <ReviewSectionCard title="Missing Skills">
                      {review.missing_required_skills.length > 0 ? (
                        <ul className="space-y-2">
                          {review.missing_required_skills.map((skill) => (
                            <li
                              key={`missing-${skill}`}
                              className="flex items-start gap-2 text-sm text-slate-300"
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                              <span>{skill}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">No missing skills identified.</p>
                      )}
                    </ReviewSectionCard>
                  </TabsContent>
                  <TabsContent
                    value="improvement-areas"
                    className="mt-4 flex-1 overflow-y-auto min-h-0 rounded-xl border border-slate-700/60 data-[state=inactive]:hidden"
                  >
                    <ReviewSectionCard title="Improvement Areas">
                      {review.gaps.length > 0 ? (
                        <ul className="space-y-2">
                          {review.gaps.map((item) => (
                            <li
                              key={`gap-${item}`}
                              className="flex items-start gap-2 text-sm text-slate-300"
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">No improvement areas identified.</p>
                      )}
                    </ReviewSectionCard>
                  </TabsContent>
                  <TabsContent
                    value="suggested-edits"
                    className="mt-4 flex-1 overflow-y-auto min-h-0 rounded-xl border border-slate-700/60 data-[state=inactive]:hidden"
                  >
                    <ReviewSectionCard title="Suggested Resume Edits">
                      {review.changes.length > 0 ||
                        review.rewording.length > 0 ||
                        review.vocabulary.length > 0 ? (
                        <SuggestedEditsContent review={review} />
                      ) : (
                        <p className="text-sm text-slate-500">No suggested edits.</p>
                      )}
                    </ReviewSectionCard>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-600/60 bg-slate-800/30 px-6 py-10 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-700/60">
                <Search className="size-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">
                No review yet
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                Run the review to see targeted improvement suggestions.
              </p>
              <Button
                className="mt-6"
                variant="default"
                onClick={runReview}
                disabled={reviewing || !resumePreview}
              >
                {reviewing ? (
                  <>
                    <Spinner className="size-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Run resume review"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
