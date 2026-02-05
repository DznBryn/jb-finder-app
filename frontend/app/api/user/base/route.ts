import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions as any);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const apiKey = process.env.BACKEND_INTERNAL_API_KEY ?? "";

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-Internal-API-Key"] = apiKey;
  }

  const url = `${apiBase}/api/user/base?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { headers, cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || "Failed to load user base" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
