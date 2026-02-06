import AuthLayout from "@/components/AuthLayout";
import "../styles/globals.css";
import Providers from "./providers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { normalizeResumesPayload } from "@/lib/resumes";
import type { UserBase, UserResume, UserResumesPayload } from "@/type";
import { getBackendHeaders, getBackendUrl } from "@/lib/backendClient";

export const metadata = {
  title: "hyreme.io (hire me)",
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
    const headers = getBackendHeaders(false);
    try {
      const [baseRes, resumeRes] = await Promise.all([
        fetch(
          `${getBackendUrl("/api/user/base")}?user_id=${encodeURIComponent(userId)}`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${getBackendUrl("/api/user/resumes")}?user_id=${encodeURIComponent(userId)}`,
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
    } catch {}
  }

  return (
    <html lang="en">
      <body className="w-full h-auto">
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
