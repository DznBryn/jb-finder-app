import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const session_id = searchParams.get("session_id");
  if (!session_id) {
    return NextResponse.json(
      { detail: "session_id required" },
      { status: 400 }
    );
  }
  const url = `${getBackendUrl("/api/checkout/fulfill")}?session_id=${encodeURIComponent(session_id)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getBackendHeaders(false),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
