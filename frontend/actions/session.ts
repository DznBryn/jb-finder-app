'use server';

import type { SessionProfile } from '../type';
import { getBackendUrl, getBackendHeaders } from '../lib/backendClient';

export async function getSessionProfile(
  sessionId: string
): Promise<SessionProfile | null> {
  const response = await fetch(
    `${getBackendUrl('/api/session/profile')}?session_id=${sessionId}`,
    { headers: getBackendHeaders(false) }
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
