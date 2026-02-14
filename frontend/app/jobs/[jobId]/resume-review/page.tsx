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
  console.log("sessionProfile", sessionProfile);
  return (
    <main className="py-2 md:py-4">
      <div className="mx-auto max-w-8xl px-2">
        <div className="">
          <Link
            href={jobId ? `/jobs/${jobId}` : "/"}
            className="text-sm text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to job
          </Link>
        </div>
        <div className="p-4">
          <ResumeReview
            sessionId={sessionProfile?.session_id ?? null}
            jobId={jobId}
            jobTitle={jobTitle}
            companyName={companyName}
            resumeId={sessionProfile?.resume_s3_key ?? null}
          />
        </div>
      </div>
    </main>
  );
}
