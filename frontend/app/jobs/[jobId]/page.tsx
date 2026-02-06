import dynamic from "next/dynamic";
import JobDetailsSkeleton from "@/components/skeletons/JobDetailsSkeleton";

const JobDetails = dynamic(() => import("@/components/JobDetails"), {
  loading: () => <JobDetailsSkeleton />,
});

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <main className="py-2 md:py-8">
      <JobDetails jobId={jobId} />
    </main>
  );
}
