# Worker Auth Migration: WORKER_SECRET → ORCHESTRATOR_API_KEY

## Status: COMPLETE

Migrate worker-to-orchestrator authentication from a shared `WORKER_SECRET` to per-org orchestrator API keys. Also rename `WORKER_ORG` / `X-Worker-Org` to `STEP_PREFIX` / `X-Step-Prefix` to reflect their actual purpose (step prefix filtering, not org identity). Rename `step_queue.worker_org` column to `step_prefix`.

---

## Problem

`WORKER_SECRET` is a single shared secret across all workers and all orgs. If compromised:
- Any caller can poll tasks for any org (`X-Worker-Org` is self-declared, unverified)
- Any caller can attach documents to any work record (no org cross-check)
- Any caller can mark any task complete or failed

The orchestrator already has a per-org API key system (`Api_keys` model, `validateApiKey()` in `auth.js`). Workers already have `ORCHESTRATOR_API_KEY` / `ORCHESTRATOR_API_SECRET` in their `.env` — these just aren't wired up to the worker endpoints yet.

`X-Worker-Org` / `WORKER_ORG` are misleadingly named. Their actual purpose is step prefix filtering for custom org steps (e.g. `alex/fetch_data`), not org identity. Org identity should come from the API key record. The `step_queue.worker_org` column name has the same problem.

---

## Key Design Distinction

`Api_keys.org` stores the **org ID** (e.g. `jz6IzjiBwhke`).
`step_queue.step_prefix` stores the **step slug prefix** (e.g. `alex`, derived from `alex/fetch_data`).

These are two different representations of the same org and serve different purposes:
- `auth.org` (org ID from API key) — used for security cross-checks in mutating endpoints
- `auth.step_prefix` (slug prefix from `X-Step-Prefix` header) — used for queue routing in poll

---

## Solution

1. Worker endpoints use `validateApiKey()` — org derived from `key_record.org` in DB
2. Remove shared `WORKER_SECRET` from both sides
3. Add org cross-checks in mutating endpoints (attach-document, attach-report, complete, failed)
4. Rename `WORKER_ORG` → `STEP_PREFIX` and `X-Worker-Org` → `X-Step-Prefix`
5. Rename `step_queue.worker_org` column → `step_prefix`

---

## Repos Affected

- `apps/orchestrator.finopsbricks.com` — primary auth change + column rename
- `lib/lib-worker` — send new headers, use renamed env vars
- `workers/*` — env var rename in `.env` files
- `cli/` — aligned worker auth headers

---

## Implementation

### Phase 1: Orchestrator — Update Worker Auth ✅

- [x] Update `workerAuth.js` to call `validateApiKey()` from `auth.js` instead of comparing bearer token to `WORKER_SECRET`
- [x] Derive org from `key_record.org`, not `X-Worker-Org` header
- [x] Keep reading `X-Step-Prefix` header (renamed from `X-Worker-Org`) and return it for use by poll route
- [x] In `poll/route.js`: use `auth.step_prefix` (from `X-Step-Prefix` header) for queue filter; `auth.org` (org ID from API key) for cross-checks only
- [x] In `attach-document/route.js`: add org cross-check — reject if `work_record.org !== auth.org`
- [x] In `attach-report/route.js`: add org cross-check — reject if `work_record.org !== auth.org`
- [x] In `complete/route.js`: add org cross-check — reject if `task.org !== auth.org`
- [x] In `failed/route.js`: add org cross-check — reject if `task.org !== auth.org`
- [x] Remove `WORKER_SECRET` from orchestrator `.env.example`

### Phase 2: lib-worker — Update Headers and Env Vars ✅

- [x] Replace `Authorization: Bearer ${WORKER_SECRET}` with `api-key` / `api-secret` headers using `ORCHESTRATOR_API_KEY` / `ORCHESTRATOR_API_SECRET` in all fetch calls (`worker.js`, `orchestrator.js`)
- [x] Rename `X-Worker-Org` header → `X-Step-Prefix` in `worker.js` poll request
- [x] Update `validate-env.js`: replace `WORKER_SECRET` with `ORCHESTRATOR_API_KEY` + `ORCHESTRATOR_API_SECRET`, rename `WORKER_ORG` → `STEP_PREFIX`
- [x] Update `.env.example` accordingly

### Phase 3: Worker Repos — Rename Env Vars ✅

- [x] Rename `WORKER_ORG` → `STEP_PREFIX` in each `.env` and `.env.example`
- [x] Remove `WORKER_SECRET` from each `.env`

### Phase 4: Orchestrator — Remove Unused Artifacts ✅

- [x] Remove `WORKER_SECRET` from `instrumentation.js` required env vars list
- [x] Update stale header comments in `poll`, `attach-document`, `attach-report` routes
- [x] Confirmed no remaining `WORKER_SECRET` or `WORKER_ORG` references in `src/`
- [x] Note: `workerAuth.js` is retained — it is still the worker auth adapter (wraps `validateApiKey`, adds `worker_type` and `step_prefix` from headers)

### Phase 5: CLI — Align Worker Auth Headers ✅

- [x] `getWorkerConfig()`: replace `Authorization: Bearer` + `X-Worker-Org` with `api-key`/`api-secret` + `X-Step-Prefix`
- [x] `getOrchestratorConfig()`: remove `hasSecret`, replace `org` with `step_prefix`
- [x] `getRelevantEnvVars()`: remove `WORKER_SECRET`/`WORKER_ORG`, add `STEP_PREFIX`
- [x] `cli.js`: use `STEP_PREFIX` for local run `org_id` fallback

### Phase 6: Rename step_queue.worker_org → step_prefix ✅

- [x] `StepQueue.model.js`: rename field `worker_org` → `step_prefix`, update comment
- [x] `StepQueue.types.js`: rename `@property worker_org` → `step_prefix`
- [x] `processStepComplete.js`: rename variable and field reference
- [x] `executeProcess.js`: rename variable and field reference
- [x] `poll/route.js`: update SQL `AND step_prefix = :step_prefix`
- [x] `work-queue/route.js`: rename field in `StepQueue.create`
- [ ] **MANUAL**: Run DB migration

```sql
ALTER TABLE step_queue RENAME COLUMN worker_org TO step_prefix;
```

---

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/utils/api/workerAuth.js` | orchestrator | Replaced shared secret check with `validateApiKey()`, returns `org`/`step_prefix` |
| `src/app/api/worker/poll/route.js` | orchestrator | `step_prefix` for queue filter, org cross-check via `auth.org` |
| `src/app/api/worker/attach-document/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/attach-report/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/complete/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/failed/route.js` | orchestrator | Added org cross-check |
| `src/instrumentation.js` | orchestrator | Removed `WORKER_SECRET` from required env vars |
| `.env.example` | orchestrator | Removed `WORKER_SECRET` |
| `src/database/models/core/StepQueue.model.js` | orchestrator | Renamed `worker_org` → `step_prefix` |
| `src/types/database/core/StepQueue.types.js` | orchestrator | Renamed `worker_org` → `step_prefix` |
| `src/jobs/processStepComplete.js` | orchestrator | Renamed `worker_org` → `step_prefix` |
| `src/jobs/executeProcess.js` | orchestrator | Renamed `worker_org` → `step_prefix` |
| `src/app/api/v1/work-queue/route.js` | orchestrator | Renamed `worker_org` → `step_prefix` |
| `src/worker.js` | lib-worker | `api-key`/`api-secret` headers, `X-Step-Prefix` header, log rename |
| `src/orchestrator.js` | lib-worker | `api-key`/`api-secret` headers |
| `src/validate-env.js` | lib-worker | Replaced `WORKER_SECRET`/`WORKER_ORG` with `ORCHESTRATOR_API_KEY`/`ORCHESTRATOR_API_SECRET`/`STEP_PREFIX` |
| `.env.example` | lib-worker | Replaced `WORKER_SECRET`/`WORKER_ORG` with new vars |
| `.env` / `.env.example` | workers/* | Renamed `WORKER_ORG` → `STEP_PREFIX`, removed `WORKER_SECRET` |
| `src/utils/orchestrator.js` | cli | New auth headers, `step_prefix` in config |
| `src/utils/config.js` | cli | Removed `WORKER_SECRET`/`WORKER_ORG`, added `STEP_PREFIX` |
| `src/cli.js` | cli | Use `STEP_PREFIX` for local org_id |

---

## Deployment Checklist

- [ ] Deploy orchestrator
- [ ] Run DB migration: `ALTER TABLE step_queue RENAME COLUMN worker_org TO step_prefix;`
- [ ] Restart workers (pick up new lib-worker headers)
- [ ] Verify tasks are being claimed (check `claimed_at` is no longer NULL)
