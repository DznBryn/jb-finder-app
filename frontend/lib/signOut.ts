"use client";

import { create } from "zustand";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useUserResumeStore } from "@/lib/userResumeStore";


function clearAllCookies(): void {
  if (typeof document === "undefined") return;
  const past = "Thu, 01 Jan 1970 00:00:00 GMT";
  const cookies = document.cookie.split("; ");
  for (const part of cookies) {
    const name = part.split("=")[0];
    if (name) {
      document.cookie = `${name}=; path=/; expires=${past}`;
      document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=${past}`;
    }
  }
}


type SignOutState = {
  signingOut: boolean;
  setSigningOut: (v: boolean) => void;
};

export const useSignOutStore = create<SignOutState>((set) => ({
  signingOut: false,
  setSigningOut: (value) => set({ signingOut: value }),
}));

/**
 * Clear all client-side session and storage.
 * Clears cookies, localStorage, sessionStorage, and Zustand state.
 */
export function clearSessionAndStorage(): void {
  if (typeof window === "undefined") return;
  clearAllCookies();

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch { }

  useUserBaseStore.getState().setUserBase(null);
  useUserResumeStore.getState().setResumes([]);
  useUserResumeStore.getState().setLastResumeId(null);
  useCheckoutModalStore.getState().close();
}

type PerformSignOutOptions = {
  callbackUrl?: string;
};


export async function performSignOut({ callbackUrl = "/auth/signin" }: PerformSignOutOptions): Promise<void> {
  if (typeof window === "undefined") return;

  useSignOutStore.getState().setSigningOut(true);
  clearSessionAndStorage();

  try {
    await nextAuthSignOut({ callbackUrl, redirect: true });
  } finally {
    useSignOutStore.getState().setSigningOut(false);
  }
}
