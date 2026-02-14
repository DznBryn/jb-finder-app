"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";

type SubscriptionDetails = {
  plan: string;
  plan_name: string;
  price_display: string;
  billing_interval: string;
  status: string; // active | canceling | canceled | none
  can_manage: boolean;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null; // unix ts
};

export default function AccountSection() {
  const wallet = useUserBaseStore((s) => s.userBase?.wallet);
  const openCheckout = useCheckoutModalStore(({ openForCredits }) => openForCredits);
  const subscriptionRefreshTrigger = useUserBaseStore(
    ({ subscriptionRefreshTrigger }) => subscriptionRefreshTrigger
  );

  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/details", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to load subscription");
      }
      const data = (await res.json()) as SubscriptionDetails;
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load subscription");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    if (subscriptionRefreshTrigger > 0) fetchDetails();
  }, [subscriptionRefreshTrigger, fetchDetails]);

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/subscription/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        setConfirmOpen(false);
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPortalLoading(false);
    }
  }, []);

  // Active or canceling = still has subscription access
  const hasSubscription =
    details?.plan &&
    details.plan !== "free" &&
    (details.status === "active" || details.status === "canceling");
  const canManage = details?.can_manage ?? wallet?.can_manage_subscription ?? false;

  const cancelLabel = (() => {
    if (details?.status !== "canceling" || !details?.current_period_end) return null;
    try {
      const d = new Date(details.current_period_end * 1000);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  })();

  if (loading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-slate-400">Account</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex items-center gap-2 px-2 py-1 text-slate-400 group-data-[collapsible=icon]:justify-center">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="text-sm group-data-[collapsible=icon]:hidden">Loading…</span>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-slate-400">Account</SidebarGroupLabel>
        <SidebarGroupContent>
          {error ? (
            <div className="flex items-center gap-2 px-2 py-1 text-amber-400 group-data-[collapsible=icon]:justify-center">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs group-data-[collapsible=icon]:hidden">{error}</span>
            </div>
          ) : details?.status === "canceled" ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 text-slate-400 group-data-[collapsible=icon]:justify-center">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="text-sm group-data-[collapsible=icon]:hidden">Canceled</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
                onClick={() => openCheckout()}
              >
                <CreditCard className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Subscribe again</span>
              </Button>
            </div>
          ) : !hasSubscription ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 text-slate-400 group-data-[collapsible=icon]:justify-center">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="text-sm group-data-[collapsible=icon]:hidden">
                  No active subscription
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
                onClick={() => openCheckout()}
              >
                <CreditCard className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Subscribe / Upgrade</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-slate-200 text-sm group-data-[collapsible=icon]:text-center">
                <span className="font-medium group-data-[collapsible=icon]:hidden">
                  {details?.plan_name ?? "Subscription"}
                </span>
                {details?.billing_interval && (
                  <span className="block text-xs text-slate-400 group-data-[collapsible=icon]:hidden">
                    {details.price_display}/{details.billing_interval}
                  </span>
                )}
                {details?.status === "canceling" && cancelLabel && (
                  <span className="block text-xs text-amber-400 group-data-[collapsible=icon]:hidden">
                    Cancels on {cancelLabel}
                  </span>
                )}
              </div>
              {canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
                  onClick={() => setConfirmOpen(true)}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Manage / Cancel
                  </span>
                </Button>
              ) : null}
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>
              You will be redirected to Stripe&apos;s secure billing portal where you can update
              payment methods, view invoices, or cancel your subscription.
            </DialogDescription>
          </DialogHeader>
          {portalError && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{portalError}</span>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
              onClick={() => setConfirmOpen(false)}
              disabled={portalLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-slate-950 hover:bg-emerald-500"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening…
                </>
              ) : (
                "Continue to Stripe"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
