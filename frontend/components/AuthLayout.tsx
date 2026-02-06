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
      <div className="flex flex-col items-center justify-center h-[70vh] w-full gap-4">
        <Spinner className="size-10 text-slate-500 animate-spin" />
        <span className="text-slate-500 text-base font-medium">Loading resources...</span>
      </div>
        <Footer />
      </main>
    );
  }

  // Authenticated: show sidebar + SidebarInset per shadcn blocks pattern
  // See: https://ui.shadcn.com/blocks/sidebar
  if (status === "authenticated") {
    return (
      <>
        <AppSidebar />
        <main className="md:ml-42 flex flex-col gap-4 transition-[width,height] ease-linear md:group-has-data-[collapsible=icon]/sidebar-wrapper:ml-28 w-full h-full px-4">
          {children}
          <Footer />
        </main>
        <CheckoutModal
          open={checkoutOpen}
          onOpenChange={(open: boolean) => !open && checkoutClose()}
          message={checkoutMessage}
          preselectedPlan={checkoutPreselected}
        />
      </>
    );
  }

  // Not authenticated: full-width layout without sidebar
  return (
    <main className="min-h-svh w-full flex flex-col px-4 md:px-6">
      {children}
      <Footer />
    </main>
  );
}
