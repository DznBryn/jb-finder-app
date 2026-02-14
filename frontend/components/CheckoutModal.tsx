"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export type CheckoutPlan =
  | "monthly_basic"
  | "monthly_pro"
  | "topup_small"
  | "topup_large";

const SUBSCRIPTION_PLANS = [
  {
    id: "monthly_basic" as CheckoutPlan,
    title: "Job Seeker",
    price: "$9.99",
    credits: "500 credits / month",
    description: "For light and occasional applicants",
    features: ["Resume analysis", "AI job matching", "ATS scoring"],
    highlighted: false,
  },
  {
    id: "monthly_pro" as CheckoutPlan,
    title: "Power Applier",
    price: "$24.99",
    credits: "2,500 credits / month",
    description: "For serious job seekers applying consistently",
    features: [
      "Everything in Basic",
      "Priority processing",
      "Higher match visibility",
      "Faster AI analysis",
    ],
    highlighted: true,
  },
];

const TOPUP_PLANS = [
  {
    id: "topup_small" as CheckoutPlan,
    price: "$4.99",
    credits: "200 credits",
    bonus: "Subscribers get 300 (+50%)",
  },
  {
    id: "topup_large" as CheckoutPlan,
    price: "$19.99",
    credits: "1,000 credits",
    bonus: "Subscribers get 1,500 (+50%)",
  },
];

type Step = "select" | "checkout" | "success" | "error";

type CheckoutModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPlan?: CheckoutPlan | null;
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
  const isMobile = useIsMobile();

  const handleSelectPlan = useCallback(async (plan: CheckoutPlan) => {
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
  }, []);

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

  const orderedSubscriptionPlans = isMobile
    ? [...SUBSCRIPTION_PLANS].sort(
      (a, b) => (a.highlighted ? 0 : 1) - (b.highlighted ? 0 : 1)
    )
    : SUBSCRIPTION_PLANS;

  // Hide the user's current subscription plan from options (keep top-ups)
  const visibleSubscriptionPlans = orderedSubscriptionPlans.filter(
    (vplan) => vplan.id !== (plan as CheckoutPlan)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="center"
        className={cn(
          "flex flex-col",
          "max-w-full w-full sm:w-full sm:max-w-6xl",
          "h-dvh max-h-dvh sm:h-auto sm:max-h-[90vh]",
          "rounded-none sm:rounded-xl shadow-xl overflow-hidden",
          "bg-slate-900 border-slate-700/50",
          "p-0"
        )}
        onPointerDownOutside={(e) => {
          if (step === "checkout") e.preventDefault();
        }}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {(step === "checkout" || step === "success" || step === "error") && (
            <div className="shrink-0 px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-2">
              <DialogHeader>
                <DialogTitle className="text-slate-100">
                  {step === "checkout" && "Complete payment"}
                  {step === "success" && "Payment complete"}
                  {step === "error" && "Something went wrong"}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {step === "checkout" && "Enter your payment details below."}
                  {step === "success" && "Your credits have been added."}
                  {step === "error" && error}
                </DialogDescription>
              </DialogHeader>
            </div>
          )}

          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
              "scroll-smooth overscroll-contain",
              "px-4 pb-4 sm:px-6 sm:pb-6",
              step === "select" && "pt-4 sm:pt-6"
            )}
          >
            {step === "select" && (
              <div className="space-y-8">
                {/* Section Header */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-100 sm:text-3xl">
                    Choose Your Plan
                  </h2>
                  <p className="mt-2 text-slate-400">
                    Apply strategically. Pay only for what you use.
                  </p>
                  {message && (
                    <p className="mt-2 text-sm text-amber-400">{message}</p>
                  )}
                </div>

                {/* Monthly Plans */}
                <div
                  className={cn(
                    "max-w-3xl mx-auto",
                    visibleSubscriptionPlans.length === 1
                      ? "flex justify-center"
                      : "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
                  )}
                >
                  {visibleSubscriptionPlans.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "relative flex flex-col text-left rounded-2xl p-6 h-full",
                        "border transition-all duration-200",
                        "hover:scale-[1.02] active:scale-[0.99]",
                        visibleSubscriptionPlans.length === 1 && "w-full max-w-sm",
                        p.highlighted
                          ? "bg-zinc-800/90 border-blue-500/60 shadow-lg shadow-blue-500/10 scale-[1.03] md:scale-100 md:hover:scale-[1.03]"
                          : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                      )}
                    >
                      {p.highlighted && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-700 text-white border border-blue-500/40">
                          Most Popular
                        </span>
                      )}
                      <span className="text-lg font-semibold text-slate-100">
                        {p.title}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-100">
                          {p.price}
                        </span>
                        <span className="text-sm font-normal text-slate-400">
                          /month
                        </span>
                      </div>
                      <span className="text-sm text-slate-400">{p.credits}</span>
                      <p className="mt-2 text-sm text-slate-400">{p.description}</p>
                      <div className="my-4 h-px bg-zinc-700" />
                      <ul className="space-y-2 flex-1">
                        {p.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={cn(
                          "mt-4 w-full",
                          p.highlighted
                            ? "bg-emerald-600 text-slate-950 hover:bg-emerald-500"
                            : "bg-zinc-700 text-slate-100 hover:bg-zinc-600 border border-zinc-600"
                        )}
                        disabled={loading}
                        onClick={() => handleSelectPlan(p.id)}
                      >
                        {loading ? "Loading…" : "Unlock Power"}
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-700/80" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-900 px-4 text-xs text-slate-500 uppercase tracking-wider">
                      Top-Up Credits
                    </span>
                  </div>
                </div>

                {/* Top-Up Credits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {TOPUP_PLANS.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex flex-col items-center sm:items-start rounded-xl p-4",
                        "border border-zinc-700/80 bg-zinc-800/50",
                        "hover:border-zinc-600 hover:bg-zinc-800/70 transition-all duration-200"
                      )}
                    >
                      <span className="font-medium text-slate-200">
                        {p.price} — {p.credits}
                      </span>
                      {isSubscriber && (
                        <span className="mt-1 text-xs text-emerald-400">
                          {p.bonus}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full border-zinc-600 text-slate-200 hover:bg-zinc-700"
                        disabled={loading}
                        onClick={() => handleSelectPlan(p.id)}
                      >
                        Add credits
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Trust Text */}
                <p className="text-center text-xs text-slate-500 pt-2">
                  Cancel anytime. Secure checkout powered by Stripe.
                </p>
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
                <p className="text-sm text-slate-400">
                  Your balance has been updated. Closing…
                </p>
                <Button
                  className="mt-4 bg-emerald-600 text-slate-950 hover:bg-emerald-500"
                  onClick={handleClose}
                >
                  Done
                </Button>
              </div>
            )}

            {step === "error" && (
              <div className="flex gap-2 py-2">
                <Button
                  variant="outline"
                  className="border-zinc-600 text-slate-200"
                  onClick={() => {
                    setStep("select");
                    setError(null);
                  }}
                >
                  Try again
                </Button>
                <Button
                  variant="secondary"
                  className="bg-zinc-800 text-slate-200"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
