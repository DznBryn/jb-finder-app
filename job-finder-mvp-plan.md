---
name: job-finder-mvp-plan
overview: Living architecture + implementation plan for the Job Finder MVP, updated to reflect current build progress.
todos:
  - id: define-api-contracts
    content: Define request/response schemas for MVP endpoints.
    status: completed
  - id: diagram-architecture
    content: Draft a simple system diagram for data flow.
    status: completed
  - id: spec-matching
    content: Specify scoring weights and tier thresholds.
    status: completed
  - id: spec-data-model
    content: Finalize DB schema and session TTLs.
    status: completed
  - id: spec-monetization
    content: Define pricing tiers and Stripe integration.
    status: completed
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

## Monetization (MVP)

### Pricing Tiers

| Feature | Free | Pro |
|---------|------|-----|
| Job selections | 5/day | Unlimited |
| Job analysis (LLM grades) | 5/month (per IP) | 20/month |
| View match scores + reasons | Yes | Yes |
| Cover letter generation | No | Yes (unlimited) |
| Saved application history | No | Yes |
| Account persistence | No (24hr session) | Yes |
| **Price** | $0 | **$15/month** OR **$29 one-time (30 days)** |

### Payment Provider
- **Stripe** for subscriptions and one-time payments
- Stripe Checkout for payment flow (hosted, PCI-compliant)
- Webhooks for subscription lifecycle (created, renewed, cancelled)

### Cost Structure
- **OpenAI API**: ~$0.01-0.05 per cover letter (GPT-4/5)
- **AWS**: Minimal at MVP scale (~$50-100/month)
- **Margin**: At $15/mo with ~10 cover letters/user = ~$0.50 LLM cost = healthy margin

### Free Tier Limits
- Tracked per session (unauthenticated) or per user (authenticated)
- Daily reset at midnight UTC
- Redis counter: `selections:{session_id}:{date}` with TTL
- Analysis credits tracked monthly (per IP when unauthenticated)
### Pro Credits (Planned)
- 20 analysis credits per month (tracked per user)
- Later: sell add-on analysis credit packs

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
- FastAPI middleware + Redis

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

### Free Tier
- Select up to 5 jobs/day
- View match reasons
- Open apply link (no cover letter)

### Pro Tier
- Unlimited job selections
- For each selected job, user picks **cover letter tone**: formal / concise / technical
- Generate tailored cover letter via LLM (resume-truth enforced)
- Provide:
  - Copy-to-clipboard
  - Download as PDF/DOCX
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

- Persist locked `title_terms` on session to survive reloads without re-query.
- Add Alembic migrations so DB changes don't require deleting SQLite.
- Reintroduce job skill extraction + deterministic scoring.
- Expand filters UI (clear/reset, chips, saved filters).
- Harden Stripe Checkout + Webhook flows.
- Add basic analytics + error tracking.
- Add Redis + Celery for async ingestion and parsing (optional for MVP).
