"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserBaseStore } from "@/lib/userBaseStore";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export type CheckoutPlan =
  | "monthly_basic"
  | "monthly_pro"
  | "topup_small"
  | "topup_large";

const PLANS: {
  id: CheckoutPlan;
  label: string;
  description: string;
  credits: string;
  bonus?: string;
}[] = [
  {
    id: "monthly_basic",
    label: "Job Seeker (Basic)",
    description: "500 credits/month",
    credits: "500 credits/mo",
  },
  {
    id: "monthly_pro",
    label: "Power Applier (Pro)",
    description: "2,500 credits/month",
    credits: "2,500 credits/mo",
  },
  {
    id: "topup_small",
    label: "Top-up (Small)",
    description: "200 credits",
    credits: "200 credits",
    bonus: "Subscribers get 300 (+50%)",
  },
  {
    id: "topup_large",
    label: "Top-up (Large)",
    description: "1,000 credits",
    credits: "1,000 credits",
    bonus: "Subscribers get 1,500 (+50%)",
  },
];

type Step = "select" | "checkout" | "success" | "error";

type CheckoutModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a plan when opening (e.g. after 402). */
  preselectedPlan?: CheckoutPlan | null;
  /** Message to show above plan selection (e.g. "You need more credits."). */
  message?: string | null;
};

export function CheckoutModal({
  open,
  onOpenChange,
  preselectedPlan = null,
  message = null,
}: CheckoutModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan | null>(
    preselectedPlan ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrateUserBase = useUserBaseStore((s) => s.hydrateUserBase);

  const handleSelectPlan = useCallback(
    async (plan: CheckoutPlan) => {
      setSelectedPlan(plan);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/checkout/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan, ui_mode: "embedded" }),
        });
        const data = (await res.json()) as {
          client_secret?: string | null;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || "Failed to start checkout");
          setStep("error");
          return;
        }
        const secret = data.client_secret;
        if (!secret) {
          setError("No checkout session returned");
          setStep("error");
          return;
        }
        setClientSecret(secret);
        setStep("checkout");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
        setStep("error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleComplete = useCallback(() => {
    setStep("success");
    hydrateUserBase();
  }, [hydrateUserBase]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setStep("select");
    setClientSecret(null);
    setSelectedPlan(null);
    setError(null);
  }, [onOpenChange]);

  const plan = useUserBaseStore((s) => s.userBase?.wallet?.plan);
  const isSubscriber = plan && plan !== "free";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="center"
        className="max-w-lg sm:max-w-xl"
        onPointerDownOutside={(e) => {
          if (step === "checkout") e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Choose a plan"}
            {step === "checkout" && "Complete payment"}
            {step === "success" && "Payment complete"}
            {step === "error" && "Something went wrong"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" &&
              (message || "Select a subscription or top-up pack.")}
            {step === "checkout" && "Enter your payment details below."}
            {step === "success" && "Your credits have been added."}
            {step === "error" && error}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="grid gap-3 py-2">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading}
                className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left transition hover:border-slate-300 hover:bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {plan.label}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {plan.credits}
                </span>
                {plan.bonus && (
                  <span className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    {isSubscriber ? plan.bonus : plan.bonus}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {step === "checkout" && clientSecret && stripePromise && (
          <div className="min-h-[320px] w-full">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                onComplete: handleComplete,
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        {step === "success" && (
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your balance has been updated. Closing…
            </p>
            <Button className="mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="flex gap-2 py-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep("select");
                setError(null);
              }}
            >
              Try again
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
