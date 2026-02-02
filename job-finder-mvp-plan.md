---
name: job-finder-mvp-plan
overview: Living architecture + implementation plan for the Job Finder MVP, updated to reflect current build progress.
todos:
  - id: core-api-contracts
    content: Core API contracts implemented (upload, matches, analyze, deep analyze, greenhouse apply).
    status: completed
  - id: cover-letter-editor-v1
    content: AI Cover Letter Editor v1 (Lexical + ops/diff + versions + persistence).
    status: completed
  - id: postgres-local-dev
    content: Postgres local dev via docker-compose (instead of SQLite).
    status: completed
  - id: alembic-migrations
    content: Alembic added for schema migrations (+ initial migrations).
    status: completed
  - id: job-refresh-active-flag
    content: Track job activity with is_active; hide inactive roles from matches.
    status: completed
  - id: rate-limit-llm
    content: Rate limit expensive LLM endpoints (SlowAPI).
    status: completed
  - id: monetize-credits-spec
    content: Define pay-for-what-you-use credit strategy + subscriber top-up bonus rules.
    status: completed
  - id: credits-ledger-implementation
    content: Implement subscription_credits + one_time_credits buckets and server-side deduction/reserve caps.
    status: pending
  - id: stripe-topups-and-bonus
    content: Implement Stripe top-ups with subscriber bonus applied at purchase time.
    status: pending
  - id: auth-session-to-user
    content: Add auth and migrate session_id -> user_id with credit + data transfer.
    status: pending
  - id: deterministic-matching
    content: Reintroduce job skill extraction + deterministic scoring for matches.
    status: pending
---

# Job Finder MVP Architecture Plan

## Goals

- Translate the PRD into a concrete architecture and implementation approach.
- Define minimal data model, APIs, and services needed for the MVP flow.
- Keep scope aligned with constraints: no auto-apply, no scraping, no mandatory signup.

## Context from Auto-Apply Systems (Deferred)

- Full auto-apply pipelines typically include ingestion from scraped job boards, embeddings-based matching, per-job document generation, and browser automation (Playwright/Puppeteer) with tracking feedback loops.
- These capabilities are explicitly deferred in the MVP due to constraints: no scraping, no browser automation, and no auto-submit.
- We will structure interfaces so future automation can be added later without reworking MVP data models.

## Assumptions

- Repository is active with backend/frontend + docker-compose in place.
- Styling will use Tailwind CSS per user rule.

## User Types

### MVP
- **Job Seekers (type: U)**: Upload resume, view matches, complete assisted applications. Default type.

### Post-MVP
- **Recruiters (type: R)**: Search for candidates, view profiles (later: post jobs).
- **Employers (type: E)**: Company accounts, post jobs, manage applications (later).

Data model should include a `user_type` field from the start to support future expansion.

## Monetization (MVP) — Token-Based "Finder Credits"

### Core Concept: Pay-for-what-you-use

Instead of exposing raw LLM tokens (confusing to users), sell **"Finder Credits"**:
- **1 Credit ≈ 1,000 LLM tokens** (approx. 750 words).
- Users are charged based on the **actual** token usage of their request.
- **Why?** Fairer for users (short resume = cheaper) and safer for us (long resume = covered costs).

### Subscription Tiers (Monthly Allowance)

| Plan | Price | Monthly Allowance | Rollover? |
| :--- | :--- | :--- | :--- |
| **Job Seeker** (Basic) | **$9.99/mo** | **500 Credits** | No |
| **Power Applier** (Pro) | **$24.99/mo** | **2,500 Credits** | No |

### Top-Up Packs (One-Time)
*Encourage subscriptions by offering better rates to members.*

| Pack Price | Non-Subscriber | Subscriber (Bonus) |
| :--- | :--- | :--- |
| **$4.99** | **200 Credits** | **300 Credits** (+50%) |
| **$19.99** | **1,000 Credits** | **1,500 Credits** (+50%) |

**Credit policy:** One-time purchase credits never expire and do not reset each billing cycle. Subscription credits expire at the end of the billing period and are not converted on cancellation.

### Feature Cost Estimates (For User UI)
*Actual cost calculated post-generation.*

| Feature | Est. Credits | Notes |
| :--- | :--- | :--- |
| **Resume Parsing** | **Free** | Essential onboarding. |
| **Match Analysis** | **~5 Credits** | GPT-4o-mini equivalent. |
| **Deep Analysis** | **~15-90 Credits** | Varies heavily by job description length. |
| **Resume Tailoring** | **~20 Credits** | High context. |
| **Cover Letter Gen** | **~5-30 Credits** | Depends on length/iterations. |

### Payment Provider
- **Stripe** for subscriptions and one-time payments
- Stripe Checkout for payment flow (hosted, PCI-compliant)
- Webhooks for subscription lifecycle (created, renewed, cancelled)

### Implementation Strategy (Backend)

**Database updates:**
- Track credits as two buckets: `subscription_credits` and `one_time_credits`
- Rename `count` to `credits_used` in `AnalysisUsage`

**Usage service updates:**
- **Estimate**: Block if estimated cost exceeds available credits (sum of both buckets).
- **Reserve**: Apply a max reserve cap per request to avoid runaway usage.
- **Settle**: After LLM response, `credits = ceil(total_tokens / 1000)`. Deduct from DB.
- **Hard cap**: enforce a server-side token cap per request to avoid negative balances.
- **Top-Up**: Check subscription status at purchase time only before assigning credit amount.
- **Deduction order**: use `subscription_credits` first, then `one_time_credits`.
- **Renewal**: monthly subscription credits reset each cycle; one-time credits never expire.
- **Cancellation rule**: unused subscription credits expire at the end of the billing period (0% conversion).

### Implementation Strategy (Frontend)

- **Credit Balance Display:** Show total credits (subscription + one-time) in header
- **Cost Estimates:** "Analyze this job? (Est. ~5 Credits)", "Deep Analysis (Est. ~15-90 Credits)"
- **Out of Credits:** Trigger Stripe Checkout modal when balance is too low for an action. Highlight subscriber bonus.

### LLM Cost Control (Margins)

- **GPT-5.2** ($1.75/$14 per 1M tokens) is expensive
- **Optimization:** Use GPT-5-Standard ($1.25/$10) or cheaper reasoning model for "Match Analysis" (Grade A-D)
- Reserve expensive GPT-5.2 only for "Deep Analysis" and "Resume Tailoring" where quality is critical
- **Caching:** Deep analysis and resume reviews are cached by `job_id` + `session_id` so users don't pay twice for the same result

### Why This Model Works

- **Fairness:** Users pay for what they use. Heavy users cover their own API costs.
- **Scalability:** Lock in a margin (e.g., 50% markup on token costs) regardless of how heavy the usage is.
- **Flexibility:** Add new expensive features (e.g., "Mock Interview Chat") without changing plan prices—just set a higher credit cost for that feature.

## Authentication (Planned)

### Trigger + Incentive
- Show signup modal after resume parsing + first matches load.
- Incentive: **+100 one-time credits** on signup (grant once per user).

### Auth Provider
- **Auth.js** with Google + LinkedIn OAuth.
- Email + password sign-up (with verification) planned for later.
- Use **database-backed sessions** (not JWT) for server-side invalidation and TTL.

### Session → User Conversion
- Keep existing session tables; add nullable `user_id` fields for linkage.
- After OAuth success, call `POST /api/auth/convert-session`:
  - Link `session_id` to `user_id`.
  - Attach existing session-scoped data to the user.
  - Grant 100 one-time credits if not already granted.
- **Guest session TTL**: non‑signup sessions expire after 24 hours; conversion must occur before expiry or data is purged.

### Security Guardrails
- HttpOnly cookies, CSRF protection, OAuth state/PKCE.
- Session TTL enforced server-side; rotate sessions after sensitive events.
- If a session has `user_id`, only allow access when authenticated as that user.

### Subscription Credits Policy
- **0% conversion on cancel**: subscription credits expire at period end.
- One-time credits never expire.

## Tech Stack (Finalized)

### Frontend
- **Next.js** (App Router)
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Context API** for state (plan to migrate to Zustand if state grows)
- **Zod** for runtime validation

### Backend
- **Python + FastAPI**
- **OpenAI GPT-5** (abstracted for future multi-model support)
- **LLM safety layer**: prompt templates + Pydantic output validation + resume-truth checks (no hallucinated skills)
- **Pydantic** for request/response schemas

### Payments
- **Stripe** (subscriptions + one-time payments)
- Stripe Checkout (hosted payment page)
- Stripe Webhooks (subscription events)

### Database
- **Postgres + JSONB** (no MongoDB; JSONB handles semi-structured data)

### Storage
- **AWS S3** for all files (resumes, cover letters, generated docs)

### Queue / Workers
- **Celery + Redis** for async tasks (parsing, ingestion, doc generation)

### Scheduler
- **AWS ECS scheduled tasks** for daily job ingestion refresh

### Observability
- **stdout/stderr structured logs + AWS CloudWatch** (keep simple for MVP)

### CI/CD
- **GitHub Actions** (skip Jenkins)

### Infrastructure
- **Docker** containers
- **AWS** (ECS, RDS, S3, CloudWatch)
- **Redis** (sessions, rate limiting, Celery broker)

### Rate Limiting
- **SlowAPI** rate limiting (current)
- Add **Redis-backed** limiter for multi-instance production deployments

### Auth (Post-MVP)
- Plan for JWT or NextAuth when account conversion is added

## Proposed Architecture (High-Level)

- Frontend (Next.js): landing, resume upload, match list, job selection, assisted apply, and post-action signup prompt.
- Backend API gateway: handles upload, session profile, matching, and apply preparation.
- Services:
  - Resume parsing service (PDF/DOCX extraction + normalization).
- Job ingestion service (Greenhouse polling + de-dup + daily refresh).
  - Matching service (deterministic scoring + explainable reasons).
  - Assisted apply service (cover letter generation + download/copy payloads).
  - Payment service (Stripe integration, subscription management).
- Data stores:
  - Postgres + JSONB for jobs, companies, applications, sessions, and accounts.
  - Redis for session caching, rate limiting, and Celery task broker.
  - S3 for all file storage (resumes, cover letters, generated docs).

## Job Discovery (MVP)

### The Challenge
Greenhouse APIs require knowing company board tokens upfront — no global search.

### Solution: Hybrid Approach
1. **Curated seed list** (~50 companies): Pre-selected tech companies known to be hiring. Polled daily.
2. **User-specified companies** (optional): Users can add target companies they're interested in.
3. **Community expansion**: Grow the list over time based on user submissions.

### Implementation
- Seed list stored in `companies` table with board tokens.
- Users can suggest companies via simple form (stored for review).
- Industry-based suggestions possible later (e.g., "fintech" → Stripe, Plaid).

## Job Ingestion (MVP)

### ATS Sources
Only **Greenhouse** public API (no auth required) for MVP:

| ATS | Endpoint Pattern | Notes |
|-----|------------------|-------|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs` | Most widely used |

### Implementation
- Shared `ATSAdapter` interface with Greenhouse implementation.
- Curated seed list: ~25 companies to start (validated).
- Daily refresh via ECS scheduled task.
- Deduplication on `source` + `source_job_id`.

### Data Extracted
- Job ID, title, location, department, description (HTML)
- Apply URL (for manual submission)
- Pay ranges from Greenhouse pay transparency endpoint
- Seniority inferred from title

## Architecture Diagram (MVP)

```mermaid
flowchart LR
  subgraph frontend [Frontend]
    webUI["Next.js + shadcn/ui"]
  end

  subgraph backend [Backend - FastAPI]
    apiGateway["API Gateway"]
    profileSvc["Profile Service"]
    jobsSvc["Jobs Service"]
    appsSvc["Applications Service"]
    paymentSvc["Payment Service"]
    llmLayer["LLM Safety Layer"]
  end

  subgraph external [External Services]
    stripe["Stripe"]
    openai["OpenAI API"]
  end

  subgraph infra [Infrastructure - AWS]
    postgres["Postgres (RDS)"]
    s3["S3 (files)"]
    redis["Redis (sessions/queue)"]
    celery["Celery Workers"]
    ecsScheduler["ECS Scheduled Tasks"]
    cloudwatch["CloudWatch Logs"]
  end

  webUI -->|"HTTPS"| apiGateway
  apiGateway --> profileSvc
  apiGateway --> jobsSvc
  apiGateway --> appsSvc
  apiGateway --> paymentSvc

  profileSvc --> llmLayer
  appsSvc --> llmLayer
  llmLayer --> openai

  paymentSvc --> stripe
  stripe -->|"webhooks"| paymentSvc

  profileSvc --> postgres
  jobsSvc --> postgres
  appsSvc --> postgres
  paymentSvc --> postgres

  profileSvc --> s3
  appsSvc --> s3

  celery --> redis
  celery --> jobsSvc
  celery --> profileSvc

  ecsScheduler -->|"daily refresh"| jobsSvc

  backend --> cloudwatch
```

## Data Model Outline

### Sessions (TTL: 24 hours)
- `id`: UUID
- `resume_text`: extracted text
- `resume_s3_key`: S3 path to original file
- `extracted_skills`: JSONB array
- `inferred_titles`: JSONB array
- `seniority`: string (junior/mid/senior/lead/executive)
- `location_pref`: string (optional filter)
- `remote_pref`: boolean (optional filter)
- `years_experience`: integer
- `daily_selections`: integer (reset daily, max 5 for free)
- `created_at`: timestamp
- `expires_at`: timestamp (created_at + 24h)
- `first_name`, `last_name`, `email`, `phone`, `location`, `social_links`

### Jobs
- `id`: UUID
- `company_id`: FK
- `title`: string
- `location`: string
- `remote`: boolean
- `seniority`: string
- `description`: text
- `pay_ranges`: JSONB array
- `source`: enum (greenhouse)
- `source_job_id`: string
- `apply_url`: string
- `updated_at`: timestamp

### Companies
- `id`: UUID
- `name`: string
- `greenhouse_board_token`: string (nullable)
- `website`: string (nullable)
- `user_suggested`: boolean (default: false)

### Matches (computed, cacheable)
- `session_id`: FK
- `job_id`: FK
- `score`: integer (0-100)
- `tier`: enum (strong, medium, weak)
- `reasons`: JSONB (why it matches)
- `missing_skills`: JSONB array

### Applications
- `id`: UUID
- `session_id`: FK (nullable after conversion)
- `user_id`: FK (nullable before conversion)
- `job_id`: FK
- `cover_letter_s3_key`: string (nullable for free tier)
- `cover_letter_tone`: enum (formal, concise, technical)
- `resume_variant_s3_key`: string (nullable, v1.1)
- `status`: enum (prepared, user_submitted)
- `created_at`: timestamp

### Users
- `id`: UUID
- `email`: string
- `user_type`: enum (U, R, E) — default: U (job seeker)
- `plan`: enum (free, pro) — default: free
- `stripe_customer_id`: string (nullable)
- `subscription_status`: enum (none, active, cancelled, past_due)
- `subscription_ends_at`: timestamp (nullable)
- `created_at`: timestamp

### Subscriptions (Stripe sync)
- `id`: UUID
- `user_id`: FK
- `stripe_subscription_id`: string
- `plan_type`: enum (monthly, one_time)
- `status`: enum (active, cancelled, past_due)
- `current_period_start`: timestamp
- `current_period_end`: timestamp
- `created_at`: timestamp

## API Surface (Current)

### Core Flow
- `POST /api/resume/upload` → returns session_id + parsed profile
- `GET /api/matches?session_id=...` → ranked jobs (initial load)
- `POST /api/matches` → ranked jobs with filters + LLM query (reload)
- `POST /api/jobs/select` → store selections (enforces 5/day limit for free)
- `POST /api/apply/prepare` → cover letter (Pro only) + download/copy payloads
- `POST /api/signup` → convert session to user

### Payments
- `POST /api/checkout/create` → returns Stripe Checkout session URL
- `POST /api/webhooks/stripe` → handle Stripe events (subscription created, cancelled, etc.)
- `GET /api/subscription/status` → returns current plan + limits
- `GET /api/jobs/selected` → list selected jobs for session

## Cover Letter Editor (AI-Assisted)

### Goal
Allow users to create, update, and delete cover letter content using AI with full user control via diffs, accept/reject, undo, and version history.

### Core UX
- Single document-first editor (plain text or markdown)
- AI never edits directly → it returns proposed changes
- User sees diff preview and chooses: Accept, Reject, Undo (via versions)

### Actions
- Generate from scratch (if empty; LLM must be grounded in resume facts + job context)
- Tailor to job
- Rewrite selection
- Shorten / expand
- Change tone
- Remove fluff

### Frontend
- Editor: Lexical (plain text editor surface with history + persistence)
- Diff viewer (word/line-level)
- Version list (timestamp, jobId)
- Inline selection support (optional v1)
- Draft persistence in DB, keyed by `session_id` + `job_id`

### Backend (FastAPI)
`POST /api/editor/suggest`

**Input**
```
{
  document_id,
  base_version_id,
  content,
  selection?,     // start/end indexes
  intent,         // e.g. "tailor", "shorten", "rewrite"
  constraints,    // tone, length
  job_context,
  resume_facts
}
```

**Output (STRICT)**
```
{
  base_hash,
  ops: [
    { type: "replace" | "insert" | "delete", start?, end?, pos?, text? }
  ],
  preview,
  diff,
  explanation,
  warnings
}
```

### Critical Design Rule
LLM outputs PATCHES, not raw text. Server applies edits, validates them, and stores accepted edits as new versions.

### Data Model
- `documents`: id, session_id, type, current_version_id
- `document_versions`: id, document_id, content, created_at, created_by, job_id
- Undo = load previous version

### AI Guardrails (Required)
- Only use facts from:
  - Resume facts
  - Job description
- No invented company metrics or achievements
- Enforce:
  - JSON schema validation
  - Edit bounds checks
  - Base version hash match
  - Max length (e.g., 250–400 words)
- If info is missing → write generic or flag warning

### MVP Scope (Build Order)
- Lexical editor + paste/edit
- /suggest API returning diff
- Tailor / rewrite / shorten actions
- Accept/reject changes
- Version history + undo

### v1 Enhancements
- Inline selection edits
- Section templates (opening, closing)
- Hallucination warnings
- Export (PDF later)

### Non-Goals (Now)
- Rich text formatting
- Autonomous agent editing
- External web/company research

### End-to-End Flow
```mermaid
sequenceDiagram
  participant User as User
  participant UI as CoverLetterDialog
  participant API as BackendAPI
  participant LLM as LLM

  User->>UI: Type_edit_draft
  UI->>API: Save_draft(session_id,job_id,content)

  User->>UI: Click_action(tailor_or_rewrite)
  UI->>API: POST_/api/editor/suggest(base_hash,content,intent,job_context,resume_facts)
  API->>LLM: Request_ops_only
  LLM-->>API: ops_preview_diff_warnings
  API->>API: Validate_apply_ops
  API-->>UI: ops_preview_diff_warnings

  User->>UI: Accept
  UI->>API: Save_new_version(document_id,content)
  User->>UI: Undo
  UI->>API: Load_previous_version
```

## Matching Heuristics (Current + Planned)

### Current (Implemented)
- LLM builds search query from inferred titles + filters
- Filters: title terms, location, work mode (remote/hybrid/in-office), pay range
- Seniority filter excludes ±2+ levels
- Score is currently a placeholder (skills extraction removed)

### Tier Thresholds
- **Strong**: score >= 90
- **Medium**: score >= 60
- **Weak**: score < 60

### Planned
- Add deterministic scoring once job skill extraction returns

## Assisted Apply UX Flow

### Credits-Based Access (Pay-for-what-you-use)
- No fixed “free vs pro” feature gates in the product flow.
- Users can select jobs and run actions as long as they have available credits.
- **Actions** (charged by actual `total_tokens` → credits):
  - Match analysis (A–D grade)
  - Deep analysis (missing skills + learning resources)
  - Resume review / tailoring
  - Cover letter editor suggestions (ops + diff)
- Assisted apply remains **manual submission only**:
  - Prefill Greenhouse forms where possible
  - Open employer application page (user manually submits)

## Compliance & Trust

- Always surface "We assist — you submit" messaging.
- No credential storage; only session-based info until signup.
- Explicit consent action per apply.

## Risks & Quality Gates (MVP-appropriate)

- Irrelevant matches → keep filters strict and make reasons visible.
- Hallucinated skills → enforce resume-truth checks during generation.
- Duplicate applications → dedupe on job source IDs and company+title+location.
- User control → allow opt-in selection only (no background apply).
- Payment fraud → use Stripe's built-in fraud protection.

## Repo Structure (Current)

```
jb-finder-app/
├── frontend/                # Next.js + shadcn/ui + Tailwind
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── backend/                 # Python + FastAPI
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   ├── services/        # Business logic (profile, jobs, applications, payments)
│   │   ├── schedulers/      # ATS ingestion + seed loaders
│   │   ├── services/llm     # LLM safety layer + prompt templates
│   │   ├── workers/         # Celery tasks (planned)
│   │   └── models/          # Pydantic schemas + DB models
│   ├── requirements.txt
│   └── Dockerfile
├── infra/                   # AWS CDK or Terraform (later)
├── docker-compose.yml       # Local dev (Postgres, Redis, etc.)
└── .github/workflows/       # GitHub Actions CI/CD
```

## Next Steps (Planned)

- Implement credits buckets + dynamic deduction (reserve cap + hard token caps; subscription credits expire monthly; one-time credits never expire).
- Implement Stripe subscription + top-up packs with subscriber bonus applied at purchase time only.
- Add “credits remaining” UI (header) + per-action estimates and post-action settlement receipts.
- Harden Stripe webhooks (idempotency, signature verification, and subscription state syncing).
- Add Redis (rate limiting + caching + future Celery broker).
- Reintroduce job skill extraction + deterministic scoring (reduce reliance on LLM for ranking).
- Expand filters UX (clear/reset, chips, saved filters).
- Add basic analytics + error tracking.
