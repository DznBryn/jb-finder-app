'use server';

import type { MatchFilters, MatchResult } from '../type';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

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
  const response = await fetch(`${apiBase}/api/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
