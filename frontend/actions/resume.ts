'use server';

import type {
  SessionProfile,
  ResumeTextResponse,
  ResumeReviewResponse,
} from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function uploadResume(formData: FormData): Promise<SessionProfile> {
  const response = await fetch(`${apiBase}/api/resume/upload`, {
    method: 'POST',
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
    `${apiBase}/api/session/resume?session_id=${sessionId}`
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
  const response = await fetch(`${apiBase}/api/resume/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Resume review failed.');
  }

  return response.json() as Promise<ResumeReviewResponse>;
}
