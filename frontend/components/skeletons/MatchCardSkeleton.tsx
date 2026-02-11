"use client";

import { cn } from "@/lib/utils";

const barClass = "rounded bg-slate-800 animate-pulse";

/**
 * Skeleton that matches the match card layout. Use inside a card-sized container
 * or with card border/background passed via className.
 */
export default function MatchCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={`mb-2 h-4 w-3/4 ${barClass}`} />
          <div className={`h-3 w-1/2 ${barClass}`} />
        </div>
        <div className={`h-8 w-20 shrink-0 ${barClass}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className={`h-6 w-24 rounded-full ${barClass}`} />
        <div className={`h-6 w-20 rounded-full ${barClass}`} />
        <div className={`h-6 w-16 rounded-full ${barClass}`} />
      </div>
      <div className={`mt-1 h-16 rounded ${barClass}`} />
      <div className={`h-4 w-28 ${barClass}`} />
    </div>
  );
}
