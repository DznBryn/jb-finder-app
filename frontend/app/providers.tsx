"use client";

import { SessionProvider as AuthSessionProvider } from "next-auth/react";

import { SessionProvider } from "./session-context";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <SessionProvider>
        <SidebarProvider
          defaultOpen={false}
          style={
            {
              "--sidebar-width": "25rem",
            } as React.CSSProperties
          }
        >
          {children}
        </SidebarProvider>
      </SessionProvider>
    </AuthSessionProvider>
  );
}
