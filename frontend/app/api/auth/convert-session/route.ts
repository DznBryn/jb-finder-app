import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { appPool } from "@/lib/db";

type ConvertPayload = {
  session_id?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions as any);
  const userId = (session as { user?: { id: string } }).user?.id;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ConvertPayload;
  const sessionId = body.session_id;

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }


  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await appPool.connect();
  try {
    await client.query("BEGIN");

    const sessionRow = await client.query(
      "SELECT * FROM resume_sessions WHERE id = $1",
      [sessionId]
    );
    if (sessionRow.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    const s = sessionRow.rows[0] as Record<string, unknown>;
    if (s.expires_at && new Date(s.expires_at as string) < new Date()) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Session expired" },
        { status: 410 }
      );
    }

    await client.query(
      "UPDATE resume_sessions SET user_id = $1 WHERE id = $2",
      [userId, sessionId]
    );
    await client.query(
      "UPDATE job_selections SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL",
      [userId, sessionId]
    );
    await client.query(
      "UPDATE deep_analysis SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL",
      [userId, sessionId]
    );
    await client.query(
      "UPDATE cover_letter_documents SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL",
      [userId, sessionId]
    );
    await client.query(
      "UPDATE cover_letter_versions SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL",
      [userId, sessionId]
    );
    await client.query(
      "UPDATE analysis_usage SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL",
      [userId, sessionId]
    );

    // Copy session data into resumes (user-scoped; no session_id, no plan)
    await client.query(
      `INSERT INTO resumes (
        id, user_id, resume_text, resume_s3_key, resume_content_hash,
        extracted_skills, inferred_titles, seniority, years_experience,
        location_pref, remote_pref, llm_summary, first_name, last_name,
        email, phone, location, social_links, created_at,
        daily_selections, daily_selection_date
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17::jsonb, $18::timestamp, $19, $20
      )`,
      [
        userId,
        s.resume_text ?? "",
        s.resume_s3_key ?? null,
        s.resume_content_hash ?? null,
        JSON.stringify(s.extracted_skills ?? []),
        JSON.stringify(s.inferred_titles ?? []),
        s.seniority ?? "mid",
        Number(s.years_experience ?? 0),
        s.location_pref ?? null,
        s.remote_pref ?? null,
        s.llm_summary ?? null,
        s.first_name ?? null,
        s.last_name ?? null,
        s.email ?? null,
        s.phone ?? null,
        s.location ?? null,
        JSON.stringify(s.social_links ?? []),
        s.created_at ?? new Date(),
        Number(s.daily_selections ?? 0),
        s.daily_selection_date ?? null,
      ]
    );

    // Signup bonus and plan on users (plan moved from session to user)
    const bonus = await client.query(
      `UPDATE next_auth.users
       SET one_time_credits = COALESCE(one_time_credits, 0) + 100,
           signup_bonus_granted_at = NOW(),
           plan = COALESCE($2, 'free')
       WHERE id = $1 AND signup_bonus_granted_at IS NULL
       RETURNING id`,
      [userId, s.plan ?? "free"]
    );
    // Ensure plan is set even if bonus was already granted (e.g. returning user)
    if (bonus.rowCount === 0) {
      await client.query(
        `UPDATE next_auth.users SET plan = COALESCE($2, 'free') WHERE id = $1`,
        [userId, s.plan ?? "free"]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({
      status: "ok",
      bonus_granted: bonus.rowCount === 1,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { error: "Conversion failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
