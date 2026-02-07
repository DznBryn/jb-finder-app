"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession as useAuthSession } from "next-auth/react";
import { useSession } from "../session-context";
import { useUserResumeStore } from "@/lib/userResumeStore";

export default function AnalysisPage() {
  const { status, data } = useAuthSession();
  const { sessionProfile, analyzedJobIds, analyzedJobDetails, analysisResults } =
    useSession();
  const resumes = useUserResumeStore((state) => state.resumes);

  const authenticated =
    status === "authenticated" &&
    !!(data?.user as { id?: string } | undefined)?.id;
  const resumeLabel = sessionProfile?.resume_s3_key
    ? sessionProfile.resume_s3_key.split("/").pop()
    : sessionProfile?.first_name || sessionProfile?.last_name
      ? `${sessionProfile?.first_name ?? ""} ${sessionProfile?.last_name ?? ""}`.trim()
      : "Current session resume";

  const analyzedFromResumes = useMemo(() => {
    const entries: Array<{
      jobId: string;
      title?: string | null;
      company?: string | null;
      grade?: string | null;
      rationale?: string | null;
      missing_skills?: string[];
      resumeLabel: string;
    }> = [];
    resumes.forEach((resume) => {
      const label = resume.resume_s3_key
        ? resume.resume_s3_key.split("/").pop() ?? "Resume"
        : resume.created_at
          ? `Resume (${new Date(resume.created_at).toLocaleDateString()})`
          : "Resume";
      (resume.analyzed_jobs ?? []).forEach((job) => {
        entries.push({
          jobId: job.job_id,
          title: undefined,
          company: undefined,
          grade: job.grade ?? null,
          rationale: job.rationale ?? null,
          missing_skills: job.missing_skills ?? [],
          resumeLabel: label,
        });
      });
    });
    return entries;
  }, [resumes]);

   return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
         <h1 className="text-2xl font-semibold text-white">
           Analyzed job posts
         </h1>
         <p className="mt-2 text-sm text-slate-400">
          {authenticated
            ? "Showing analyses for your saved resumes."
            : "Showing analyses for the active session."}
         </p>
         <div className="mt-3 text-sm text-slate-300">
          Resume used:{" "}
          <span className="text-slate-100">
            {authenticated ? "Multiple resumes" : resumeLabel}
          </span>
         </div>
       </div>

      {authenticated ? (
        analyzedFromResumes.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            No analyzed jobs yet. Run Analyze or Deep analyze on a job first.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analyzedFromResumes.map((entry) => (
              <div
                key={`${entry.jobId}-${entry.resumeLabel}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      {entry.title ?? "Analyzed role"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {entry.company ?? "Unknown company"}
                    </p>
                  </div>
                  {entry.grade ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                      Grade {entry.grade}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Resume: {entry.resumeLabel}
                </p>
                {entry.rationale ? (
                  <p className="mt-3 text-xs text-slate-300">
                    {entry.rationale}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    No analysis notes saved.
                  </p>
                )}
                {entry.missing_skills?.length ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Missing skills: {entry.missing_skills.join(", ")}
                  </p>
                ) : null}
                <div className="mt-3">
                  <Link
                    className="text-xs font-semibold text-emerald-300"
                    href={`/jobs/${entry.jobId}`}
                  >
                    View job details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : analyzedJobIds.length === 0 ? (
         <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
           No analyzed jobs yet. Run Analyze or Deep analyze on a job first.
         </div>
       ) : (
         <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
           {analyzedJobIds.map((jobId) => {
             const detail = analyzedJobDetails[jobId];
             const result = analysisResults[jobId];
             return (
               <div
                 key={jobId}
                 className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
               >
                 <div className="flex items-start justify-between gap-3">
                   <div>
                     <h2 className="text-base font-semibold text-white">
                       {detail?.title ?? "Untitled role"}
                     </h2>
                     <p className="text-xs text-slate-400">
                       {detail?.company ?? "Unknown company"}
                     </p>
                   </div>
                   {result?.grade ? (
                     <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                       Grade {result.grade}
                     </span>
                   ) : null}
                 </div>
                 {result?.rationale ? (
                   <p className="mt-3 text-xs text-slate-300">
                     {result.rationale}
                   </p>
                 ) : (
                   <p className="mt-3 text-xs text-slate-500">
                     No analysis notes saved.
                   </p>
                 )}
                 {result?.missing_skills?.length ? (
                   <p className="mt-2 text-xs text-slate-400">
                     Missing skills: {result.missing_skills.join(", ")}
                   </p>
                 ) : null}
                 <div className="mt-3">
                   <Link
                     className="text-xs font-semibold text-emerald-300"
                     href={`/jobs/${jobId}`}
                   >
                     View job details →
                   </Link>
                 </div>
               </div>
             );
           })}
         </div>
       )}
     </div>
   );
 }
