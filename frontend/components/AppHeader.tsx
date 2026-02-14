"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import SignupPrompt from "@/components/SignupPrompt";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 8;

export default function AppHeader() {
  const pathname = usePathname();
  const { status } = useSession();
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isSignInPage = pathname === "/auth/signin";
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(typeof window !== "undefined" && window.scrollY > SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const getCallbackUrl = () =>
    typeof window === "undefined" ? "/" : window.location.href;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-[var(--z-header)] w-full border-none transition-[background-color,box-shadow] duration-200",
          isAuthenticated && "md:hidden",
          isScrolled
            ? "border-b border-slate-800 bg-slate-950/95 shadow-sm backdrop-blur-sm md:hidden"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 items-center gap-2 px-4">
          {isAuthenticated ? (
            <SidebarTrigger
              className={cn(
                "text-slate-200 hover:bg-slate-800/60 md:hidden"
              )}
              aria-label="Open menu"
            />
          ) : null}
          <div className="flex-1" />
          {!isAuthenticated && !isSignInPage && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                asChild
              >
                <Link href="/auth/signin">Login</Link>
              </Button>
              <Button
                size="sm"
                className="rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                onClick={() => setShowSignupPrompt(true)}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </header>
      <SignupPrompt
        open={showSignupPrompt}
        onOpenChange={setShowSignupPrompt}
        onGoogle={() => signIn("google", { callbackUrl: getCallbackUrl() })}
        onLinkedIn={() => signIn("linkedin", { callbackUrl: getCallbackUrl() })}
        title="Sign Up"
        message="Create an account to save your session and unlock more features."
      />
    </>
  );
}
