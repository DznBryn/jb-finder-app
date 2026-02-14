import Link from "next/link";

export const metadata = {
  title: "Support | hyreme.io",
  description: "Get help and support for hyreme.io.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold text-white md:text-3xl">
        Support
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        How we can help
      </p>

      <div className="mt-8 space-y-6 text-sm text-slate-300">
        <section>
          <h2 className="text-base font-semibold text-white">
            Getting Started
          </h2>
          <p className="mt-2">
            Upload your resume (PDF or DOCX) to get matched with jobs. Use
            filters to refine results, then analyze selections and save jobs for
            assisted apply. Sign in with Google or LinkedIn to save your
            progress across devices.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            Support Scope
          </h2>
          <p className="mt-2">Support covers:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Account access issues</li>
            <li>Billing and credit questions</li>
            <li>Feature functionality clarification</li>
          </ul>
          <p className="mt-3">Support does not cover:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Resume writing advice</li>
            <li>Employment counseling</li>
            <li>Job placement assistance</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            Frequently Asked Questions
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-2 text-slate-300">
            <li>
              <strong className="text-slate-200">Resume not parsing?</strong>{" "}
              Ensure your file is PDF or DOCX and under the size limit. Try
              re-uploading or a different browser.
            </li>
            <li>
              <strong className="text-slate-200">No matches showing?</strong>{" "}
              Broaden title terms or adjust filters. Reload matches after
              changing filters.
            </li>
            <li>
              <strong className="text-slate-200">Apply / analysis errors?</strong>{" "}
              Check that you have an active session and, if required, sufficient
              credits. Sign in if prompted.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">Contact</h2>
          <p className="mt-2">
            Support requests can be submitted via:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
            <li>Submit a support request through the in-app form</li>
            <li>Message us on LinkedIn: <a href="https://www.linkedin.com/company/hyreme-io" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">HyreMe.io</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            Response Time
          </h2>
          <p className="mt-2">
            Hyreme.io support response target: 24–72 hours. Billing issues are
            prioritized.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">
            Refund Policy
          </h2>
          <p className="mt-2">
            All payments are final. No refunds for unused credits or partial
            subscription periods.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white">Related</h2>
          <ul className="mt-2 flex flex-wrap gap-4">
            <li>
              <Link
                href="/privacy"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Terms of Service
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
