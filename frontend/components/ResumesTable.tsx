"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionProfile, UserResume } from "@/type";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/app/session-context";

const PAGE_SIZE = 10;

function filenameFromS3Key(key: string | null | undefined): string {
  if (!key) return "—";
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ResumesTable({
  resumes,
  currentPage,
  total,
}: {
  resumes: UserResume[];
  currentPage: number;
  total: number;
}) {
  const router = useRouter();
  const { setSessionProfile } = useSession();
  const isMobile = useIsMobile();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [matchDialogResume, setMatchDialogResume] = useState<UserResume | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, total);

  const visiblePages = (() => {
    if (isMobile) {
      const adjacent = 1;
      const start = Math.max(1, currentPage - adjacent);
      const end = Math.min(totalPages, currentPage + adjacent);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  })();

  const pageIds = resumes.map((resume) => resume.id);

  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const openConfirm = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDialogOpen(true);
  }, [selectedIds.size]);

  const confirmDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDialogOpen(false);
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/resumes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Failed to delete resumes.");
        return;
      }
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, router]);

  const confirmMatch = useCallback(async () => {
    const resume = matchDialogResume;
    if (!resume) return;
    setMatchDialogResume(null);
    setIsCreatingSession(true);
    try {
      const res = await fetch(`/api/user/resume/${encodeURIComponent(resume.id)}/create-session`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Failed to start matching.");
        return;
      }
      const profile = (await res.json()) as SessionProfile;
      setSessionProfile(profile);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("session_id", profile.session_id);
      }
      router.push(`/resumes/match/${resume.id}?session_id=${encodeURIComponent(profile.session_id)}`);
    } finally {
      setIsCreatingSession(false);
    }
  }, [matchDialogResume, router, setSessionProfile]);

  const disabled = isDeleting || isCreatingSession;
  const selectedCount = selectedIds.size;

  return (
    <div className=" flex flex-col gap-2">
      {deleteSuccessMessage && (
        <div
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 animate-in fade-in duration-200"
          role="status"
          aria-live="polite"
        >
          {deleteSuccessMessage}
        </div>
      )}
      {resumes.length > 0 && (
        <div className="flex items-center gap-2 justify-end ">
          <Button
            variant={disabled || selectedCount === 0 ? "outline" : "destructive"}
            size="sm"
            onClick={openConfirm}
            disabled={disabled || selectedCount === 0}
          >
            Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent variant="center" className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete resume(s)?</DialogTitle>
            <DialogDescription>
              This will permanently remove the selected resume record(s) and
              their stored file(s). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={disabled}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!matchDialogResume} onOpenChange={(open) => !open && setMatchDialogResume(null)}>
        <DialogContent variant="center" className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Match this resume to jobs?</DialogTitle>
            <DialogDescription>
              {matchDialogResume
                ? `Run job matching for "${filenameFromS3Key(matchDialogResume.resume_s3_key)}" using the same workflow as resume upload. You’ll see match results on the next page.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setMatchDialogResume(null)}
              disabled={isCreatingSession}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMatch}
              disabled={isCreatingSession}
            >
              {isCreatingSession ? "Starting…" : "Match jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div
        className={cn(
          "rounded-md border border-slate-800 bg-slate-900/40",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="w-10 text-slate-400">
                {resumes.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    disabled={disabled}
                    aria-label="Select all on page"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-slate-200 focus:ring-slate-500"
                  />
                ) : null}
              </TableHead>
              <TableHead className="text-slate-400">Filename</TableHead>
              <TableHead className="text-slate-400">Created</TableHead>
              <TableHead className="text-slate-400">Skills</TableHead>
              <TableHead className="text-slate-400">Titles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumes.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-slate-500"
                >
                  No resumes yet. Upload one from Home.
                </TableCell>
              </TableRow>
            ) : (
              resumes.map((resume) => (
                <TableRow
                  key={resume.id}
                  className={cn(
                    "border-slate-800 hover:bg-slate-800/40",
                    !disabled && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (disabled) return;
                    setMatchDialogResume(resume);
                  }}
                >
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(resume.id)}
                      onChange={() => toggleRow(resume.id)}
                      disabled={disabled}
                      aria-label={`Select ${filenameFromS3Key(resume.resume_s3_key)}`}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-slate-200 focus:ring-slate-500"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-200">
                    {filenameFromS3Key(resume.resume_s3_key)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {formatDate(resume.created_at)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {(resume.extracted_skills?.length ?? 0)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {(resume.inferred_titles?.length ?? 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* {totalPages > 1 && ( */}
      <div
        className={cn(
          "w-full grid grid-cols-12 items-center justify-between gap-2 px-2 pb-4 md:pb-0",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <p className="text-sm text-slate-500 col-span-12 md:col-span-1">
          {from}-{to} of {total}
        </p>
        <Pagination className="col-span-12 md:col-span-11 justify-end w-full">
          <PaginationContent>
            <PaginationItem>
              {currentPage > 1 ? (
                <Link
                  href={`/resumes?page=${currentPage - 1}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "default",
                    className: "gap-1 pl-2.5 min-h-[44px] min-w-[44px] touch-manipulation",
                  })}
                >
                  ‹ Previous
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 pl-2.5 min-h-[44px] min-w-[44px] pointer-events-none opacity-50"
                  )}
                >
                  ‹ Previous
                </span>
              )}
            </PaginationItem>
            {visiblePages.map((page: number) => (
              <PaginationItem key={page}>
                <Link
                  href={`/resumes?page=${page}`}
                  className={cn(
                    buttonVariants({
                      variant: page === currentPage ? "outline" : "ghost",
                      size: "icon",
                    }),
                    "min-h-[44px] min-w-[44px] touch-manipulation"
                  )}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Link>
              </PaginationItem>
            ))}
            <PaginationItem>
              {currentPage < totalPages ? (
                <Link
                  href={`/resumes?page=${currentPage + 1}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "default",
                    className: "gap-1 pr-2.5 min-h-[44px] min-w-[44px] touch-manipulation",
                  })}
                >
                  Next ›
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 pr-2.5 min-h-[44px] min-w-[44px] pointer-events-none opacity-50"
                  )}
                >
                  Next ›
                </span>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>

      </div>
      {/* )} */}
    </div>
  );
}
