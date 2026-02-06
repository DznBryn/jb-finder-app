import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getBackendUrl, getBackendHeadersForm } from "@/lib/backendClient";

// Allow enough time for backend to process upload (Vercel default is 10s on Hobby).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // Ensure backend gets user_id when user is logged in (client may not send it yet).
    const session = await getServerSession(authOptions as any);
    const userId = (session as { user?: { id: string } })?.user?.id;
    if (userId) {
      formData.set("user_id", userId);
    }
    const headers = getBackendHeadersForm();
    const url = getBackendUrl("/api/resume/upload");
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
    const text = await res.text();
    if (!res.ok) {
      return new NextResponse(text || "Upload failed.", { status: res.status });
    }
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json(
        { error: "Invalid response from upload service" },
        { status: 502 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
    console.error("[api/resume/upload] backend unreachable:", message, code || "", "url:", getBackendUrl("/api/resume/upload"));
    return NextResponse.json(
      { error: "Upload service unavailable. Check API_BASE and backend." },
      { status: 502 }
    );
  }
}
