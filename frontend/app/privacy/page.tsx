import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | hyreme.io",
  description: "Privacy policy for hyreme.io.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold text-white md:text-3xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs text-slate-500">
        Last updated: {new Date().toLocaleDateString("en-US")}
      </p>

      <div className="mt-8 space-y-6 text-sm text-slate-300">
        <section>
          <h2 className="text-base font-semibold text-white">
            1. Information We Collect
          </h2>
          <p className="mt-2 font-medium text-slate-200">
            Information You Provide
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Resume content</li>
            <li>Contact details (email, name if provided)</li>
            <li>Job preferences</li>
          </ul>
          <p className="mt-3 font-medium text-slate-200">
            Automatically Collected
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Session identifiers</li>
            <li>Usage metrics (feature usage, credits consumed)</li>
            <li>Device and browser metadata</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            2. How We Use Information
          </h2>
          <p className="mt-2">We use your data to:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Provide and improve Service functionality</li>
            <li>Generate AI-assisted analyses and drafts</li>
            <li>Process payments and manage subscriptions</li>
            <li>Prevent abuse and enforce limits</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            3. AI Processing
          </h2>
          <p className="mt-2">
            Resume content and job descriptions may be processed by third-party
            AI providers solely to deliver requested features. Data is not used
            to train public AI models.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            4. Data Storage
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>Files are stored securely (e.g., cloud object storage)</li>
            <li>
              Session data expires automatically unless converted to a user
              account
            </li>
            <li>Payment data is handled exclusively by Stripe</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            5. Data Sharing
          </h2>
          <p className="mt-2">
            We do not sell personal data. Limited sharing occurs only with:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Payment processors (Stripe)</li>
            <li>Infrastructure providers (hosting, storage, analytics)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            6. Data Retention
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-300">
            <li>Guest sessions expire automatically</li>
            <li>
              Account data is retained until deleted by the user or required for
              legal compliance
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            7. Your Rights
          </h2>
          <p className="mt-2">You may request:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Access to your data</li>
            <li>Correction or deletion of your data</li>
            <li>Account deletion</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">8. Security</h2>
          <p className="mt-2">
            We use industry-standard security measures, but no system is 100%
            secure.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">9. Contact</h2>
          <p className="mt-2">
            For privacy-related questions or requests, please contact us through
            the Support page or the contact details provided there.
          </p>
        </section>
      </div>
    </main>
  );
}
