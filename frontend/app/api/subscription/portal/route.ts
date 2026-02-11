import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = (await getServerSession(authOptions as never)) as {
    user?: { id?: string };
  } | null;

  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getBackendUrl("/api/subscription/portal");
  const res = await fetch(url, {
    method: "POST",
    headers: getBackendHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = (data.detail as string) || (await res.text()) || "Failed to create portal session";
    return NextResponse.json({ error: detail }, { status: res.status });
  }

  const data = (await res.json()) as { url: string };
  return NextResponse.json(data);
}
