import JobDetails from "@/components/JobDetails";

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <main className="space-y-8">
      <JobDetails jobId={jobId} />
    </main>
  );
}
