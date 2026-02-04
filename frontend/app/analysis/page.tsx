 "use client";

 import Link from "next/link";
 import { useSession } from "../session-context";

 export default function AnalysisPage() {
   const { sessionProfile, analyzedJobIds, analyzedJobDetails, analysisResults } =
     useSession();

   const resumeLabel = sessionProfile?.resume_s3_key
     ? sessionProfile.resume_s3_key.split("/").pop()
     : sessionProfile?.first_name || sessionProfile?.last_name
       ? `${sessionProfile?.first_name ?? ""} ${sessionProfile?.last_name ?? ""}`.trim()
       : "Current session resume";

   return (
     <div className="space-y-6">
       <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
         <h1 className="text-2xl font-semibold text-white">
           Analyzed job posts
         </h1>
         <p className="mt-2 text-sm text-slate-400">
           Showing analyses for the active session.
         </p>
         <div className="mt-3 text-sm text-slate-300">
           Resume used: <span className="text-slate-100">{resumeLabel}</span>
         </div>
       </div>

       {analyzedJobIds.length === 0 ? (
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
