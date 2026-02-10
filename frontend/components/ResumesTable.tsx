"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserResume } from "@/type";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, total);

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

  const disabled = isDeleting;
  const selectedCount = selectedIds.size;

  return (
    <div className=" flex flex-col gap-2">
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
              resumes.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-slate-800 hover:bg-slate-800/40"
                >
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={disabled}
                      aria-label={`Select ${filenameFromS3Key(r.resume_s3_key)}`}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-slate-200 focus:ring-slate-500"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-200">
                    {filenameFromS3Key(r.resume_s3_key)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {(r.extracted_skills?.length ?? 0)}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {(r.inferred_titles?.length ?? 0)}
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
          "w-full grid grid-cols-12 items-center justify-between px-2",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <p className="text-sm text-slate-500 col-span-1 ">
          {from}-{to} of {total}
        </p>
        <Pagination className="col-span-11 justify-end w-full">
          <PaginationContent>
            <PaginationItem>
              {currentPage > 1 ? (
                <Link
                  href={`/resumes?page=${currentPage - 1}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "default",
                    className: "gap-1 pl-2.5",
                  })}
                >
                  ‹ Previous
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 pl-2.5 pointer-events-none opacity-50"
                  )}
                >
                  ‹ Previous
                </span>
              )}
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => (
                <PaginationItem key={page}>
                  <Link
                    href={`/resumes?page=${page}`}
                    className={cn(
                      buttonVariants({
                        variant: page === currentPage ? "outline" : "ghost",
                        size: "icon",
                      })
                    )}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Link>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              {currentPage < totalPages ? (
                <Link
                  href={`/resumes?page=${currentPage + 1}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "default",
                    className: "gap-1 pr-2.5",
                  })}
                >
                  Next ›
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 pr-2.5 pointer-events-none opacity-50"
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
