"use client";

import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/app/session-context";
import ResumeReviewSkeleton from "@/components/skeletons/ResumeReviewSkeleton";

const ResumeReview = dynamic(() => import("@/components/ResumeReview"), {
  loading: () => <ResumeReviewSkeleton />,
});

export default function ResumeReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { sessionProfile } = useSession();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const jobTitle = searchParams.get("title") ?? null;
  const companyName = searchParams.get("company") ?? null;

  return (
    <main className="py-2 md:py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href={jobId ? `/jobs/${jobId}` : "/"}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back to job
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="mb-4 text-sm text-slate-400">
            Review your resume against this role with targeted improvements.
          </p>
          <ResumeReview
            sessionId={sessionProfile?.session_id ?? null}
            jobId={jobId}
            jobTitle={jobTitle}
            companyName={companyName}
          />
        </div>
      </div>
    </main>
  );
}
