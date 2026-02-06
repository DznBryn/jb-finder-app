import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeadersForm } from "@/lib/backendClient";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
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
    console.error("[api/resume/upload]", err);
    return NextResponse.json(
      { error: "Upload service unavailable. Check API_BASE and backend." },
      { status: 502 }
    );
  }
}
