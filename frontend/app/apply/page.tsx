"use client";

import { useEffect, useState } from "react";

type ApplyResult = {
  cover_letter_text: string | null;
  apply_url: string;
};

type MatchResult = {
  job_id: string;
  company: string;
  title: string;
  location: string;
  score: number;
  tier: string;
  reasons: string[];
  missing_skills: string[];
  apply_url: string;
};

export default function ApplyPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [applyResults, setApplyResults] = useState<
    Record<string, ApplyResult | null>
  >({});
  const [tone, setTone] = useState("concise");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  useEffect(() => {
    // Load session id from local storage when available.
    const storedSession = window.localStorage.getItem("session_id");
    if (storedSession) {
      setSessionId(storedSession);
    }
  }, []);

  const loadSelectedJobs = async () => {
    // Fetch job IDs that the user previously selected.
    if (!sessionId) return;

    const response = await fetch(
      `${apiBase}/api/jobs/selected?session_id=${sessionId}`
    );
    if (!response.ok) return;
    const data = (await response.json()) as { job_ids: string[] };
    setSelectedJobs(data.job_ids);
  };

  const loadMatches = async () => {
    // Pull job details for the selected IDs by reusing matches endpoint.
    if (!sessionId) return;

    const response = await fetch(
      `${apiBase}/api/matches?session_id=${sessionId}`
    );
    if (!response.ok) return;
    const data = (await response.json()) as { matches: MatchResult[] };
    setMatches(data.matches);
  };

  const prepareApply = async (jobId: string) => {
    // Generate a cover letter or apply link for the selected job.
    if (!sessionId) return;

    const response = await fetch(`${apiBase}/api/apply/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        job_id: jobId,
        cover_letter_tone: tone,
      }),
    });

    if (!response.ok) return;
    const data = (await response.json()) as ApplyResult;
    setApplyResults((prev) => ({ ...prev, [jobId]: data }));
  };

  const jobsToApply = matches.filter((match) =>
    selectedJobs.includes(match.job_id)
  );

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-semibold text-white">Assisted apply</h1>
        <p className="mt-2 text-sm text-slate-300">
          Load your selected jobs and prepare application materials. Manual
          submission only.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            placeholder="Session ID"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
          />
          <button
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
            onClick={loadSelectedJobs}
            type="button"
          >
            Load selections
          </button>
          <button
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-100"
            onClick={loadMatches}
            type="button"
          >
            Load matches
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Tone</span>
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            >
              <option value="formal">Formal</option>
              <option value="concise">Concise</option>
              <option value="technical">Technical</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {jobsToApply.map((job) => (
          <div
            key={job.job_id}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"
          >
            <p className="text-base font-semibold text-white">{job.title}</p>
            <p className="text-xs text-slate-400">{job.company}</p>
            <p className="mt-2 text-xs text-slate-400">{job.location}</p>
            <button
              className="mt-4 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
              onClick={() => prepareApply(job.job_id)}
              type="button"
            >
              Prepare application
            </button>
            {applyResults[job.job_id] ? (
              <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                <p className="font-semibold text-white">Prepared output</p>
                <p className="mt-2 whitespace-pre-line text-slate-300">
                  {applyResults[job.job_id]?.cover_letter_text ??
                    "Cover letter available on Pro only."}
                </p>
                <a
                  className="mt-3 inline-flex text-xs font-semibold text-emerald-300"
                  href={applyResults[job.job_id]?.apply_url ?? job.apply_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open application link →
                </a>
              </div>
            ) : null}
          </div>
        ))}
        {jobsToApply.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No selected jobs found. Load selections or matches to begin.
          </div>
        ) : null}
      </section>
    </main>
  );
}
