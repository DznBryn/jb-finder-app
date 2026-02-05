import { create } from "zustand";
import type { CheckoutPlan } from "@/components/CheckoutModal";

type CheckoutModalState = {
  open: boolean;
  message: string | null;
  preselectedPlan: CheckoutPlan | null;
  openFor402: (detail: { required?: number; available?: number }) => void;
  openForCredits: () => void;
  close: () => void;
};

export const useCheckoutModalStore = create<CheckoutModalState>((set) => ({
  open: false,
  message: null,
  preselectedPlan: null,
  openFor402: (detail) => {
    const { required = 0, available = 0 } = detail;
    const message =
      available === 0
        ? "Sign in to use this feature, or buy credits below."
        : `You need ${required} credits but have ${available}. Get more below.`;
    set({
      open: true,
      message,
      preselectedPlan: required <= 300 ? "topup_small" : "topup_large",
    });
  },
  openForCredits: () => {
    set({
      open: true,
      message: null,
      preselectedPlan: null,
    });
  },
  close: () => {
    set({ open: false, message: null, preselectedPlan: null });
  },
}));

/** If the error is from a 402 PAYMENT_REQUIRED response, open the checkout modal and return true. */
export function handlePaywalledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  try {
    const payload = JSON.parse(error.message) as {
      code?: string;
      required?: number;
      available?: number;
    };
    if (payload?.code === "PAYMENT_REQUIRED") {
      useCheckoutModalStore.getState().openFor402({
        required: payload.required,
        available: payload.available,
      });
      return true;
    }
  } catch {
    // not JSON
  }
  return false;
}
