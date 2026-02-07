import { NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders } from "@/lib/backendClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ?? "200";
    const url = getBackendUrl(`/api/filters/locations?limit=${limit}`);
    const res = await fetch(url, {
      headers: getBackendHeaders(false),
      cache: "no-store",
    });
    
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    
    console.error("[api/filters/locations]", err);
    
    return NextResponse.json(
      { error: "Filters service unavailable. Check API_BASE and backend." },
      { status: 502 }
    );
  }
}
