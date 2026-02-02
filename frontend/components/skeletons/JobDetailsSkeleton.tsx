"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function JobDetailsSkeleton() {
  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6 md:px-12">
      {/* Main content area */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-6 w-full md:w-8/12">
        {/* Header skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4 bg-slate-800" />
          <Skeleton className="h-4 w-1/2 bg-slate-800" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-6 w-24 rounded-full bg-slate-800" />
            <Skeleton className="h-6 w-32 rounded-full bg-slate-800" />
          </div>
        </div>

        {/* Job description skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-40 bg-slate-800" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-5/6 bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-4/5 bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-3/4 bg-slate-800" />
          </div>
        </div>

        {/* Requirements skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 bg-slate-800" />
          <div className="space-y-2 pl-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`req-${i}`} className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full bg-slate-800" />
                <Skeleton className="h-4 w-full bg-slate-800" style={{ width: `${60 + Math.random() * 30}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Questions skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-44 bg-slate-800" />
          <div className="space-y-2 pl-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`q-${i}`} className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full bg-slate-800" />
                <Skeleton className="h-4 bg-slate-800" style={{ width: `${50 + Math.random() * 40}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-6 w-full md:w-4/12">
        {/* Match analysis section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 bg-slate-800" />
              <Skeleton className="h-3 w-48 bg-slate-800" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28 rounded-lg bg-slate-800" />
              <Skeleton className="h-8 w-24 rounded-lg bg-slate-800" />
            </div>
          </div>

          {/* Grade badge skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full bg-slate-800" />
            <Skeleton className="h-4 w-16 bg-slate-800" />
          </div>

          {/* Analysis rationale skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-5/6 bg-slate-800" />
            <Skeleton className="h-4 w-4/5 bg-slate-800" />
          </div>

          {/* Missing skills skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
          </div>
        </div>

        {/* Pay transparency skeleton */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <Skeleton className="h-4 w-32 bg-slate-800" />
          <Skeleton className="h-6 w-40 bg-slate-800" />
        </div>

        {/* Deep analysis resources skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-44 bg-slate-800" />
          <Skeleton className="h-3 w-full bg-slate-800" />
          <div className="space-y-4 mt-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`resource-${i}`} className="space-y-2 p-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24 bg-slate-800" />
                  <Skeleton className="h-4 w-16 bg-slate-800" />
                </div>
                <Skeleton className="h-3 w-full bg-slate-800" />
                <Skeleton className="h-3 w-5/6 bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
