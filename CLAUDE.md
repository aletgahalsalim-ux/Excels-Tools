# CLAUDE.md — AI Financial Document Intelligence Platform

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## هوية المشروع

منصة SaaS تستقبل ملفات Excel لنماذج مالية معقدة وتقوم بـ: فهم بنيتها الكاملة (شيتات، جداول، صيغ، علاقات) → التحقق المالي والمنطقي → توليد مستندات احترافية (DOCX/HTML الآن، PDF/PPTX لاحقاً) — عبر طبقة AI Agents متخصصة (12 وكيلاً مسجلاً، 4 مفعّلة في MVP) وليس نموذجاً عاماً واحداً.

مصدر الحقيقة التشغيلي: `docs/context-pack.md` (القرارات + القاموس الموحد) و`docs/decision-log.md`. أي تغيير على قرار معتمد يُسجَّل في decision-log بصيغة: التاريخ | القديم | الجديد | السبب.

## Architecture

npm-workspaces monorepo, three runtimes:

- **`apps/api`** — NestJS + Prisma (PostgreSQL). Everything except Excel parsing:
  - `src/ai/` — the AI layer: unified provider interface (`AI_PROVIDER=anthropic|mock`), Planner (decides which agents run), AgentRunner (prompt from DB → provider → Output Validator → AgentRun record with tokens/cost/latency), Orchestrator (persists agent outputs).
  - `src/files/pipeline.service.ts` — BullMQ worker driving: uploaded → analyzing (calls Python engine) → analyzed → agents_running → completed|failed.
  - `src/documents/` — DOCX (docx lib) + HTML builders, bilingual with full RTL.
  - `prisma/seed-data/` — agent registry, versioned prompts, validation rules, runtime config. **Prompts and rules live in the DB, never in code.**
- **`services/excel-analyzer`** — Python 3.12 FastAPI + openpyxl. Deterministic engine: table detection (flood fill + header heuristics), merged cells, formula dependency graph, anomaly detection (circular/hardcoded/broken/dead). Contract: `packages/shared/schemas/analysis-result.schema.json`.
- **`apps/web`** — Next.js App Router + next-intl. Arabic RTL is the default locale.
- **`apps/mobile`** — Expo/React Native (Android+iOS), expo-router. Same REST API + `@afdip/shared`; social login via `?client=mobile` → `afdip://auth` deep link. Typecheck: `npm run typecheck -w apps/mobile`. Deploy/stores: `docs/deployment.md`.
- **`packages/shared`** — TS types + JSON Schemas shared across all three. Change the contract here first.

## Commands

```bash
# infra (docker path)             # infra (no-docker path, e.g. this cloud env)
docker compose up -d              sudo pg_ctlcluster 16 main start && sudo redis-server --daemonize yes

npm install
npm run db:migrate -w apps/api    # prisma migrate deploy (dev: npx prisma migrate dev)
npm run db:seed -w apps/api       # requires DATABASE_URL

# excel analyzer
cd services/excel-analyzer && python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --port 8100        # run
.venv/bin/python -m pytest                        # tests (single: -k test_name)

# api & web
npm run build                     # shared + api + web
npm test -w apps/api              # Jest (single: npx jest -t "name" in apps/api)
npm run dev:api                   # nest watch on :3001
npm run dev:web                   # next dev on :3000

# full e2e (needs api + analyzer + db + redis up)
./scripts/e2e-smoke.sh
```

Env: copy `.env.example`. `AI_PROVIDER=mock` runs the full pipeline deterministically without an API key; `anthropic` requires `ANTHROPIC_API_KEY`. `STORAGE_DRIVER=local|s3`.

## معايير الكود (لا تُخالَف)

- TypeScript strict في كل مكان؛ Python 3.12 للمحرك فقط.
- **لا Prompts داخل الكود** — جدول `PromptTemplate` بنسخ versioned (تعديل = نسخة جديدة، لا تعديل النسخة المفعّلة).
- كل استجابة وكيل تمر على `OutputValidatorService`: JSON Schema → فحص Hallucination (أرقام `evidence` و`keyFigures` يجب أن توجد حرفياً في الملف المصدر) → فحص فقدان البيانات.
- كل تشغيل وكيل يسجل tokens/cost/latency في `AgentRun`.
- القواعد المالية في جدول `Rule` (Rules Engine) — ممنوع دفنها في الكود.
- الإعدادات القابلة للتغيير (حجم الملف، النماذج، المهل) في جدول `AppConfig` — ليست ثوابت.
- أسماء الكيانات تطابق القاموس: Workbook (UploadedFile), Sheet, DetectedTable, ValidationResult, GeneratedDocument, AgentDefinition, Planner.
- أي نص يظهر للمستخدم يدعم العربية RTL + الإنجليزية (رسائل الوكلاء ثنائية اللغة: `message`/`messageAr`).
- تفعيل وكيل جديد = تسجيله في seed الـ Registry + prompt + تفعيل `active` — بدون تعديل بنية الكود؛ منطق التوجيه في `PlannerService`.

## Scope tags

كل عنصر يحمل وسم نطاق: **[MVP]** (مبني الآن) · **[Phase 2]** (الوكلاء الـ8 الباقون، PDF/PPTX، Multi-provider fallback، Workflow/Approvals، Integration Hub) · **[Phase 3]** (Knowledge Graph). المؤجل مسجل في decision-log — صمِّم بما لا يغلقه.
