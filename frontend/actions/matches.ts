'use server';

import type { MatchFilters, MatchResult } from '../type';
import { getBackendUrl, getBackendHeaders } from '../lib/backendClient';

export type FetchMatchesResponse = {
  matches: MatchResult[];
  page: number;
  page_size: number;
  total: number;
  title_terms?: string[];
};

export async function fetchMatches(
  sessionId: string,
  page: number,
  filters: MatchFilters | null
): Promise<FetchMatchesResponse> {
  const response = await fetch(getBackendUrl('/api/matches'), {
    method: 'POST',
    headers: getBackendHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      page,
      filters,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load matches.');
  }

  return response.json() as Promise<FetchMatchesResponse>;
}
