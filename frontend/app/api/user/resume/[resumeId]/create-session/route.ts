import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";
import { authOptions } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resumeId } = await params;
  if (!resumeId) {
    return NextResponse.json(
      { error: "Missing resume id" },
      { status: 400 }
    );
  }

  console.log("resumeId", resumeId);
  console.log("userId", userId);

  const url = `${getBackendUrl(`/api/user/resume/${encodeURIComponent(resumeId)}/create-session`)}?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getBackendHeaders(false),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || "Failed to create session from resume" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
