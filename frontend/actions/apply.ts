'use server';

import type { ApplyResult, JobFormState } from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function prepareApply(
  sessionId: string,
  jobId: string,
  coverLetterTone: string
): Promise<ApplyResult> {
  const response = await fetch(`${apiBase}/api/apply/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
      cover_letter_tone: coverLetterTone,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to prepare application.');
  }

  return response.json() as Promise<ApplyResult>;
}

export type DemographicAnswer = {
  question_id: number;
  answer_options: Array<{ answer_option_id: number; text?: string }>;
};

export type SubmitApplicationParams = {
  sessionId: string;
  jobId: string;
  fields: JobFormState['fields'];
  dataCompliance: JobFormState['compliance'];
  demographicAnswers: DemographicAnswer[] | null;
};

export async function submitApplication({
  sessionId,
  jobId,
  fields,
  dataCompliance,
  demographicAnswers,
}: SubmitApplicationParams): Promise<void> {
  const response = await fetch(`${apiBase}/api/greenhouse/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
      fields,
      data_compliance: dataCompliance,
      demographic_answers: demographicAnswers,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Application failed.');
  }
}
