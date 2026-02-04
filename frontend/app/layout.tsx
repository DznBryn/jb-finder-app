import AuthLayout from "@/components/AuthLayout";
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
  return (
    <html lang="en">
      <body className="w-full h-full">
        <Providers>
          <AuthLayout>{children}</AuthLayout>
        </Providers>
      </body>
    </html>
  );
}
