"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUserBaseStore } from "@/lib/userBaseStore";

const REDIRECT_DELAY_MS = 2000;

export default function CheckoutCompletePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"confirming" | "success" | "error">(
    "confirming"
  );
  const hydrateUserBase = useUserBaseStore((s) => s.hydrateUserBase);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as {
          status?: string;
          payment_status?: string;
        };
        const paid =
          data.payment_status === "paid" || data.status === "complete";
        if (paid) {
          // Fulfill on redirect so user gets credits even if webhook hasn't run
          await fetch(
            `/api/checkout/fulfill?session_id=${encodeURIComponent(sessionId)}`,
            { method: "POST" }
          );
        }
        setStatus("success");
        await hydrateUserBase();
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, hydrateUserBase]);

  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => {
      window.location.href = "/";
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  if (!sessionId) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-slate-100 dark:text-slate-100">
          Invalid link
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No session ID. You can return home.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Go home
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-slate-100 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We couldn’t confirm your payment. Your balance may still update shortly.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Go home
        </Link>
      </div>
    );
  }

  if (status === "confirming") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-slate-100" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Confirming your payment…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-slate-100 dark:text-slate-100">
        Payment complete
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your credits have been added. Redirecting you back…
      </p>
      <Link
        href="/"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Go home now
      </Link>
    </div>
  );
}
