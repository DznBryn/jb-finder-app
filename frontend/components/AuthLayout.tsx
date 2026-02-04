"use client";

import { useSession } from "next-auth/react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  // Loading: show minimal layout to avoid hydration mismatch
  if (status === "loading") {
    return (
      <main className="min-h-svh w-full p-4 md:p-6">
        {children}
      </main>
    );
  }

  // Authenticated: show sidebar + SidebarInset per shadcn blocks pattern
  // See: https://ui.shadcn.com/blocks/sidebar
  if (status === "authenticated") {
    return (
      <>
        <AppSidebar />
        <main className="md:ml-42 flex flex-col gap-4 transition-[width,height] ease-linear md:group-has-data-[collapsible=icon]/sidebar-wrapper:ml-28 w-full h-full p-4 md:p-6">
          {children}
        </main>

      </>
    );
  }

  // Not authenticated: full-width layout without sidebar
  return (
    <main className="min-h-svh w-full p-4 md:p-6">
      {children}
    </main>
  );
}
