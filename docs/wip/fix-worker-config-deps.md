# Fix Worker Configuration and Dependency Issues

## Status: NOT STARTED

Fix pre-existing configuration and dependency issues across all customer workers discovered during the lib-worker extraction runtime verification. Issues include missing direct dependencies, outdated env var names, stale lib-worker version pins, and outdated auth patterns in `.env.example` files.

---

## Problem Statement

Runtime verification after the lib-worker domain extraction (see `extract-domain-libs.md`) revealed several pre-existing issues across workers:

1. **Missing direct dependencies** — Workers import packages (zod, ejs) that they don't declare, relying on transitive resolution that breaks unpredictably
2. **Outdated env var names** — Some `.env.example` files use `WORKER_ORG`, `STEP_PREFIX`, `ENGINE_URL`, or `WORKER_SECRET` instead of the current `WORKER_LOCATION`, `ORCHESTRATOR_URL`, and `ORCHESTRATOR_API_KEY`/`ORCHESTRATOR_API_SECRET`
3. **Stale lib-worker version pins** — Some workers reference old GitHub tags (`v0.15.0`, `v0.16.0`) instead of `file:` protocol for local development
4. **Stale AI deps in worker-emiritus** — Still has `ai` and `@openrouter/ai-sdk-provider` as direct deps (should use `@fob/lib-worker-ai` if needed)

### Impact

- Workers fail to boot or discover steps when npm hoisting changes
- New developers copy `.env.example` with wrong variable names and get silent failures
- Workers pinned to old lib-worker versions miss bug fixes and new features

## Scope

| Worker | Issues |
|--------|--------|
| **worker-agilitas** | `.env.example` uses `WORKER_ORG` and `WORKER_SECRET`; uses old `ENGINE_URL` |
| **worker-sankalp** | `.env.example` uses `WORKER_ORG` and `WORKER_SECRET`; pinned to `lib-worker#v0.15.0` |
| **worker-o2c** | Missing `zod` dep; `.env.example` uses `ENGINE_URL`; pinned to `lib-worker#v0.16.0` |
| **worker-emiritus** | Stale AI deps; no `.env.example`; pinned to `lib-worker#v0.15.0` |
| **worker-nowapps** | Missing `ejs` dep |
| **worker-template** | `.env.example` missing `WORKER_LOCATION`; pinned to `lib-worker#v0.15.0` |

---

## Implementation Phases

### Phase 1: Fix missing dependencies ❌

Add directly-imported packages that are missing from `package.json`:

- [ ] worker-o2c — add `zod` as direct dependency
- [ ] worker-nowapps — add `ejs` as direct dependency

### Phase 2: Standardize .env.example files ❌

Update all `.env.example` files to use current variable names. The authoritative pattern (from `lib-worker/src/validate-env.js` and `lib-worker/src/worker.js`):

| Variable | Purpose |
|----------|---------|
| `ORCHESTRATOR_URL` | Orchestrator server URL (default: `http://localhost:3000`) |
| `ORCHESTRATOR_API_KEY` | API key for orchestrator auth |
| `ORCHESTRATOR_API_SECRET` | API secret for orchestrator auth |
| `WORKER_LOCATION` | Location code for task routing (`X-Location` header) |
| `POLL_INTERVAL_MS` | Polling frequency (default: `2000`) |

Replacements:
- `ENGINE_URL` → `ORCHESTRATOR_URL`
- `WORKER_SECRET` → `ORCHESTRATOR_API_KEY` + `ORCHESTRATOR_API_SECRET`
- `WORKER_ORG` → `WORKER_LOCATION`
- `STEP_PREFIX` → `WORKER_LOCATION`

Workers to update:
- [ ] worker-agilitas — `WORKER_ORG` → `WORKER_LOCATION`, `WORKER_SECRET` → key/secret pair, remove `ENGINE_URL`
- [ ] worker-sankalp — `WORKER_ORG` → `WORKER_LOCATION`, `WORKER_SECRET` → key/secret pair
- [ ] worker-o2c — `ENGINE_URL` → `ORCHESTRATOR_URL`
- [ ] worker-template — add `WORKER_LOCATION` to `.env.example`

### Phase 3: Update lib-worker version pins ❌

Switch workers still using GitHub tag refs to `file:` protocol for local development:

- [ ] worker-o2c — `github:finopsbricks/lib-worker#v0.16.0` → `file:../../lib/lib-worker`
- [ ] worker-emiritus — `github:finopsbricks/lib-worker#v0.15.0` → `file:../../lib/lib-worker`
- [ ] worker-sankalp — `github:finopsbricks/lib-worker#v0.15.0` → `file:../../lib/lib-worker`
- [ ] worker-template — `github:finopsbricks/lib-worker#v0.15.0` → `file:../../lib/lib-worker`

### Phase 4: Fix worker-emiritus stale AI deps ❌

- [ ] Remove `ai` and `@openrouter/ai-sdk-provider` from direct deps
- [ ] Add `@fob/lib-worker-ai` if any source files import AI functions, otherwise just remove
- [ ] Check if worker-emiritus source files need any other dep updates

### Phase 5: Verify all workers boot ❌

- [ ] Run `npm install` in all fixed workers
- [ ] Boot each worker and verify step discovery
- [ ] Commit and push all changes

---

## Related Files

- `lib/lib-worker/src/validate-env.js` — Required env vars: `ORCHESTRATOR_API_KEY`, `ORCHESTRATOR_API_SECRET`, `WORKER_LOCATION`
- `lib/lib-worker/src/worker.js` — Reads `ORCHESTRATOR_URL`, `WORKER_LOCATION`, `POLL_INTERVAL_MS`
- `lib/lib-worker/docs/wip/extract-domain-libs.md` — Parent extraction WIP that surfaced these issues
