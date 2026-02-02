import "../styles/globals.css";
import AppSidebar from "@/components/AppSidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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
          <AppSidebar />
          <main className="mx-auto max-w-full space-y-10">
            <SidebarTrigger />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
