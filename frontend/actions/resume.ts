'use server';

import type {
  SessionProfile,
  ResumeTextResponse,
  ResumeReviewResponse,
} from '../type';
import { getBackendUrl, getBackendHeaders, getBackendHeadersForm } from '../lib/backendClient';

export async function uploadResume(
  formData: FormData,
  sessionId?: string | null
): Promise<SessionProfile> {
  if (sessionId) {
    formData.set('session_id', sessionId);
  }
  const response = await fetch(getBackendUrl('/api/resume/upload'), {
    method: 'POST',
    headers: getBackendHeadersForm(),
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Upload failed.');
  }

  return response.json() as Promise<SessionProfile>;
}

export async function getResumeText(
  sessionId: string
): Promise<ResumeTextResponse> {
  const response = await fetch(
    `${getBackendUrl('/api/session/resume')}?session_id=${sessionId}`,
    { headers: getBackendHeaders(false) }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load resume text.');
  }

  return response.json() as Promise<ResumeTextResponse>;
}

export async function reviewResume(
  sessionId: string,
  jobId: string
): Promise<ResumeReviewResponse> {
  const response = await fetch(getBackendUrl('/api/resume/review'), {
    method: 'POST',
    headers: getBackendHeaders(),
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
    throw new Error(detail || 'Resume review failed.');
  }

  return response.json() as Promise<ResumeReviewResponse>;
}
