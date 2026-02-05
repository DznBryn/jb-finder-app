import AuthLayout from "@/components/AuthLayout";
import "../styles/globals.css";
import Providers from "./providers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { normalizeResumesPayload } from "@/lib/resumes";
import type { UserBase, UserResume, UserResumesPayload } from "@/type";

export const metadata = {
  title: "Job Finder",
  description: "Upload a resume, get matched, and apply faster.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  let initialUserBase: UserBase | null = null;
  let initialResumes: UserResume[] | null = null;


  if (userId) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    const apiKey = process.env.BACKEND_INTERNAL_API_KEY ?? "";
    const headers: Record<string, string> = {};

    if (apiKey) headers["X-Internal-API-Key"] = apiKey;

    try {
      const [baseRes, resumeRes] = await Promise.all([
        fetch(
          `${apiBase}/api/user/base?user_id=${encodeURIComponent(userId)}`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${apiBase}/api/user/resumes?user_id=${encodeURIComponent(userId)}`,
          { headers, cache: "no-store" }
        ),
      ]);
      if (baseRes.ok) {
        initialUserBase = (await baseRes.json()) as UserBase;
      }
      if (resumeRes.ok) {
        const data = (await resumeRes.json()) as UserResumesPayload;
        initialResumes = normalizeResumesPayload(data);
      }
    } catch {
      // Ignore server-side fetch errors; client hydration will retry.
    }
  } else {
    initialUserBase = null;
    initialResumes = null;
    if (typeof window === "undefined") {
      const { redirect } = await import("next/navigation");
      redirect("/api/auth/signin");
    }
  }
  return (
    <html lang="en">
      <body className="w-full h-full">
        <Providers>
          <AuthLayout
            initialUserBase={initialUserBase}
            initialResumes={initialResumes}
          >
            {children}
          </AuthLayout>
        </Providers>
      </body>
    </html>
  );
}
