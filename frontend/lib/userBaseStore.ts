import { create } from "zustand";
import type { UserBase } from "@/type";

type UserBaseState = {
  userBase: UserBase | null;
  loading: boolean;
  error: string | null;
  subscriptionRefreshTrigger: number;
  setUserBase: (userBase: UserBase | null) => void;
  hydrateUserBase: () => Promise<void>;
  triggerSubscriptionRefresh: () => void;
};

export const useUserBaseStore = create<UserBaseState>((set) => ({
  userBase: null,
  loading: false,
  error: null,
  subscriptionRefreshTrigger: 0,
  setUserBase: (userBase) => set({ userBase }),
  triggerSubscriptionRefresh: () =>
    set(({ subscriptionRefreshTrigger: trigger }) => ({ subscriptionRefreshTrigger: trigger + 1 })),
  hydrateUserBase: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/user/base", { credentials: "include" });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to load user base.");
      }
      const data = (await response.json()) as UserBase;
      set({ userBase: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unexpected user base error.",
        loading: false,
      });
    }
  },
}));
