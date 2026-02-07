"use client";

import type { UploadResumeProps } from "@/type";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const INPUT_ID = "resume-upload";

export default function UploadResume({
  uploading,
  errorMessage,
  sessionProfile,
  onUpload,
  variant = "default",
}: UploadResumeProps) {
  const isLanding = variant === "landing";

  const submitLabel = uploading
    ? "Parsing…"
    : isLanding
      ? "Upload Resume"
      : "Upload and parse";

  const sectionClass = isLanding
    ? "flex w-full max-w-2xl flex-col items-center gap-4 text-center"
    : "w-full rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col gap-3 p-4 md:p-6";

  const errorClass = isLanding
    ? "mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    : "rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200";

  const fileInputClass =
    "min-w-0 w-full py-0 min-h-12 file:min-h-12 px-0 overflow-hidden file:mr-2 file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-200 file:hover:bg-slate-600 disabled:opacity-60 disabled:pointer-events-none";
  const submitButtonClass =
    "min-h-12 bg-emerald-500 text-slate-950 hover:bg-slate-900 disabled:bg-slate-700";

  return (
    <section className={sectionClass}>
      {!isLanding && (
        <p className="text-sm text-slate-300">
          Upload a PDF or DOCX of your resume
        </p>
      )}

      <form className="w-full space-y-4" onSubmit={onUpload}>
        <Field>
          {/* Mobile (< md): stacked, full-width. Desktop (md+): horizontal group. Single input/button for correct submit. */}
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-stretch md:gap-0 [&>*:first-child]:md:flex-1 [&>*:first-child]:md:rounded-r-none [&>*:last-child]:md:rounded-l-none [&>*:last-child]:md:border-l-0">
            <Input
              id={INPUT_ID}
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              required
              disabled={uploading}
              className={fileInputClass}
            />
            <Button
              type="submit"
              disabled={uploading}
              variant="outline"
              className={`w-full md:w-fit ${submitButtonClass}`}
            >
              {uploading ? (
                <>
                  <Spinner className="size-4 shrink-0" />
                  {submitLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </Field>

        {sessionProfile?.resume_s3_key && !isLanding ? (
          <p className="text-xs text-slate-400">
            Stored:{" "}
            {sessionProfile.resume_s3_key.split("/").pop() ??
              sessionProfile.resume_s3_key}
          </p>
        ) : null}
      </form>

      {errorMessage ? (
        <div className={errorClass}>
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
