"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function CoverLetterEditorSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:min-h-[70vh]">
      {/* Left panel - Editor */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/40 gap-3 p-3">
          {/* Header */}
          <div className="flex items-center justify-between text-xs">
            <Skeleton className="h-4 w-32 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
          </div>

          {/* Editor area */}
          <div className="min-h-[45vh] bg-slate-950 px-3 py-3 rounded-lg">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full bg-slate-800" />
              <Skeleton className="h-4 w-5/6 bg-slate-800" />
              <Skeleton className="h-4 w-full bg-slate-800" />
              <Skeleton className="h-4 w-4/5 bg-slate-800" />
              <Skeleton className="h-4 w-full bg-slate-800" />
              <Skeleton className="h-4 w-3/4 bg-slate-800" />
              <Skeleton className="h-4 w-full bg-slate-800" />
              <Skeleton className="h-4 w-5/6 bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`btn-${i}`} className="h-8 w-28 rounded-lg bg-slate-800" />
            ))}
          </div>
          <Skeleton className="mt-3 h-3 w-64 bg-slate-800" />
        </div>
      </div>

      {/* Right panel - Tabs */}
      <div className="flex flex-col gap-3">
        {/* Tab list */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-1">
          <div className="flex gap-1">
            <Skeleton className="h-8 w-24 rounded-lg bg-slate-800" />
            <Skeleton className="h-8 w-16 rounded-lg bg-slate-800" />
            <Skeleton className="h-8 w-20 rounded-lg bg-slate-800" />
          </div>
        </div>

        {/* Tab content */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex-1">
          <Skeleton className="h-4 w-24 bg-slate-800" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-5/6 bg-slate-800" />
            <Skeleton className="h-4 w-4/5 bg-slate-800" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg bg-slate-800" />
            <Skeleton className="h-8 w-20 rounded-lg bg-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
