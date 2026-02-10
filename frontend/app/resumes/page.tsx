import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";
import { normalizeResumesPayload } from "@/lib/resumes";
import type { UserResumesPayload } from "@/type";
import ResumesTable from "@/components/ResumesTable";

const PAGE_SIZE = 10;

export const metadata = {
  title: "Resumes | hyreme.io",
  description: "Your saved resumes.",
};

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/auth/signin");
  }

  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(String(pageParam || "1"), 10) || 1);

  let resumes: Awaited<ReturnType<typeof normalizeResumesPayload>> = [];
  try {
    const url = `${getBackendUrl("/api/user/resumes")}?user_id=${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: getBackendHeaders(false),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as UserResumesPayload;

      resumes = normalizeResumesPayload(data);
    }
  } catch { }

  const total = resumes.length;
  const start = Number(currentPage - 1) * Number(PAGE_SIZE);
  const pageResumes = resumes.slice(start, start + PAGE_SIZE);
  
  return (
    <div className="p-2 w-full max-w-7xl mx-auto flex flex-col gap-2">
      <p className="text-slate-400 text-sm">
        Resumes linked to your account from uploads and sessions.
      </p>
      <ResumesTable
        resumes={pageResumes}
        currentPage={currentPage}
        total={total}
      />
    </div>
  );
}
