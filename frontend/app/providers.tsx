"use client";

import { SessionProvider as AuthSessionProvider } from "next-auth/react";

import { SessionProvider } from "./session-context";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <SessionProvider>
        <SidebarProvider>
            {children}
        </SidebarProvider>
      </SessionProvider>
    </AuthSessionProvider>
  );
}
