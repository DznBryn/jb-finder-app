import "../styles/globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Job Finder",
  description: "Upload a resume, get matched, and apply faster.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout wraps all pages with global styles and layout container.
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <div className="mx-auto max-w-full px-6 py-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
