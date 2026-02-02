"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeReviewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-64 bg-slate-800" />
          <Skeleton className="h-3 w-80 bg-slate-800" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg bg-slate-800" />
      </div>

      {/* Two column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column - Resume text */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 max-h-[45vh] lg:max-h-[80vh]">
          <div className="space-y-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton
                key={`resume-line-${i}`}
                className="h-3 bg-slate-800"
                style={{ width: `${50 + Math.random() * 50}%` }}
              />
            ))}
          </div>
        </div>

        {/* Right column - Review results */}
        <div className="p-3 max-h-[45vh] lg:max-h-[80vh] space-y-4">
          {/* Summary */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-20 bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-5/6 bg-slate-800" />
          </div>

          {/* Missing skills */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 bg-slate-800" />
            <div className="space-y-1 pl-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skill-${i}`} className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full bg-slate-800" />
                  <Skeleton className="h-4 bg-slate-800" style={{ width: `${40 + Math.random() * 40}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24 bg-slate-800" />
            <div className="space-y-1 pl-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`strength-${i}`} className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full bg-slate-800" />
                  <Skeleton className="h-4 bg-slate-800" style={{ width: `${50 + Math.random() * 40}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Gaps */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 bg-slate-800" />
            <div className="space-y-1 pl-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`gap-${i}`} className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full bg-slate-800" />
                  <Skeleton className="h-4 bg-slate-800" style={{ width: `${45 + Math.random() * 45}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
