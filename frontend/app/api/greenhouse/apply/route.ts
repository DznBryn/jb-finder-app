import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = getBackendUrl("/api/greenhouse/apply");
  const res = await fetch(url, {
    method: "POST",
    headers: getBackendHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
