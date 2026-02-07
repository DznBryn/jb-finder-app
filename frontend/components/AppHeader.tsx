"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import SignupPrompt from "@/components/SignupPrompt";
import { useState } from "react";

export default function AppHeader() {
  const pathname = usePathname();
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const isSignInPage = pathname === "/auth/signin";

  const getCallbackUrl = () =>
    typeof window === "undefined" ? "/" : window.location.href;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-transparent border-none">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-end gap-2 px-4 md:px-6">
          {!isSignInPage && (
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
