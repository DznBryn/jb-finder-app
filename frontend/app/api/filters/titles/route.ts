import { NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function GET() {
  const url = getBackendUrl("/api/filters/titles");
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
