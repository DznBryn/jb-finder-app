"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import AppSidebar from "@/components/AppSidebar";
import type { UserBase, UserResume } from "@/type";
import { useUserBaseStore } from "@/lib/userBaseStore";
import { useUserResumeStore } from "@/lib/userResumeStore";
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";
import { CheckoutModal } from "./CheckoutModal";
import { Spinner } from "./ui/spinner";
import Footer from "./Footer";
import AppHeader from "./AppHeader";

export default function AuthLayout({
  children,
  initialUserBase,
  initialResumes,
}: {
  children: React.ReactNode;
  initialUserBase: UserBase | null;
  initialResumes: UserResume[] | null;
}) {
  const { status, data } = useSession();
  const hydrateUserBase = useUserBaseStore((state) => state.hydrateUserBase);
  const hydrateUserResumes = useUserResumeStore(
    (state) => state.hydrateUserResumes
  );
  const setUserBase = useUserBaseStore((state) => state.setUserBase);
  const setResumes = useUserResumeStore((state) => state.setResumes);

  const userId = (data?.user as { id?: string } | undefined)?.id;
  
  const checkoutOpen = useCheckoutModalStore((s) => s.open);
  const checkoutMessage = useCheckoutModalStore((s) => s.message);
  const checkoutPreselected = useCheckoutModalStore((s) => s.preselectedPlan);
  const checkoutClose = useCheckoutModalStore((s) => s.close);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!userId) return;
    if (initialUserBase) {
      setUserBase(initialUserBase);
    } else {
      hydrateUserBase();
    }
    if (initialResumes) {
      setResumes(initialResumes);
    } else {
      hydrateUserResumes();
    }
  }, [
    hydrateUserBase,
    hydrateUserResumes,
    initialResumes,
    initialUserBase,
    setResumes,
    setUserBase,
    status,
    userId,
  ]);

  // Loading: show minimal layout to avoid hydration mismatch
  if (status === "loading") {
    return (
      <main className="min-h-svh w-full flex flex-col px-4 md:px-6">
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-4 min-h-0">
          <Spinner className="size-10 text-slate-500 animate-spin" />
          <span className="text-slate-500 text-base font-medium">Loading resources...</span>
        </div>
        <Footer />
      </main>
    );
  }

  // Authenticated: full-viewport flex container so sidebar + main fill height and footer sticks to bottom
  if (status === "authenticated") {
    return (
      <>
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <main className="flex flex-1 flex-col min-h-0 min-w-0 transition-[width,height] ease-linear md:ml-42 md:group-has-data-[collapsible=icon]/sidebar-wrapper:ml-28 md:px-4">
            <AppHeader />
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {children}
            </div>
            <Footer />
          </main>
        </div>
        <CheckoutModal
          open={checkoutOpen}
          onOpenChange={(open: boolean) => !open && checkoutClose()}
          message={checkoutMessage}
          preselectedPlan={checkoutPreselected}
        />
      </>
    );
  }

  // Not authenticated: full-width layout without sidebar, with transparent header
  return (
    <main className="min-h-svh w-full flex flex-col md:max-w-7xl mx-auto">
      <AppHeader />
      <div className="flex-1 min-h-0">
        {children}
      </div>
      <Footer />
    </main>
  );
}
