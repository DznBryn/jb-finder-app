import "../styles/globals.css";

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
        <div className="mx-auto max-w-7xl px-6 py-10">{children}</div>
      </body>
    </html>
  );
}
