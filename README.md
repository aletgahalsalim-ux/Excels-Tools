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
| Frontend | Next.js (App Router) · next-intl (ar RTL default / en) |
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

## Tests

```bash
npm test -w apps/api                                  # Jest — AI layer unit tests
cd services/excel-analyzer && .venv/bin/python -m pytest   # engine tests
./scripts/e2e-smoke.sh                                # full end-to-end (services must be up)
```

## Documentation

- `CLAUDE.md` — build guidance, code standards, commands
- `docs/context-pack.md` — project state, agents, unified glossary
- `docs/decision-log.md` — every approved decision (D-001 → D-013)
