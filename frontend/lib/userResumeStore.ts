import { create } from "zustand";
import { normalizeResumesPayload } from "@/lib/resumes";
import type { UserResume, UserResumesPayload } from "@/type";

type UserResumeState = {
  resumes: UserResume[];
  loading: boolean;
  error: string | null;
  lastResumeId: string | null;
  setResumes: (resumes: UserResume[]) => void;
  updateResume: (resume: UserResume) => void;
  setLastResumeId: (resumeId: string | null) => void;
  hydrateUserResumes: () => Promise<void>;
};

export const useUserResumeStore = create<UserResumeState>((set, get) => ({
  resumes: [],
  loading: false,
  error: null,
  lastResumeId: null,
  setResumes: (resumes) => set({ resumes }),
  updateResume: (resume) => {
    const { resumes } = get();
    const next = resumes.map((item) => (item.id === resume.id ? resume : item));
    set({ resumes: next });
  },
  setLastResumeId: (resumeId) => set({ lastResumeId: resumeId }),
  hydrateUserResumes: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/user/resumes", { credentials: "include" });
      if (response.status === 401) {
        const { performSignOut } = await import("@/lib/signOut");
        await performSignOut({ callbackUrl: "/auth/signin" });
        return;
      }
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to load user resumes.");
      }
      const data = (await response.json()) as UserResumesPayload;
      const resumes = normalizeResumesPayload(data);
      set({ resumes, loading: false });
      if (resumes.length > 0) {
        set({ lastResumeId: resumes[0].id });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unexpected resume error.",
        loading: false,
      });
    }
  },
}));
