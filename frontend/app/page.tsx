import HomepageClient from "../components/HomePage";

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

export default async function HomePage() {
  // Redirect to /auth/signin if user is not logged in (server-side check)

  

  return (
      <div className="space-y-6 w-full max-w-full mx-auto">
        {/* <section className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="Explainable matching"
            description="See why a role is a strong, medium, or weak fit with clear reasoning."
          />
          <FeatureCard
            title="Fast assisted apply"
            description="Generate a tailored cover letter on Pro and open the employer link."
          />
          <FeatureCard
            title="Privacy-first"
            description="We assist you. You submit. No credential storage or automation."
          />
        </section> */}
        <HomepageClient />
      </div>

  );
}
