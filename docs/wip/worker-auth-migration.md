# Worker Auth Migration: WORKER_SECRET → ORCHESTRATOR_API_KEY

## Status: COMPLETE

Migrate worker-to-orchestrator authentication from a shared `WORKER_SECRET` to per-org orchestrator API keys. Also rename `WORKER_ORG` / `X-Worker-Org` to `STEP_PREFIX` / `X-Step-Prefix` to reflect their actual purpose (step prefix filtering, not org identity).

---

## Problem

`WORKER_SECRET` is a single shared secret across all workers and all orgs. If compromised:
- Any caller can poll tasks for any org (`X-Worker-Org` is self-declared, unverified)
- Any caller can attach documents to any work record (no org cross-check)
- Any caller can mark any task complete or failed

The orchestrator already has a per-org API key system (`Api_keys` model, `validateApiKey()` in `auth.js`). Workers already have `ORCHESTRATOR_API_KEY` / `ORCHESTRATOR_API_SECRET` in their `.env` — these just aren't wired up to the worker endpoints yet.

`X-Worker-Org` / `WORKER_ORG` are misleadingly named. Their actual purpose is step prefix filtering for custom org steps (e.g. `alex/fetch_data`), not org identity. Org identity should come from the API key record.

---

## Solution

1. Worker endpoints use `validateApiKey()` — org derived from `key_record.org` in DB
2. Remove shared `WORKER_SECRET` from both sides
3. Add org cross-checks in mutating endpoints (attach-document, complete, failed)
4. Rename `WORKER_ORG` → `STEP_PREFIX` and `X-Worker-Org` → `X-Step-Prefix`

---

## Repos Affected

- `apps/orchestrator.finopsbricks.com` — primary auth change
- `lib/lib-worker` — send new headers, use renamed env vars
- `workers/*` — env var rename in `.env` files

---

## Implementation

### Phase 1: Orchestrator — Update Worker Auth ✅

- [x] Update `workerAuth.js` to call `validateApiKey()` from `auth.js` instead of comparing bearer token to `WORKER_SECRET`
- [x] Derive org from `key_record.org`, not `X-Worker-Org` header
- [x] Keep reading `X-Step-Prefix` header (renamed from `X-Worker-Org`) and return it for use by poll route
- [x] In `poll/route.js`: use `key_record.org` for queue filter, use `X-Step-Prefix` for step prefix filtering (no change to step prefix logic)
- [x] In `attach-document/route.js`: add org cross-check — reject if `work_record.org !== key_record.org`
- [x] In `attach-report/route.js`: add org cross-check — reject if `work_record.org !== key_record.org`
- [x] In `complete/route.js`: add org cross-check — reject if `task.org !== key_record.org`
- [x] In `failed/route.js`: add org cross-check — reject if `task.org !== key_record.org`
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

---

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/utils/api/workerAuth.js` | orchestrator | Replaced shared secret check with `validateApiKey()`, returns `org`/`step_prefix` |
| `src/app/api/worker/poll/route.js` | orchestrator | `key_record.org` for queue filter, `X-Step-Prefix` header |
| `src/app/api/worker/attach-document/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/attach-report/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/complete/route.js` | orchestrator | Added org cross-check |
| `src/app/api/worker/failed/route.js` | orchestrator | Added org cross-check |
| `src/instrumentation.js` | orchestrator | Removed `WORKER_SECRET` from required env vars |
| `.env.example` | orchestrator | Removed `WORKER_SECRET` |
| `src/worker.js` | lib-worker | `api-key`/`api-secret` headers, `X-Step-Prefix` header, log rename |
| `src/orchestrator.js` | lib-worker | `api-key`/`api-secret` headers |
| `src/validate-env.js` | lib-worker | Replaced `WORKER_SECRET`/`WORKER_ORG` with `ORCHESTRATOR_API_KEY`/`ORCHESTRATOR_API_SECRET`/`STEP_PREFIX` |
| `.env.example` | lib-worker | Replaced `WORKER_SECRET`/`WORKER_ORG` with new vars |
| `.env` / `.env.example` | workers/* | Renamed `WORKER_ORG` → `STEP_PREFIX`, removed `WORKER_SECRET` |

---

## Notes

- `X-Step-Prefix` is kept — still needed for routing custom step slugs like `alex/fetch_data`
- Org is now authoritative from the API key record, not self-declared
- No DB schema changes needed — existing `Api_keys` table and `validateApiKey()` are ready
- Workers already had `ORCHESTRATOR_API_KEY` / `ORCHESTRATOR_API_SECRET` provisioned in `.env`
