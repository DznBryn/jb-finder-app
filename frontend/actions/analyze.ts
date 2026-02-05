'use server';

import type { AnalyzeResult, DeepAnalyzeResponse } from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export type AnalyzeJobsResponse = {
  results: AnalyzeResult[];
  best_match_job_id?: string | null;
};

export async function analyzeJobs(
  sessionId: string,
  jobIds: string[]
): Promise<AnalyzeJobsResponse> {
  const response = await fetch(`${apiBase}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_ids: jobIds,
    }),
  });

  if (response.status === 402) {
    const detail = await response.json().catch(() => ({})) as { required?: number; available?: number };
    throw new Error(
      JSON.stringify({ code: 'PAYMENT_REQUIRED', required: detail.required, available: detail.available })
    );
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Analysis failed.');
  }

  return response.json() as Promise<AnalyzeJobsResponse>;
}

export async function getDeepAnalysis(
  sessionId: string,
  jobId: string
): Promise<DeepAnalyzeResponse | null> {
  const response = await fetch(
    `${apiBase}/api/analyze/deep?session_id=${sessionId}&job_id=${jobId}`
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<DeepAnalyzeResponse>;
}

export async function runDeepAnalysis(
  sessionId: string,
  jobId: string
): Promise<DeepAnalyzeResponse> {
  const response = await fetch(`${apiBase}/api/analyze/deep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
    }),
  });

  if (response.status === 402) {
    const data = await response.json().catch(() => ({})) as {
      detail?: { required?: number; available?: number };
      required?: number;
      available?: number;
    };
    const detail = data.detail ?? data;
    throw new Error(
      JSON.stringify({ code: 'PAYMENT_REQUIRED', required: detail.required, available: detail.available })
    );
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Deep analysis failed.');
  }

  return response.json() as Promise<DeepAnalyzeResponse>;
}
