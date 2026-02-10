import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { resume_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const resumeIds = Array.isArray(body.resume_ids)
    ? body.resume_ids.filter((id): id is string => typeof id === "string")
    : [];

  const url = getBackendUrl("/api/user/resumes/delete");
  const res = await fetch(url, {
    method: "POST",
    headers: getBackendHeaders(),
    body: JSON.stringify({ user_id: userId, resume_ids: resumeIds }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || "Failed to delete resumes" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
