"use client";

import type { UploadResumeProps } from "../type";

function normalizePhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export default function UploadResume({
  uploading,
  errorMessage,
  sessionProfile,
  onUpload,
}: UploadResumeProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold text-white">Resume upload</h2>
      <p className="mt-2 text-sm text-slate-300">
        Upload a PDF or DOCX of your resume
      </p>

      <form className="mt-4 space-y-4" onSubmit={onUpload}>
        <div>
          <label className="text-sm text-slate-300">Resume file</label>
          <input
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            required
            className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
          {sessionProfile?.resume_s3_key ? (
            <p className="mt-2 text-xs text-slate-400">
              Stored file:{" "}
              {sessionProfile.resume_s3_key.split("/").pop() ??
                sessionProfile.resume_s3_key}
            </p>
          ) : null}
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
        </div>
      ) : null}
    </section>
  );
}
