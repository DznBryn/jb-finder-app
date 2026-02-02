'use server';

import type { GreenhouseJob, SelectionResponse, SelectedJob } from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function getJobDetails(jobId: string): Promise<GreenhouseJob> {
  const response = await fetch(
    `${apiBase}/api/greenhouse/job?job_id=${jobId}`
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load job details.');
  }

  return response.json() as Promise<GreenhouseJob>;
}

export async function selectJobs(
  sessionId: string,
  jobIds: string[]
): Promise<SelectionResponse> {
  const response = await fetch(`${apiBase}/api/jobs/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_ids: jobIds,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Selection failed.');
  }

  return response.json() as Promise<SelectionResponse>;
}

export type SelectedJobsResponse = {
  jobs: SelectedJob[];
};

export async function getSelectedJobDetails(
  sessionId: string
): Promise<SelectedJobsResponse> {
  const response = await fetch(
    `${apiBase}/api/jobs/selected/details?session_id=${sessionId}`
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load selected jobs.');
  }

  return response.json() as Promise<SelectedJobsResponse>;
}
