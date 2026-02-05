import type { UserResume, UserResumesPayload } from "@/type";

/**
 * Merge flattened API response into full UserResume[] (attach shared saved_jobs, analyzed_jobs, cover_letters to each resume).
 */
export function normalizeResumesPayload(payload: UserResumesPayload): UserResume[] {
  const { resumes, saved_jobs, analyzed_jobs, cover_letters } = payload;
  if (!Array.isArray(resumes)) return [];
  return resumes.map((r) => ({
    ...r,
    saved_jobs: saved_jobs ?? [],
    analyzed_jobs: analyzed_jobs ?? [],
    cover_letters: cover_letters ?? [],
  }));
}
