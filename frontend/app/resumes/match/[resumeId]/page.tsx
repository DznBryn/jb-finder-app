import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import ResumeMatchView from "./ResumeMatchView";

export const metadata = {
  title: "Match resume to jobs | hyreme.io",
  description: "Match this resume to available jobs.",
};

export default async function ResumeMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ resumeId: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null;
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { resumeId } = await params;
  const { session_id } = await searchParams;

  return (
    <div className="p-2 w-full max-w-7xl mx-auto flex flex-col gap-4">
      <ResumeMatchView resumeId={resumeId} sessionIdFromQuery={session_id ?? null} />
    </div>
  );
}
