"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ResumeReviewResponse, ResumeTextResponse } from "../type";

type ResumeReviewProps = {
  sessionId: string | null;
  jobId: string;
  jobTitle?: string | null;
  companyName?: string | null;
};

export default function ResumeReview({
  sessionId,
  jobId,
  jobTitle,
  companyName,
}: ResumeReviewProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const [resumeText, setResumeText] = useState<string>("");
  const [loadingResume, setLoadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [review, setReview] = useState<ResumeReviewResponse | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    const loadResume = async () => {
      setLoadingResume(true);
      setResumeError(null);
      try {
        const response = await fetch(
          `${apiBase}/api/session/resume?session_id=${sessionId}`
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
  }, [apiBase, sessionId]);

  const runReview = async () => {
    if (!sessionId || reviewing) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const response = await fetch(`${apiBase}/api/resume/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Resume review failed.");
      }
      const data = (await response.json()) as ResumeReviewResponse;
      setReview(data);
    } catch (error) {
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

  if (!sessionId) {
    return (
      <p className="text-sm text-slate-500">
        Upload a resume to generate a tailored review.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md: md:items-center">
        <div>
          <p className="text-sm font-semibold text-white">
            Resume review for {jobTitle ?? "this role"}
            {companyName ? ` at ${companyName}` : ""}
          </p>
          <p className="text-xs text-slate-400">
            This review stays within your resume content and the job description.
          </p>
        </div>
        <Button
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
          variant="outline"
          type="button"
          onClick={runReview}
          disabled={reviewing || !resumePreview}
        >
          {reviewing ? "Reviewing resume..." : "Run resume review"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 max-h-[45vh] lg:max-h-[80vh] overflow-auto whitespace-pre-wrap">
          {loadingResume ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Spinner className="size-4 text-slate-200" />
              <span>Loading resume…</span>
            </div>
          ) : resumeError ? (
            <span className="text-red-300">{resumeError}</span>
          ) : resumePreview ? (
            resumePreview
          ) : (
            <span className="text-slate-500">Resume text unavailable.</span>
          )}
        </div>

        <div className=" p-3 text-xs text-slate-200 max-h-[45vh] lg:max-h-[80vh] overflow-auto">
         
          {reviewError ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {reviewError}
            </div>
          ) : null}

          {review ? (
            <div className="mt-4 space-y-4 text-sm text-slate-200">
              <div>
                <p className="font-semibold text-white">Summary</p>
                <p className="text-slate-300">{review.summary}</p>
              </div>

              {review.missing_required_skills.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Missing required skills</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.missing_required_skills.map((skill) => (
                      <li key={`missing-${skill}`}>{skill}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {review.strengths.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Strengths</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.strengths.map((item) => (
                      <li key={`strength-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {review.gaps.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Gaps to address</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.gaps.map((item) => (
                      <li key={`gap-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {review.changes.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Areas to change</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.changes.map((item) => (
                      <li key={`change-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {review.rewording.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Suggested rewording</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.rewording.map((item) => (
                      <li key={`reword-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {review.vocabulary.length > 0 ? (
                <div>
                  <p className="font-semibold text-white">Key vocabulary to add</p>
                  <ul className="mt-2 list-disc pl-5 text-slate-300">
                    {review.vocabulary.map((item) => (
                      <li key={`vocab-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Run the review to see targeted resume guidance.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
