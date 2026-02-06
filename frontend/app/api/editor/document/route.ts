import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const url = queryString ? `${getBackendUrl("/api/editor/document")}?${queryString}` : getBackendUrl("/api/editor/document");
  const res = await fetch(url, {
    headers: getBackendHeaders(false),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
