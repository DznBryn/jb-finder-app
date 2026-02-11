"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SignupPromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoogle: () => void;
  onLinkedIn: () => void;
  title?: string;
  message?: string;
};

export default function SignupPrompt({
  open,
  onOpenChange,
  onGoogle,
  onLinkedIn,
  title = "Save your progress",
  message = "Create an account to save your session and unlock more features.",
}: SignupPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate-300">
          <p>{message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={onGoogle}>Continue with Google</Button>
            <Button variant="secondary" onClick={onLinkedIn}>
              Continue with LinkedIn
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full text-slate-400"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
