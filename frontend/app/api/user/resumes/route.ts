import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions as any) as { user?: { id?: string } };
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = `${getBackendUrl("/api/user/resumes")}?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: getBackendHeaders(false),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || "Failed to load user resumes" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
