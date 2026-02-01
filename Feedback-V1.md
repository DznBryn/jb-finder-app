# Feedback V1

This document records the Executive Summary feedback from the system design/code
review and the actions taken in the codebase.

---

## Executive Summary Review

1. **Open wallet vulnerability (LLM endpoints)**  
   LLM-powered endpoints can be abused without request throttling, creating
   unexpected costs.

2. **Session hijacking risk**  
   `session_id` lives in `localStorage`; if leaked/guessed, it can be replayed.

3. **Refresh scalability risk (`upsert_jobs`)**  
   Building a large in-memory list of IDs and using `NOT IN` can degrade or fail
   at scale.

4. **SQLite concurrency risk**  
   SQLite locks on writes; parallel requests can block each other.

5. **Frontend data store size**  
   A single React Context carries many unrelated concerns and can cause heavy
   re-renders.

---

## Applied Changes (V1)

1. **Rate limiting guardrails (best-effort, in-memory)**  
   Added a lightweight, dependency-free throttle for expensive LLM endpoints to
   reduce abuse risk without introducing paid-tier limits.

2. **Refresh scalability fix**  
   Replaced the `NOT IN` list approach with a timestamp-based refresh strategy.
   Jobs updated during a refresh stay active; everything older gets marked
   inactive.

---

## Pending / Not Implemented Yet

1. **Database migration to PostgreSQL**  
   Requires Docker/infra changes and a data migration path.

2. **Frontend data fetching refactor (React Query / TanStack Query)**  
   A larger refactor to reduce `session-context` pressure and rerenders.

3. **Session hijacking hardening**  
   Move from `localStorage` UUIDs to secure, server-issued auth (cookie/JWT).

---

## Auth Migration Note (Session ID → User ID)

When Auth is introduced, **all session-scoped references should migrate to
`user_id`**. This includes database tables, API parameters, and cached storage.
We should preserve a migration path by either:

- Backfilling `user_id` when a session becomes authenticated, or
- Mapping `session_id` to `user_id` in a dedicated linking table during rollout.

