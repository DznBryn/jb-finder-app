"use client";

import { useEffect } from "react";
import { useSession } from "@/app/session-context";
import type { SessionProfile } from "@/type";
import HomepageClient from "@/components/HomePage";

export default function ResumeMatchView({
  resumeId,
  sessionIdFromQuery,
}: {
  resumeId: string;
  sessionIdFromQuery: string | null;
}) {
  const { sessionProfile, setSessionProfile } = useSession();

  useEffect(() => {
    if (!sessionIdFromQuery) return;
    if (sessionProfile?.session_id === sessionIdFromQuery) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem("session_id", sessionIdFromQuery);
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/session/profile?session_id=${encodeURIComponent(sessionIdFromQuery)}`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as SessionProfile;
        if (!cancelled) setSessionProfile(data);
      } catch { }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionIdFromQuery, sessionProfile?.session_id, setSessionProfile]);

  if (!sessionIdFromQuery) {
    return (
      <div className="mx-auto flex min-h-[40vh] flex-col items-center justify-center gap-4 px-2 py-8">
        <p className="text-slate-500">Missing session. Start from Resumes by clicking a resume and choosing “Match jobs”.</p>
      </div>
    );
  }

  return <HomepageClient matchOnly />;
}
