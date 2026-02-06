'use client';
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useUserResumeStore } from "@/lib/userResumeStore";

/** NextAuth session cookie names (dev and prod). */
const NEXT_AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function clearSessionCookies(): void {
  if (typeof document === "undefined") return;
  const past = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const name of NEXT_AUTH_COOKIE_NAMES) {
    document.cookie = `${name}=; path=/; expires=${past}`;
  }
}

/**
 * Clear all client-side session and storage before signing out.
 * Clears NextAuth session cookies, localStorage, sessionStorage, and Zustand state.
 * Call this immediately before signOut() so the next page load has no leftover data.
 */
export function clearSessionAndStorage(): void {
  if (typeof window === "undefined") return;

  clearSessionCookies();

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
