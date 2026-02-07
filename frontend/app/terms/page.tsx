import Link from "next/link";

export const metadata = {
  title: "Terms of Service | hyreme.io",
  description: "Terms of service for hyreme.io.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold text-white md:text-3xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-xs text-slate-500">
        Last updated: {new Date().toLocaleDateString("en-US")}
      </p>

      <div className="mt-8 space-y-6 text-sm text-slate-300">
        <section>
          <h2 className="text-base font-semibold text-white">
            1. Overview
          </h2>
          <p className="mt-2">
            This Terms of Service (“Terms”) governs access to and use of the Job
            Finder web application (“Service”). By accessing or using the
            Service, you agree to these Terms.
          </p>
          <p className="mt-2">
            The Service provides job discovery, resume analysis, and AI-assisted
            application preparation tools. The Service does not submit job
            applications on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            2. Eligibility
          </h2>
          <p className="mt-2">
            You must be at least 18 years old and legally able to enter into
            binding contracts to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            3. Description of Service
          </h2>
          <p className="mt-2">The Service allows users to:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Upload resumes for parsing and analysis</li>
            <li>
              View job matches sourced from public job boards from companies we know are hiring
            </li>
            <li>
              Generate AI-assisted resume insights and cover letter drafts
            </li>
            <li>
              Prepare materials for manual job application submission
            </li>
          </ul>
          <p className="mt-3">You acknowledge that:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>All application submissions are completed by you</li>
            <li>
              The Service does not guarantee interviews, job offers, or
              employment outcomes
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            4. AI-Generated Content Disclaimer
          </h2>
          <p className="mt-2">AI-generated outputs are:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>
              Based solely on information you provide and public job
              descriptions
            </li>
            <li>Provided for informational and drafting assistance only</li>
          </ul>
          <p className="mt-2">
            You are responsible for reviewing, editing, and validating all
            generated content before use.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            5. User Data & Sessions
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>Guest sessions are temporary and expire after a limited period</li>
            <li>Creating an account links session data to your user profile</li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            6. Payments & Credits
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>Payments are processed securely via Stripe</li>
            <li>Credits represent prepaid usage of AI features</li>
            <li>Subscription credits expire at the end of each billing cycle</li>
            <li>One-time purchased credits do not expire</li>
            <li>Credits are non-refundable and non-transferable</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            7. Acceptable Use
          </h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Abuse or attempt to bypass rate limits or credit enforcement</li>
            <li>Reverse engineer or misuse AI outputs</li>
            <li>
              Use the Service for unlawful, deceptive, or fraudulent purposes
            </li>
            <li>Scrape, resell, or redistribute job data or Service outputs</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            8. Service Availability
          </h2>
          <p className="mt-2">
            The Service is provided on an “as-is” and “as-available” basis. We
            may modify or discontinue features at any time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            9. Limitation of Liability
          </h2>
          <p className="mt-2">
            To the maximum extent permitted by law, we are not liable for:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Employment outcomes</li>
            <li>Lost opportunities</li>
            <li>Indirect or consequential damages</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            10. Changes to Terms
          </h2>
          <p className="mt-2">
            We may update these Terms from time to time. Continued use of the
            Service constitutes acceptance of updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">11. Contact</h2>
          <p className="mt-2">
            For questions about these Terms, please contact us via the Support
            page.
          </p>
        </section>
      </div>
    </main>
  );
}
