import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const jobId = searchParams.get("job_id");
  if (!sessionId || !jobId) {
    return NextResponse.json(
      { error: "session_id and job_id required" },
      { status: 400 }
    );
  }
  const url = `${getBackendUrl("/api/resume/review/latest")}?session_id=${encodeURIComponent(sessionId)}&job_id=${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getBackendHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
