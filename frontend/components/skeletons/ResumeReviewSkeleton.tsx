"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeReviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 bg-slate-700/60" />
          <Skeleton className="h-4 w-56 bg-slate-700/60" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-lg bg-slate-700/60" />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]">
        {/* Left: Resume preview */}
        <div className="flex flex-col">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40">
            <div className="border-b border-slate-700/50 bg-slate-800/60 px-4 py-2.5">
              <Skeleton className="h-4 w-24 bg-slate-700/60" />
            </div>
            <div className="min-h-[200px] space-y-2 p-4 lg:min-h-[300px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton
                  key={`resume-line-${i}`}
                  className="h-3.5 bg-slate-700/60"
                  style={{ width: `${45 + Math.random() * 50}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Review results empty state */}
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-600/60 bg-slate-800/30 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Skeleton className="size-12 rounded-full bg-slate-700/60" />
            <div className="space-y-2">
              <Skeleton className="mx-auto h-4 w-28 bg-slate-700/60" />
              <Skeleton className="mx-auto h-3 w-64 bg-slate-700/60" />
            </div>
            <Skeleton className="h-10 w-36 rounded-lg bg-slate-700/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
