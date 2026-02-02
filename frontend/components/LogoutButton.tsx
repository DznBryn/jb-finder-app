"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export default function LogoutButton({
  variant = "outline",
  size = "sm",
  className = "",
}: LogoutButtonProps) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
    >
      Sign out
    </Button>
  );
}
