"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type AnalyzeProgressProps = {
  analyzing: boolean;
  analysisProgress: {
    current: number;
    total: number;
    percent: number;
  } | null;
  compact?: boolean;
  className?: string;
};

export default function AnalyzeProgress({
  analyzing,
  analysisProgress,
  compact = false,
  className,
}: AnalyzeProgressProps) {
  if (!analyzing) return null;

  return (
    <div
      className={cn(
        compact ? "px-2 py-2" : "p-4",
        className
      )}
    >
      <p className="text-xs font-semibold text-slate-200">
        {analysisProgress
          ? `Analyzing selections… ${analysisProgress.current} of ${analysisProgress.total} (${analysisProgress.percent}%)`
          : "Analyzing selections…"}
      </p>
      <Progress
        className={cn("mt-2 bar", compact && "h-1.5")}
        value={analysisProgress ? analysisProgress.percent : null}
        max={100}
      />
    </div>
  );
}
