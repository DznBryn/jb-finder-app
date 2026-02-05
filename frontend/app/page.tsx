import { authOptions } from "@/lib/auth";
import HomepageClient from "../components/HomePage";
import { getServerSession } from "next-auth/next";



export async function printSessionData() {
  const session = await getServerSession(authOptions as any);  
  console.log("Session data on homepage server:", session);
  // You can render or use the session as needed
  return null;
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  printSessionData();
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

export default function HomePage() {
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
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-white">Pricing</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 p-5">
              <h3 className="text-lg font-semibold text-slate-100">Free</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Up to 5 job selections per day</li>
                <li>Match tiers + reasons</li>
                <li>No cover letter generation</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
              <h3 className="text-lg font-semibold text-emerald-200">Pro</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li>Unlimited job selections</li>
                <li>Cover letter generation (tone selectable)</li>
                <li>Saved application history</li>
                <li>$15/month or $29 for 30 days</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

  );
}
