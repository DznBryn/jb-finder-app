"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useSession } from "../app/session-context";
import CoverLetterEditor from "./CoverLetterEditor";
import type { MatchesSectionProps } from "../type";
import { INDUSTRY_OPTIONS } from "../type";

function getLocationBadge(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("remote")) {
    return { label, classes: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200" };
  }
  if (normalized.includes("hybrid")) {
    return { label, classes: "border-orange-500/40 bg-orange-500/10 text-orange-200" };
  }
  return { label, classes: "border-slate-600 bg-slate-800/60 text-slate-200" };
}

function splitLocationBadges(location: string | null) {
  const text = (location ?? "").trim();
  if (!text) {
    return [getLocationBadge("In-office")];
  }
  const parts = text.split(";").map((part) => part.trim()).filter(Boolean);
  return (parts.length > 0 ? parts : [text]).map(getLocationBadge);
}

function getGradeBadgeClasses(grade: string | null | undefined) {
  switch ((grade ?? "").toUpperCase()) {
    case "A":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "B":
      return "border-lime-500/40 bg-lime-500/10 text-lime-200";
    case "C":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "D":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    default:
      return "border-slate-600 bg-slate-800/60 text-slate-200";
  }
}

export default function MatchesSection({
  matchesError,
  hasLoadedMatches,
  loadingMatches,
  matches,
  matchesPage,
  matchesTotal,
  matchesPageSize,
  activeFilters,
  filterTitleTerms,
  filterLocation,
  filterWorkMode,
  filterPayRange,
  filterIndustry,
  onFilterTitleTermsChange,
  onFilterLocationChange,
  onFilterWorkModeChange,
  onFilterPayRangeChange,
  onFilterIndustryChange,
  onApplyFilters,
  onFetchMatches,
  selectedJobs,
  unanalyzedSelected,
  analyzedJobIds,
  analyzedJobDetails,
  analysisResults,
  analysisBest,
  analyzing,
  analysisProgress,
  selectionError,
  analysisError,
  selectionResult,
  applyTone,
  applyResults,
  onAnalyzeSelections,
  onSelectAllVisible,
  onDeselectAll,
  onSaveSelections,
  onToggleJobSelection,
  onApplyToneChange,
  onPrepareApply,
}: MatchesSectionProps) {
  const { sessionProfile } = useSession();
  if (!hasLoadedMatches) {
    const analyzedEntries = Object.values(analyzedJobDetails).sort((a, b) => {
      const gradeOrder = ["A", "B", "C", "D"];
      const aGrade = (analysisResults[a.job_id]?.grade ?? "D").toUpperCase();
      const bGrade = (analysisResults[b.job_id]?.grade ?? "D").toUpperCase();
      return gradeOrder.indexOf(aGrade) - gradeOrder.indexOf(bGrade);
    });
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Top matches</h3>
            <p className="text-xs text-slate-400">
              Load matches to see fresh results.
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => onFetchMatches(1, activeFilters)}
            disabled={loadingMatches}
          >
            {loadingMatches ? "Loading..." : "Load matches"}
          </button>
        </div>

        {matchesError ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {matchesError}
          </div>
        ) : null}

        {analyzedEntries.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-white">
              Previously analyzed roles
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analyzedEntries.map((detail) => {
                const result = analysisResults[detail.job_id] ?? null;
                return (
                <div
                  key={`analysis-${detail.job_id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">
                        Job ID: {detail.job_id}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {detail.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {detail.company} • {detail.location}
                      </p>
                    </div>
                    {result ? (
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold min-w-20 text-center ${getGradeBadgeClasses(
                          result.grade
                        )}`}
                      >
                        Grade {result.grade}
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-300">
                        Analysis pending
                      </span>
                    )}
                  </div>
                  {result ? (
                    <>
                      <p className="mt-3 text-xs text-slate-300">
                        {result.rationale}
                      </p>
                      {result.missing_skills?.length ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Missing skills: {result.missing_skills.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {detail.apply_url ? (
                    <a
                      className="mt-3 inline-flex text-xs font-semibold text-emerald-300"
                      href={`/jobs/${detail.job_id}`}
                    >
                      View job details →
                    </a>
                  ) : null}
                </div>
              )})}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-400">
            No analyzed roles yet.
          </p>
        )}
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(matchesTotal / matchesPageSize));
  const pageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, matchesPage - 2);
    const end = Math.min(totalPages, matchesPage + 2);
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      {matchesError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {matchesError}
        </div>
      ) : null}

      {hasLoadedMatches ? (
        <div className={matchesError ? "mt-4 space-y-3" : "space-y-3"}>
          <h3 className="text-lg font-semibold text-white">Top matches</h3>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing{" "}
              {matchesTotal === 0
                ? 0
                : (matchesPage - 1) * matchesPageSize + 1}
              -{Math.min(matchesPage * matchesPageSize, matchesTotal)} of{" "}
              {matchesTotal}
            </span>
            <span>
              Page {matchesPage} of {totalPages}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">Filters</p>
                <p className="text-xs text-slate-400">
                  Update filters and reload to refresh results.
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
                type="button"
                onClick={onApplyFilters}
                disabled={loadingMatches}
              >
                Reload matches
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs text-slate-400">Title terms</label>
                <input
                  type="text"
                  placeholder="Backend Engineer, Platform"
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterTitleTerms}
                  onChange={(event) => onFilterTitleTermsChange(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Location</label>
                <input
                  type="text"
                  placeholder="Austin, NYC"
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterLocation}
                  onChange={(event) => onFilterLocationChange(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Work mode</label>
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterWorkMode}
                  onChange={(event) => onFilterWorkModeChange(event.target.value)}
                >
                  <option value="either">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="in_office">In-office</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Pay range</label>
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterPayRange}
                  onChange={(event) => onFilterPayRangeChange(event.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="with">Only with pay range</option>
                  <option value="without">Only without pay range</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Industry</label>
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterIndustry}
                  onChange={(event) => onFilterIndustryChange(event.target.value)}
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {matches.length > 0 || loadingMatches ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white">
                    Select jobs to analyze/apply
                  </p>
                  <p className="text-xs text-slate-400">
                    Select as many roles as you want to analyze and apply.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
                    type="button"
                    onClick={onAnalyzeSelections}
                    disabled={
                      selectedJobs.length === 0 ||
                      analyzing ||
                      loadingMatches ||
                      unanalyzedSelected.length === 0
                    }
                  >
                    {analyzing ? "Analyzing..." : "Analyze selections"}
                  </button>
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
                    type="button"
                    onClick={onDeselectAll}
                    disabled={selectedJobs.length === 0 || loadingMatches}
                  >
                    Deselect all
                  </button>
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
                    type="button"
                    onClick={onSelectAllVisible}
                    disabled={loadingMatches || matches.length === 0}
                  >
                    Select all (page)
                  </button>
                  <button
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950"
                    type="button"
                    onClick={onSaveSelections}
                    disabled={selectedJobs.length === 0 || loadingMatches}
                  >
                    Save selections
                  </button>
                </div>
              </div>
              {analyzing ? (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-200">
                      {analysisProgress
                        ? `Analyzing selections… ${analysisProgress.current} of ${analysisProgress.total} (${analysisProgress.percent}%)`
                        : "Analyzing selections…"}
                    </p>
                  </div>
                  <Progress
                    className="mt-3 bar "
                    value={analysisProgress ? analysisProgress.percent : null}
                    max={100}
                  />
                </div>
              ) : null}

              {selectionError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {selectionError}
                </div>
              ) : null}

              {analysisError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {analysisError}
                </div>
              ) : null}

              {selectionResult ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                  <p>
                    Accepted:{" "}
                    {selectionResult.accepted_job_ids.join(", ") || "None"}
                  </p>
                  <p>
                    Rejected:{" "}
                    {selectionResult.rejected_job_ids.join(", ") || "None"}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loadingMatches
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={`loading-${index}`}
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
                    ))
                  : matches.map((match) => (
                      <div
                        key={match.job_id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"
                      >
                        <label className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(match.job_id)}
                            onChange={() => onToggleJobSelection(match.job_id)}
                          />
                          Select for apply
                        </label>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-white">
                              {match.title}
                            </p>
                            <p className="text-sm text-slate-400">
                              {match.company}
                            </p>
                          </div>
                          {analysisResults[match.job_id] ? (
                            <div className="flex flex-col items-end gap-1 text-right min-w-24">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getGradeBadgeClasses(
                                  analysisResults[match.job_id]?.grade ?? "D"
                                )}`}
                              >
                                Grade {analysisResults[match.job_id]?.grade ?? "D"}
                              </span>
                              {analysisBest === match.job_id ? (
                                <span className="text-[10px] uppercase text-emerald-200">
                                  Best match
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {splitLocationBadges(match.location).map((badge) => (
                            <span
                              key={`${match.job_id}-${badge.label}`}
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        {analysisResults[match.job_id] ? (
                          <div className="mt-3 space-y-2 text-xs text-slate-300">
                            <p>{analysisResults[match.job_id]?.rationale}</p>
                            {analysisResults[match.job_id]?.missing_skills?.length ? (
                              <p className="text-slate-400">
                                Missing skills:{" "}
                                {analysisResults[match.job_id]?.missing_skills.join(
                                  ", "
                                )}
                              </p>
                            ) : null}
                          </div>
                        ) : analyzing && selectedJobs.includes(match.job_id) ? (
                          <div className="mt-3 space-y-2 text-xs text-slate-300">
                            <div className="h-3 w-3/4 rounded bg-slate-800 animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-slate-800 animate-pulse" />
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                                type="button"
                              >
                                Tailor resume for ATS
                              </button>
                            </DialogTrigger>
                            <DialogContent variant="fullscreen">
                              <DialogHeader>
                                <DialogTitle>Tailor resume for ATS</DialogTitle>
                                <DialogDescription>
                                  We will tailor your resume to better match this job post
                                  and improve ATS alignment. (Coming next)
                                </DialogDescription>
                              </DialogHeader>
                              <div className="text-sm text-slate-500">
                                Job: {match.title} at {match.company}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                                type="button"
                              >
                                Edit cover letter
                              </button>
                            </DialogTrigger>
                            <DialogContent variant="fullscreen">
                              <DialogHeader>
                                <DialogTitle>Cover letter editor</DialogTitle>
                                <DialogDescription>
                                  Generate, review, and accept AI suggestions before applying.
                                </DialogDescription>
                              </DialogHeader>
                              <CoverLetterEditor
                                sessionId={sessionProfile?.session_id ?? null}
                                jobId={match.job_id}
                                jobTitle={match.title}
                                companyName={match.company}
                              />
                            </DialogContent>
                          </Dialog>
                        </div>
                        {match.pay_ranges && match.pay_ranges.length > 0 ? (
                          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                            <p className="font-semibold text-emerald-100">
                              Pay range
                            </p>
                            {match.pay_ranges.map((range, index) => {
                              const min =
                                typeof range.min_cents === "number"
                                  ? range.min_cents / 100
                                  : null;
                              const max =
                                typeof range.max_cents === "number"
                                  ? range.max_cents / 100
                                  : null;
                              const currency = range.currency_type ?? "USD";
                              return (
                                <div
                                  key={`${match.job_id}-range-${index}`}
                                  className="mt-2"
                                >
                                  {range.title ? (
                                    <p className="text-xs">{range.title}</p>
                                  ) : null}
                                  {min !== null && max !== null ? (
                                    <p className="font-bold text-md">
                                      {min.toLocaleString()}–
                                      {max.toLocaleString()} {currency}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        <a
                          className="mt-4 inline-flex text-xs font-semibold text-emerald-300"
                          href={match.apply_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open application link →
                        </a>
                        <div className="mt-4 flex flex-col gap-2">
                          <label className="text-xs text-slate-400">
                            Cover letter tone (Pro only)
                          </label>
                          <select
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                            value={applyTone}
                            onChange={(event) =>
                              onApplyToneChange(event.target.value)
                            }
                          >
                            <option value="formal">Formal</option>
                            <option value="concise">Concise</option>
                            <option value="technical">Technical</option>
                          </select>
                          <button
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                            type="button"
                            onClick={() => onPrepareApply(match.job_id)}
                          >
                            Prepare application
                          </button>
                          {applyResults[match.job_id] ? (
                            <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                              <p className="font-semibold text-white">
                                Prepared application
                              </p>
                              <p className="mt-2 whitespace-pre-line text-slate-300">
                                {applyResults[match.job_id]?.cover_letter_text ??
                                  "Cover letter available on Pro only."}
                              </p>
                            </div>
                          ) : null}
                          <a
                            className="text-xs font-semibold text-emerald-300"
                            href={`/jobs/${match.job_id}`}
                          >
                            View job details →
                          </a>
                        </div>
                      </div>
                    ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              No matches found with the current filters.
            </div>
          )}
          {totalPages > 1 ? (
            <Pagination className="pt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (matchesPage > 1) {
                        onFetchMatches(matchesPage - 1, activeFilters);
                      }
                    }}
                    className={
                      matchesPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {matchesPage > 3 ? (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          onFetchMatches(1, activeFilters);
                        }}
                        isActive={matchesPage === 1}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  </>
                ) : null}
                {pageNumbers().map((page) => (
                  <PaginationItem key={`page-${page}`}>
                    <PaginationLink
                      href="#"
                      isActive={page === matchesPage}
                      onClick={(event) => {
                        event.preventDefault();
                        onFetchMatches(page, activeFilters);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {matchesPage < totalPages - 2 ? (
                  <>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          onFetchMatches(totalPages, activeFilters);
                        }}
                        isActive={matchesPage === totalPages}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                ) : null}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (matchesPage < totalPages) {
                        onFetchMatches(matchesPage + 1, activeFilters);
                      }
                    }}
                    className={
                      matchesPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
