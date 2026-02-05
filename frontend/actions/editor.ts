'use server';

import type {
  CoverLetterDocumentResponse,
  CoverLetterSuggestResponse,
} from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function loadDocument(
  sessionId: string,
  jobId: string
): Promise<CoverLetterDocumentResponse> {
  const response = await fetch(
    `${apiBase}/api/editor/document?session_id=${sessionId}&job_id=${jobId}`
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load cover letter draft.');
  }

  return response.json() as Promise<CoverLetterDocumentResponse>;
}

export type SaveDraftResponse = {
  draft_hash: string;
};

export async function saveDraft(
  sessionId: string,
  jobId: string,
  content: string,
  baseHash: string | null
): Promise<SaveDraftResponse> {
  const response = await fetch(`${apiBase}/api/editor/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
      content,
      base_hash: baseHash,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to save draft.');
  }

  return response.json() as Promise<SaveDraftResponse>;
}

export async function suggestContent(
  sessionId: string,
  jobId: string,
  content: string,
  intent: string,
  baseHash: string | null
): Promise<CoverLetterSuggestResponse> {
  const response = await fetch(`${apiBase}/api/editor/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
      content,
      intent,
      base_hash: baseHash,
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
    throw new Error(detail || 'Failed to generate suggestion.');
  }

  return response.json() as Promise<CoverLetterSuggestResponse>;
}

export async function saveVersion(
  sessionId: string,
  jobId: string,
  content: string,
  intent: string,
  baseHash: string | null
): Promise<void> {
  const response = await fetch(`${apiBase}/api/editor/version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      job_id: jobId,
      content,
      intent,
      base_hash: baseHash,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to save version.');
  }
}
