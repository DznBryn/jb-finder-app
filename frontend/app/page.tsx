"use client";

import { useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

type SessionProfile = {
  session_id: string;
  resume_s3_key: string | null;
  extracted_skills: string[];
  inferred_titles: string[];
  seniority: string;
  years_experience: number;
  location_pref: string | null;
  remote_pref: boolean | null;
  llm_summary: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  social_links: string[];
  created_at: string;
  expires_at: string;
};

type MatchResult = {
  job_id: string;
  company: string;
  title: string;
  location: string;
  pay_ranges: Array<{
    min_cents?: number;
    max_cents?: number;
    currency_type?: string;
    title?: string;
    blurb?: string;
  }>;
  score: number;
  tier: string;
  reasons: string[];
  missing_skills: string[];
  apply_url: string;
};

type SelectionResponse = {
  accepted_job_ids: string[];
  rejected_job_ids: string[];
  remaining_daily_quota: number;
};

type ApplyResult = {
  cover_letter_text: string | null;
  apply_url: string;
};

type SubscriptionStatus = {
  plan: string;
  status: string;
};

type MatchFilters = {
  title_terms: string[];
  location_pref: string | null;
  work_mode: string | null;
  pay_range: string | null;
};

function normalizePhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

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

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  // Reusable card component for the landing page feature grid.
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

export default function HomePage() {
  const [uploading, setUploading] = useState(false);
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(
    null
  );
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [hasLoadedMatches, setHasLoadedMatches] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [filterTitleTerms, setFilterTitleTerms] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("either");
  const [filterPayRange, setFilterPayRange] = useState("any");
  const [activeFilters, setActiveFilters] = useState<MatchFilters | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [selectionResult, setSelectionResult] =
    useState<SelectionResponse | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [applyResults, setApplyResults] = useState<
    Record<string, ApplyResult | null>
  >({});
  const [applyTone, setApplyTone] = useState("concise");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const matchesPageSize = 25;

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    // Submit the resume file to the backend and store the parsed output.
    event.preventDefault();
    setUploading(true);
    setErrorMessage(null);
    setMatches([]);
    setMatchesError(null);
    setHasLoadedMatches(false);
    setActiveFilters(null);
    setFilterTitleTerms("");
    setFilterLocation("");
    setFilterWorkMode("either");
    setFilterPayRange("any");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(`${apiBase}/api/resume/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Upload failed.");
      }

      const data = (await response.json()) as SessionProfile;
      console.log(data);
      setSessionProfile(data);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("session_id", data.session_id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected upload error."
      );
    } finally {
      setUploading(false);
    }
  };

  const fetchMatches = async (page: number, filters: MatchFilters | null) => {
    // Fetch ranked matches for the current session.
    if (!sessionProfile) return;

    setLoadingMatches(true);
    setMatchesError(null);
    console.log(sessionProfile);
    try {
      const response = await fetch(`${apiBase}/api/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          page,
          filters,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to load matches.");
      }
      const data = (await response.json()) as {
        matches: MatchResult[];
        page: number;
        page_size: number;
        total: number;
        title_terms?: string[];
      };
      console.log(data);
      setMatches(data.matches);
      setMatchesPage(data.page);
      setMatchesTotal(data.total);
      setHasLoadedMatches(true);
      const titleTerms = data.title_terms ?? [];
      if (titleTerms.length > 0) {
        setFilterTitleTerms((current) =>
          current.trim().length > 0 ? current : titleTerms.join(", ")
        );
      }
    } catch (error) {
      setMatchesError(
        error instanceof Error ? error.message : "Unexpected match error."
      );
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleFetchMatches = async () => {
    setMatchesPage(1);
    await fetchMatches(1, activeFilters);
  };

  const handleApplyFilters = async () => {
    const titleTerms = filterTitleTerms
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
    const payload: MatchFilters = {
      title_terms: titleTerms,
      location_pref: filterLocation || null,
      work_mode: filterWorkMode || null,
      pay_range: filterPayRange || null,
    };
    setActiveFilters(payload);
    setMatchesPage(1);
    await fetchMatches(1, payload);
  };

  const toggleJobSelection = (jobId: string) => {
    // Track which jobs the user wants to apply to.
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleSaveSelections = async () => {
    // Persist selections and enforce the free-tier daily quota.
    if (!sessionProfile || selectedJobs.length === 0) return;

    setSelectionError(null);
    setSelectionResult(null);

    try {
      const response = await fetch(`${apiBase}/api/jobs/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionProfile.session_id,
          job_ids: selectedJobs,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Selection failed.");
      }

      const data = (await response.json()) as SelectionResponse;
      setSelectionResult(data);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Unexpected selection error."
      );
    }
  };

  const handleFetchSubscription = async () => {
    // Check subscription status for the current session.
    if (!sessionProfile) return;
    const response = await fetch(
      `${apiBase}/api/subscription/status?session_id=${sessionProfile.session_id}`
    );
    if (response.ok) {
      const data = (await response.json()) as SubscriptionStatus;
      setSubscriptionStatus(data);
    }
  };

  const handleSimulatePro = async () => {
    // Simulate Stripe webhook to mark the session as Pro in dev.
    if (!sessionProfile) return;
    console.log(apiBase)
    await fetch(`${apiBase}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionProfile.session_id,
        plan: "monthly",
      }),
    });
    await handleFetchSubscription();
  };

  const handlePrepareApply = async (jobId: string) => {
    // Request cover letter or apply URL depending on subscription.
    if (!sessionProfile) return;

    const response = await fetch(`${apiBase}/api/apply/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionProfile.session_id,
        job_id: jobId,
        cover_letter_tone: applyTone,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ApplyResult;
    setApplyResults((prev) => ({ ...prev, [jobId]: data }));
  };

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

  // MVP landing page with upload CTA and pricing summary.
  return (
    <main className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Job Finder MVP
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Upload your resume, get ranked matches, and apply faster.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          No account required. See transparent match tiers and understand why a
          job fits or what is missing.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-lg bg-emerald-500 px-5 py-2 font-medium text-slate-950"
            type="button"
          >
            Upload resume
          </button>
          <button className="rounded-lg border border-slate-700 px-5 py-2 font-medium text-slate-100">
            View sample matches
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Explainable matching"
          description="See why a role is a strong, medium, or weak fit with clear reasoning."
        />
        <FeatureCard
          title="Fast assisted apply"
          description="Generate a tailored cover letter on Pro and open the employer link."
        />
        <FeatureCard
          title="Privacy-first"
          description="We assist you. You submit. No credential storage or automation."
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Resume upload</h2>
        <p className="mt-2 text-sm text-slate-300">
          Upload a PDF or DOCX to create a temporary session profile (24-hour
          TTL).
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleUpload}>
          <div>
            <label className="text-sm text-slate-300">Resume file</label>
            <input
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              required
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </div>

          <button
            className="rounded-lg bg-emerald-500 px-5 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
            type="submit"
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload and parse"}
          </button>
        </form>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {sessionProfile ? (
          <div className="mt-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
            <div>
              <span className="font-semibold text-white">Session ID:</span>{" "}
              {sessionProfile.session_id}
            </div>
            <div>
              <span className="font-semibold text-white">LLM summary:</span>{" "}
              {sessionProfile.llm_summary ?? "No summary returned."}
            </div>
            <div>
              <span className="font-semibold text-white">Skills:</span>{" "}
              {sessionProfile.extracted_skills.join(", ")}
            </div>
            <div>
              <span className="font-semibold text-white">Titles:</span>{" "}
              {sessionProfile.inferred_titles.join(", ")}
            </div>
            <div>
              <span className="font-semibold text-white">Seniority:</span>{" "}
              {sessionProfile.seniority}
            </div>
            <div>
              <span className="font-semibold text-white">Years:</span>{" "}
              {sessionProfile.years_experience}
            </div>
            <div>
              <span className="font-semibold text-white">Stored file:</span>{" "}
              {sessionProfile.resume_s3_key ?? "Local dev storage"}
            </div>
            {sessionProfile.first_name || sessionProfile.last_name ? (
              <div>
                <span className="font-semibold text-white">Name:</span>{" "}
                {[sessionProfile.first_name, sessionProfile.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </div>
            ) : null}
            {sessionProfile.email ? (
              <div>
                <span className="font-semibold text-white">Email:</span>{" "}
                {sessionProfile.email}
              </div>
            ) : null}
            {sessionProfile.phone ? (
              <div>
                <span className="font-semibold text-white">Phone:</span>{" "}
                {normalizePhone(sessionProfile.phone)}
              </div>
            ) : null}
            {sessionProfile.location ? (
              <div>
                <span className="font-semibold text-white">Location:</span>{" "}
                {sessionProfile.location}
              </div>
            ) : null}
            {sessionProfile.social_links &&
            sessionProfile.social_links.length > 0 ? (
              <div>
                <span className="font-semibold text-white">Social links:</span>{" "}
                {sessionProfile.social_links.join(", ")}
              </div>
            ) : null}
          <button
            className="mt-2 w-fit rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
            type="button"
            onClick={handleFetchMatches}
            disabled={loadingMatches}
          >
            {loadingMatches ? "Loading matches..." : "Load matches"}
          </button>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
                type="button"
                onClick={handleFetchSubscription}
              >
                Refresh subscription status
              </button>
              <button
                className="rounded-lg border border-emerald-500/40 px-4 py-2 text-xs text-emerald-200"
                type="button"
                onClick={handleSimulatePro}
              >
                Simulate Pro upgrade
              </button>
              {subscriptionStatus ? (
                <span className="text-xs text-slate-400">
                  Plan: {subscriptionStatus.plan} • Status:{" "}
                  {subscriptionStatus.status}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

      {matchesError ? (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {matchesError}
        </div>
      ) : null}

      {hasLoadedMatches ? (
        <div className="mt-6 space-y-3">
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
            <span>Page {matchesPage} of {totalPages}</span>
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
                onClick={handleApplyFilters}
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
                  onChange={(event) => setFilterTitleTerms(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Location</label>
                <input
                  type="text"
                  placeholder="Austin, NYC"
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterLocation}
                  onChange={(event) => setFilterLocation(event.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Work mode</label>
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  value={filterWorkMode}
                  onChange={(event) => setFilterWorkMode(event.target.value)}
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
                  onChange={(event) => setFilterPayRange(event.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="with">Only with pay range</option>
                  <option value="without">Only without pay range</option>
                </select>
              </div>
            </div>
          </div>

          {matches.length > 0 ? (
            <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <div>
              <p className="font-semibold text-white">Select jobs to apply</p>
              <p className="text-xs text-slate-400">
                Free tier: up to 5 selections/day.
              </p>
            </div>
            <button
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950"
              type="button"
              onClick={handleSaveSelections}
              disabled={selectedJobs.length === 0}
            >
              Save selections
            </button>
          </div>

          {selectionError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {selectionError}
            </div>
          ) : null}

          {selectionResult ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
              <p>
                Accepted: {selectionResult.accepted_job_ids.join(", ") || "None"}
              </p>
              <p>
                Rejected: {selectionResult.rejected_job_ids.join(", ") || "None"}
              </p>
              <p>Remaining quota: {selectionResult.remaining_daily_quota}</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <div
                key={match.job_id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"
              >
                <label className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(match.job_id)}
                    onChange={() => toggleJobSelection(match.job_id)}
                  />
                  Select for apply
                </label>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {match.title}
                    </p>
                    <p className="text-sm text-slate-400">{match.company}</p>
                  </div>
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
                        <div key={`${match.job_id}-range-${index}`} className="mt-2">
                         {range.title ? <p className="text-xs">{range.title}</p> : null}
                         {min !== null && max !== null ? <p className="font-bold text-md">{min.toLocaleString()}–{max.toLocaleString()} {currency}</p> : null}
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
                    onChange={(event) => setApplyTone(event.target.value)}
                  >
                    <option value="formal">Formal</option>
                    <option value="concise">Concise</option>
                    <option value="technical">Technical</option>
                  </select>
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                    type="button"
                    onClick={() => handlePrepareApply(match.job_id)}
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
                    href="/apply"
                  >
                    Go to Apply page →
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
                        fetchMatches(matchesPage - 1, activeFilters);
                      }
                    }}
                    className={matchesPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {matchesPage > 3 ? (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          fetchMatches(1, activeFilters);
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
                        fetchMatches(page, activeFilters);
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
                          fetchMatches(totalPages, activeFilters);
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
                        fetchMatches(matchesPage + 1, activeFilters);
                      }
                    }}
                    className={matchesPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Pricing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Free</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Up to 5 job selections per day</li>
              <li>Match tiers + reasons</li>
              <li>No cover letter generation</li>
            </ul>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Pro</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>Unlimited job selections</li>
              <li>Cover letter generation (tone selectable)</li>
              <li>Saved application history</li>
              <li>$15/month or $29 for 30 days</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
