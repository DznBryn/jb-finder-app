"use client";

import type { UploadResumeProps } from "@/type";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
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

  return (
    <section
      className={
        isLanding
          ? "flex w-full max-w-2xl flex-col items-center gap-4 text-center"
          : "w-full  rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-3"
      }
    >
      {!isLanding && (
        <p className=" text-sm text-slate-300">
          Upload a PDF or DOCX of your resume
        </p>
      )}

      <form className="w-full space-y-4" onSubmit={onUpload}>
        <Field>
          <ButtonGroup className="w-full">
            <Input
              id={INPUT_ID}
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              required
              disabled={uploading}
              className="min-w-24 w-full py-0 min-h-12 file:min-h-12 px-0 overflow-hidden file:mr-2 file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-200 file:hover:bg-slate-600 disabled:opacity-60 disabled:pointer-events-none"
            />
            <Button
              className="min-h-12 bg-emerald-500 text-slate-950 hover:bg-slate-900 disabled:bg-slate-700"
              variant="outline" type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Spinner className="size-4 shrink-0" />
                  Parsing…
                </>
              ) : isLanding ? (
                "Upload Resume"
              ) : (
                "Upload and parse"
              )}
            </Button>
          </ButtonGroup>
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
        <div
          className={
            isLanding
              ? "mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              : "rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
          }
        >
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
