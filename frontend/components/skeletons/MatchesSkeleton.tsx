"use client";

export default function MatchesSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-5 w-32 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-48 rounded bg-slate-800" />
        </div>
        <div className="h-3 w-24 rounded bg-slate-800" />
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 animate-pulse">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="h-3 w-48 rounded bg-slate-800" />
          </div>
          <div className="h-8 w-28 rounded bg-slate-800" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`filter-skeleton-${index}`} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-800" />
              <div className="h-8 w-full rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`match-skeleton-${index}`}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200 animate-pulse"
          >
            <div className="mb-3 h-4 w-24 rounded bg-slate-800" />
            <div className="mb-2 h-4 w-3/4 rounded bg-slate-800" />
            <div className="mb-4 h-3 w-1/2 rounded bg-slate-800" />
            <div className="mb-4 flex gap-2">
              <div className="h-5 w-20 rounded-full bg-slate-800" />
              <div className="h-5 w-16 rounded-full bg-slate-800" />
            </div>
            <div className="h-20 rounded bg-slate-900" />
          </div>
        ))}
      </div>
    </section>
  );
}
