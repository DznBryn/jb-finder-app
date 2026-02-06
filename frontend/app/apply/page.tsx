"use client";

import { useEffect, useState } from "react";
import { useSession } from "../session-context";
import type {
  ApplyResult,
  GreenhouseField,
  GreenhouseFieldValue,
  GreenhouseJob,
  GreenhouseQuestion,
  JobFormState,
  SelectedJob,
  SessionProfile,
} from "../../type";

function normalizePhone(phone: string | null) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function buildComplianceKeys(job: GreenhouseJob | undefined) {
  const keys = new Set<string>();
  job?.data_compliance?.forEach((item) => {
    if (item.requires_consent) keys.add("gdpr_consent_given");
    if (item.requires_processing_consent) keys.add("gdpr_processing_consent_given");
    if (item.requires_retention_consent) keys.add("gdpr_retention_consent_given");
  });
  if (job?.demographic_questions) {
    keys.add("gdpr_demographic_data_consent_given");
  }
  return Array.from(keys);
}

function initFormState(job: GreenhouseJob, profile: SessionProfile | null): JobFormState {
  const fields: Record<string, string | string[] | null> = {};
  fields.first_name = profile?.first_name ?? "";
  fields.last_name = profile?.last_name ?? "";
  fields.email = profile?.email ?? "";
  fields.phone = normalizePhone(profile?.phone ?? null);
  fields.location = profile?.location ?? "";
  const allQuestions = [
    ...(job.questions ?? []),
    ...(job.location_questions ?? []),
  ];
  allQuestions.forEach((question) => {
    question.fields.forEach((field) => {
      if (fields[field.name] !== undefined) return;
      if (field.type === "multi_value_multi_select") {
        fields[field.name] = [];
      } else {
        fields[field.name] = "";
      }
    });
  });
  const compliance: Record<string, boolean> = {};
  buildComplianceKeys(job).forEach((key) => {
    compliance[key] = false;
  });
  const demographics: JobFormState["demographics"] = {};
  job.demographic_questions?.questions?.forEach((question) => {
    demographics[String(question.id)] = {
      selected: question.type === "multi_value_multi_select" ? [] : null,
      text: "",
    };
  });
  return { fields, compliance, demographics };
}

export default function ApplyPage() {
  const {
    sessionProfile,
    setSessionProfile,
    setSelectedJobs,
  } = useSession();
  const [sessionId, setSessionId] = useState<string>("");
  const [jobs, setJobs] = useState<SelectedJob[]>([]);
  const [jobForms, setJobForms] = useState<Record<string, GreenhouseJob>>({});
  const [formState, setFormState] = useState<Record<string, JobFormState>>({});
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [submitState, setSubmitState] = useState<
    Record<string, { status: "idle" | "submitting" | "success" | "error"; message?: string }>
  >({});
  const [applyResults, setApplyResults] = useState<
    Record<string, ApplyResult | null>
  >({});
  const [tone, setTone] = useState("concise");

  useEffect(() => {
    if (sessionProfile?.session_id) {
      setSessionId(sessionProfile.session_id);
      return;
    }
    const storedSession = window.localStorage.getItem("session_id");
    if (storedSession) {
      setSessionId(storedSession);
    }
  }, [sessionProfile?.session_id]);

  useEffect(() => {
    if (!sessionId) return;
    if (!sessionProfile) {
      fetch(`/api/session/profile?session_id=${sessionId}`)
        .then((response) =>
          response.ok ? (response.json() as Promise<SessionProfile>) : null
        )
        .then((data) => {
          if (data) setSessionProfile(data);
        })
        .catch(() => {});
    }
  }, [sessionId, sessionProfile, setSessionProfile]);

  const loadSelectedJobs = async () => {
    if (!sessionId) return;
    setLoadingJobs(true);
    try {
      const response = await fetch(
        `/api/jobs/selected/details?session_id=${sessionId}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as { jobs: SelectedJob[] };
      setJobs(data.jobs);
      setSelectedJobs(data.jobs.map((job) => job.job_id));
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadSelectedJobs();
  }, [sessionId]);

  const loadGreenhouseForms = async (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    setLoadingForms(true);
    try {
      const responses = await Promise.all(
        jobIds.map(async (jobId) => {
          const response = await fetch(
            `/api/greenhouse/job?job_id=${jobId}`
          );
          if (!response.ok) return { jobId, data: null };
          const data = (await response.json()) as GreenhouseJob;
          return { jobId, data };
        })
      );
      const nextForms: Record<string, GreenhouseJob> = {};
      const nextState: Record<string, JobFormState> = { ...formState };
      responses.forEach(({ jobId, data }) => {
        if (!data) return;
        nextForms[jobId] = data;
        if (!nextState[jobId]) {
          nextState[jobId] = initFormState(data, sessionProfile);
        }
      });
      setJobForms((prev) => ({ ...prev, ...nextForms }));
      setFormState(nextState);
    } finally {
      setLoadingForms(false);
    }
  };

  useEffect(() => {
    if (jobs.length === 0) return;
    const activeJobs = jobs.filter((job) => job.is_active !== false);
    loadGreenhouseForms(activeJobs.map((job) => job.job_id));
  }, [jobs]);


  const handleFieldChange = (
    jobId: string,
    fieldName: string,
    value: string | string[] | null
  ) => {
    setFormState((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        fields: {
          ...prev[jobId]?.fields,
          [fieldName]: value,
        },
      },
    }));
  };

  const handleComplianceChange = (jobId: string, key: string, checked: boolean) => {
    setFormState((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        compliance: {
          ...prev[jobId]?.compliance,
          [key]: checked,
        },
      },
    }));
  };

  const handleDemographicChange = (
    jobId: string,
    questionId: string,
    value: number | number[] | null,
    text?: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        demographics: {
          ...prev[jobId]?.demographics,
          [questionId]: {
            ...prev[jobId]?.demographics?.[questionId],
            selected: value,
            text: text ?? prev[jobId]?.demographics?.[questionId]?.text,
          },
        },
      },
    }));
  };

  const buildDemographicAnswers = (jobId: string, job: GreenhouseJob) => {
    const answers: Array<{ question_id: number; answer_options: Array<{ answer_option_id: number; text?: string }> }> = [];
    const stored = formState[jobId]?.demographics ?? {};
    job.demographic_questions?.questions?.forEach((question) => {
      const entry = stored[String(question.id)];
      if (!entry) return;
      const selected = entry.selected;
      const answerOptions: Array<{ answer_option_id: number; text?: string }> = [];
      if (Array.isArray(selected)) {
        selected.forEach((id) => {
          if (typeof id === "number") {
            const option = question.answer_options.find((opt) => opt.id === id);
            if (option?.free_form) {
              answerOptions.push({ answer_option_id: id, text: entry.text || "" });
            } else {
              answerOptions.push({ answer_option_id: id });
            }
          }
        });
      } else if (typeof selected === "number") {
        const option = question.answer_options.find((opt) => opt.id === selected);
        if (option?.free_form) {
          answerOptions.push({ answer_option_id: selected, text: entry.text || "" });
        } else {
          answerOptions.push({ answer_option_id: selected });
        }
      }
      if (answerOptions.length > 0) {
        answers.push({ question_id: question.id, answer_options: answerOptions });
      }
    });
    return answers.length > 0 ? answers : null;
  };

  const submitApplication = async (jobId: string) => {
    if (!sessionId) return;
    const job = jobForms[jobId];
    const current = formState[jobId];
    if (!current) return;
    setSubmitState((prev) => ({
      ...prev,
      [jobId]: { status: "submitting" },
    }));
    try {
      const demographic_answers = job
        ? buildDemographicAnswers(jobId, job)
        : null;
      const response = await fetch("/api/greenhouse/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
          fields: current.fields,
          data_compliance: current.compliance,
          demographic_answers,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Application failed.");
      }
      setSubmitState((prev) => ({
        ...prev,
        [jobId]: { status: "success" },
      }));
    } catch (error) {
      setSubmitState((prev) => ({
        ...prev,
        [jobId]: {
          status: "error",
          message: error instanceof Error ? error.message : "Submit failed.",
        },
      }));
    }
  };

  const prepareApply = async (jobId: string) => {
    if (!sessionId) return;
    const response = await fetch("/api/apply/prepare", {
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

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-semibold text-white">Assisted apply</h1>
        <p className="mt-2 text-sm text-slate-300">
          Review your selected jobs, fill in Greenhouse forms, and submit. Manual
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
            disabled={loadingJobs}
          >
            {loadingJobs ? "Loading..." : "Load selections"}
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
        {jobs.map((job) => {
          const form = formState[job.job_id];
          const greenhouse = jobForms[job.job_id];
          const complianceKeys = buildComplianceKeys(greenhouse);
          const isInactive = job.is_active === false;
          return (
            <div
              key={job.job_id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{job.title}</p>
                {job.is_active === false ? (
                  <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                    Inactive
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400">{job.company}</p>
              <p className="mt-2 text-xs text-slate-400">{job.location}</p>
              <p className="mt-2 text-xs text-slate-500">
                Resume text will be submitted from your uploaded resume.
              </p>

              {isInactive ? (
                <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  This job is no longer active. We keep it here for reference.
                </div>
              ) : null}

              {!isInactive && loadingForms && !greenhouse ? (
                <div className="mt-4 text-xs text-slate-400">Loading form...</div>
              ) : null}

              {!isInactive && greenhouse ? (
                <div className="mt-4 space-y-4">
                  {[...(greenhouse.questions ?? []), ...(greenhouse.location_questions ?? [])].map(
                    (question, qIndex) => (
                      <div key={`${job.job_id}-q-${qIndex}`} className="space-y-2">
                        <p className="text-xs font-semibold text-slate-200">
                          {question.label}
                          {question.required ? " *" : ""}
                        </p>
                        {question.fields.map((field) => {
                          const value = form?.fields?.[field.name] ?? "";
                          if (field.type === "multi_value_single_select") {
                            return (
                              <select
                                key={field.name}
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                                value={value as string}
                                onChange={(event) =>
                                  handleFieldChange(job.job_id, field.name, event.target.value)
                                }
                              >
                                <option value="">Select</option>
                                {field.values?.map((option) => (
                                  <option key={option.value} value={String(option.value)}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            );
                          }
                          if (field.type === "multi_value_multi_select") {
                          const selected = Array.isArray(value) ? (value as string[]) : [];
                            return (
                              <div key={field.name} className="space-y-2 text-xs text-slate-300">
                                {field.values?.map((option) => {
                                  const optionValue = String(option.value);
                                  const checked = selected.includes(optionValue);
                                  return (
                                    <label key={option.value} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          const next = event.target.checked
                                            ? [...selected, optionValue]
                                            : selected.filter((item) => item !== optionValue);
                                          handleFieldChange(job.job_id, field.name, next);
                                        }}
                                      />
                                      {option.label}
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          }
                          if (field.type === "textarea") {
                            return (
                              <textarea
                                key={field.name}
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                                value={value as string}
                                onChange={(event) =>
                                  handleFieldChange(job.job_id, field.name, event.target.value)
                                }
                              />
                            );
                          }
                          if (field.type === "input_file") {
                            return (
                              <div key={field.name} className="text-xs text-slate-500">
                                File uploads are not supported yet for {field.name}.
                              </div>
                            );
                          }
                          return (
                            <input
                              key={field.name}
                              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                              value={value as string}
                              onChange={(event) =>
                                handleFieldChange(job.job_id, field.name, event.target.value)
                              }
                            />
                          );
                        })}
                      </div>
                    )
                  )}

                  {complianceKeys.length > 0 ? (
                    <div className="space-y-2 text-xs text-slate-300">
                      <p className="font-semibold text-slate-200">Data compliance</p>
                      {complianceKeys.map((key) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form?.compliance?.[key] ?? false}
                            onChange={(event) =>
                              handleComplianceChange(job.job_id, key, event.target.checked)
                            }
                          />
                          {key}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {greenhouse.demographic_questions?.questions?.length ? (
                    <div className="space-y-3 text-xs text-slate-300">
                      <p className="font-semibold text-slate-200">
                        {greenhouse.demographic_questions.header ??
                          "Demographic questions"}
                      </p>
                      {greenhouse.demographic_questions.questions.map((question) => {
                        const entry = form?.demographics?.[String(question.id)];
                        return (
                          <div key={question.id} className="space-y-2">
                            <p>
                              {question.label}
                              {question.required ? " *" : ""}
                            </p>
                            {question.type === "multi_value_multi_select" ? (
                              <div className="space-y-2">
                                {question.answer_options.map((option) => {
                                  const selected = Array.isArray(entry?.selected)
                                    ? entry?.selected
                                    : [];
                                  const checked = selected.includes(option.id);
                                  return (
                                    <label key={option.id} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          const next = event.target.checked
                                            ? [...selected, option.id]
                                            : selected.filter((id) => id !== option.id);
                                          handleDemographicChange(job.job_id, String(question.id), next);
                                        }}
                                      />
                                      {option.label}
                                    </label>
                                  );
                                })}
                                {question.answer_options.some(
                                  (option) =>
                                    option.free_form &&
                                    Array.isArray(entry?.selected) &&
                                    entry.selected.includes(option.id)
                                ) ? (
                                  <input
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                                    placeholder="Free-form response"
                                    value={entry?.text ?? ""}
                                    onChange={(event) =>
                                      handleDemographicChange(
                                        job.job_id,
                                        String(question.id),
                                        entry?.selected ?? [],
                                        event.target.value
                                      )
                                    }
                                  />
                                ) : null}
                              </div>
                            ) : (
                                <select
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                                value={typeof entry?.selected === "number" ? entry.selected : ""}
                                onChange={(event) =>
                                  handleDemographicChange(
                                    job.job_id,
                                    String(question.id),
                                    event.target.value ? Number(event.target.value) : null
                                  )
                                }
                              >
                                <option value="">Select</option>
                                {question.answer_options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {question.type !== "multi_value_multi_select" &&
                            question.answer_options.some(
                              (option) =>
                                option.free_form &&
                                typeof entry?.selected === "number" &&
                                entry.selected === option.id
                            ) ? (
                              <input
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                                placeholder="Free-form response"
                                value={entry?.text ?? ""}
                                onChange={(event) =>
                                  handleDemographicChange(
                                    job.job_id,
                                    String(question.id),
                                    entry?.selected ?? null,
                                    event.target.value
                                  )
                                }
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <button
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950"
                    type="button"
                    onClick={() => submitApplication(job.job_id)}
                    disabled={
                      isInactive || submitState[job.job_id]?.status === "submitting"
                    }
                  >
                    {submitState[job.job_id]?.status === "submitting"
                      ? "Submitting..."
                      : "Submit application"}
                  </button>
                  {submitState[job.job_id]?.status === "success" ? (
                    <p className="text-xs text-emerald-300">Submitted to Greenhouse.</p>
                  ) : null}
                  {submitState[job.job_id]?.status === "error" ? (
                    <p className="text-xs text-red-300">
                      {submitState[job.job_id]?.message ?? "Submission failed."}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100"
                  onClick={() => prepareApply(job.job_id)}
                  type="button"
                  disabled={isInactive}
                >
                  Prepare cover letter
                </button>
                {applyResults[job.job_id] ? (
                  <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
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
            </div>
          );
        })}
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No selected jobs found. Load selections to begin.
          </div>
        ) : null}
      </section>
    </main>
  );
}
