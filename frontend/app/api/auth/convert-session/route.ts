import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { appPool } from "@/lib/db";

type ConvertPayload = {
  session_id?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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

  const userId = session.user.id;
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");

    const sessionRow = await client.query(
      "SELECT id, expires_at, user_id FROM sessions WHERE id = $1",
      [sessionId]
    );
    if (sessionRow.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    const sessionRecord = sessionRow.rows[0];
    if (sessionRecord.expires_at && new Date(sessionRecord.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Session expired" },
        { status: 410 }
      );
    }

    await client.query(
      "UPDATE sessions SET user_id = $1 WHERE id = $2",
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

    const bonus = await client.query(
      `UPDATE auth.users
       SET one_time_credits = COALESCE(one_time_credits, 0) + 100,
           signup_bonus_granted_at = NOW()
       WHERE id = $1 AND signup_bonus_granted_at IS NULL
       RETURNING id`,
      [userId]
    );

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
