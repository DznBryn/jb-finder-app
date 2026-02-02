'use server';

import type { SessionProfile } from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export async function getSessionProfile(
  sessionId: string
): Promise<SessionProfile | null> {
  const response = await fetch(
    `${apiBase}/api/session/profile?session_id=${sessionId}`
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<SessionProfile>;
}

export async function convertSession(sessionId: string): Promise<boolean> {
  const response = await fetch('/api/auth/convert-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });

  return response.ok;
}
