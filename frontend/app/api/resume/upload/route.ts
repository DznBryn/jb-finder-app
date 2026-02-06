import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeadersForm } from "@/lib/backendClient";

export async function POST(request: NextRequest) {
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
    return new NextResponse(text, { status: res.status });
  }
  return NextResponse.json(JSON.parse(text));
}
