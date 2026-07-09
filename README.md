# AI Financial Document Intelligence Platform

منصة SaaS تستقبل ملفات Excel لنماذج مالية معقدة، تفهم بنيتها بالكامل، تتحقق منها مالياً ومنطقياً، وتولّد تقارير احترافية (DOCX/HTML) بالعربية والإنجليزية — عبر طبقة وكلاء ذكاء اصطناعي متخصصة.

A SaaS platform that ingests complex financial Excel models, fully understands their structure, validates them financially and logically, and generates professional bilingual (AR/EN) reports — powered by a layer of specialized AI agents.

## What works today (MVP vertical slice)

Upload `.xlsx` → structure analysis (tables, headers, merged cells, formula dependency graph, anomaly detection) → AI agents (semantic classification, rules-based financial validation, anomaly explanation, executive summary) with anti-hallucination output validation → professional DOCX/HTML report, Arabic RTL or English.

## Stack

| Component | Technology |
|---|---|
| API | NestJS · Prisma · PostgreSQL · BullMQ/Redis |
| Excel Analysis Engine | Python 3.12 · FastAPI · openpyxl |
| Frontend (web) | Next.js (App Router) · next-intl (ar RTL default / en) |
| Mobile (Android + iOS) | Expo / React Native (`apps/mobile`) — same API + shared types |
| AI layer | Anthropic Claude behind a multi-provider interface (+ deterministic mock) |
| Storage | MinIO/S3 or local filesystem (`STORAGE_DRIVER`) |

## Quick start

```bash
cp .env.example .env

# 1. infrastructure
docker compose up -d postgres redis minio     # or native postgres/redis

# 2. install & database
npm install
npm run db:migrate -w apps/api
npm run db:seed -w apps/api                   # roles, 12-agent registry, prompts, rules

# 3. excel analysis engine
cd services/excel-analyzer
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --port 8100 &
cd ../..

# 4. api + web
npm run dev:api &     # http://localhost:3001/api/v1
npm run dev:web       # http://localhost:3000 (redirects to /ar)
```

Set `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` for real agent runs; the default `mock` provider runs the entire pipeline deterministically without a key.

## Social login (Google / Microsoft / Apple)

Email/password accounts work out of the box. Each social provider activates automatically once its credentials are set in `.env` (see `.env.example` for the exact redirect URIs to register):

| Provider | Where to create credentials | Env vars |
|---|---|---|
| Google | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) — OAuth client (Web) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft | [Azure Portal → App registrations](https://portal.azure.com) — any org + personal accounts | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Apple | [Apple Developer → Certificates, IDs & Profiles](https://developer.apple.com) — Services ID + Sign in with Apple key (paid account; HTTPS return URL required) | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

The login page shows a button only for configured providers (`GET /api/v1/auth/providers`). A social account with an email matching an existing local account is linked to it automatically.

## Tests

```bash
npm test -w apps/api                                  # Jest — AI layer unit tests
cd services/excel-analyzer && .venv/bin/python -m pytest   # engine tests
./scripts/e2e-smoke.sh                                # full end-to-end (services must be up)
```

## Mobile apps

```bash
cd apps/mobile
npm run start      # scan the QR with the Expo Go app (Android/iOS)
```

Store builds and submission via EAS — see `docs/deployment.md` §2.

## Production deployment

```bash
cp .env.example .env   # fill secrets + public URLs
docker compose -f docker-compose.prod.yml up -d --build
```

Full guide (TLS, OAuth redirect URIs, managed alternatives, store publishing): `docs/deployment.md`.

## Documentation

- `CLAUDE.md` — build guidance, code standards, commands
- `docs/context-pack.md` — project state, agents, unified glossary
- `docs/decision-log.md` — every approved decision (D-001 → D-013)
