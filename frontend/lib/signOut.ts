'use client';
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useUserResumeStore } from "@/lib/userResumeStore";


/**
 * Clear all client-side session and storage before signing out.
 * Call this immediately before signOut() so the next page load has no leftover data.
 */
export function clearSessionAndStorage(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Ignore private mode or quota errors
  }

  useUserBaseStore.getState().setUserBase(null);
  useUserResumeStore.getState().setResumes([]);
  useUserResumeStore.getState().setLastResumeId(null);
  useCheckoutModalStore.getState().close();
}
