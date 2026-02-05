import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions as any) as { user?: { id?: string } };
  const user = session?.user;
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan: string; ui_mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const plan = body.plan;
  const ui_mode = body.ui_mode ?? "embedded";

  if (!plan) {
    return NextResponse.json(
      { error: "plan is required" },
      { status: 400 }
    );
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  const res = await fetch(`${apiBase}/api/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, ui_mode, user_id: userId }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: detail || "Checkout creation failed" },
      { status: res.status }
    );
  }

  const data = (await res.json()) as {
    client_secret?: string | null;
    checkout_url?: string | null;
  };
  return NextResponse.json(data);
}
