# Fix Worker Configuration and Dependency Issues

## Status: COMPLETE

Fix pre-existing configuration and dependency issues across all customer workers discovered during the lib-worker extraction runtime verification. Issues include missing direct dependencies, outdated env var names, stale lib-worker version pins, and outdated auth patterns in `.env.example` files.

---

## Problem Statement

Runtime verification after the lib-worker domain extraction (see `extract-domain-libs.md`) revealed several pre-existing issues across workers:

1. **Missing direct dependencies** — Workers import packages (zod, ejs) that they don't declare, relying on transitive resolution that breaks unpredictably
2. **Outdated env var names** — Some `.env.example` files use `WORKER_ORG`, `STEP_PREFIX`, `ENGINE_URL`, or `WORKER_SECRET` instead of the current `WORKER_LOCATION`, `ORCHESTRATOR_URL`, and `ORCHESTRATOR_API_KEY`/`ORCHESTRATOR_API_SECRET`
3. **Stale lib-worker version pins** — Some workers referenced old GitHub tags (`v0.15.0`, `v0.16.0`)
4. **Stale AI deps in worker-emiritus** — Had `ai` and `@openrouter/ai-sdk-provider` as direct deps without any AI imports
5. **All workers using file: symlinks** — Switched everything to versioned GitHub refs for reproducible installs

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
| **worker-template** | `.env.example` missing `WORKER_LOCATION`; pinned to `lib-worker#v0.15.0`; stale AI deps |

---

## Implementation Phases

### Phase 1: Fix missing dependencies ✅

- [x] worker-o2c — added `zod` as direct dependency
- [x] worker-nowapps — added `ejs` as direct dependency

### Phase 2: Standardize .env.example files ✅

- [x] worker-agilitas — `WORKER_ORG` → `WORKER_LOCATION`, `WORKER_SECRET` → key/secret pair, removed stale `FOB_STATEMENTS_*` vars
- [x] worker-sankalp — `WORKER_ORG` → `WORKER_LOCATION`, `WORKER_SECRET` → key/secret pair
- [x] worker-o2c — `ENGINE_URL` → `ORCHESTRATOR_URL`
- [x] worker-template — added `WORKER_LOCATION`, cleaned up optional dep comments

### Phase 3: Switch all @fob/ deps to versioned GitHub refs ✅

Tagged new lib versions and switched ALL workers from `file:` symlinks to `github:finopsbricks/<lib>#<version>`:

| Library | Version Tag |
|---------|-------------|
| lib-worker | v0.20.0 |
| lib-worker-ai | v0.1.0 |
| lib-worker-google | v0.1.0 |
| lib-worker-erpnext | v0.1.0 |
| lib-worker-llmwhisperer | v0.2.0 |
| lib-worker-statements | v0.1.0 |
| lib-worker-email | v0.1.0 |

Workers updated: worker-nowapps2, worker-alex, worker-sarveda, worker-agilitas, worker-o2c, worker-emiritus, worker-sankalp, worker-nowapps, worker-template, sankalp/worker-nowapps

### Phase 4: Fix worker-emiritus stale AI deps ✅

- [x] Removed `ai` and `@openrouter/ai-sdk-provider` (no source files import AI functions)
- [x] Also fixed same issue in worker-template

### Phase 5: Verify all workers boot ✅

- [x] Fresh `npm install` in all 10 workers — all succeed
- [x] Boot-tested all workers — step discovery results:

| Worker | Steps |
|--------|-------|
| worker-nowapps2 | 5/5 — full boot + polling |
| worker-alex | 24/24 |
| worker-agilitas | 75/75 |
| worker-o2c | 13/13 |
| worker-nowapps | 121/122 (1 helper file correctly skipped) |
| worker-sarveda | OK |
| worker-emiritus | OK |
| worker-sankalp | OK |

- [x] All changes committed and pushed

---

## Related Files

- `lib/lib-worker/src/validate-env.js` — Required env vars: `ORCHESTRATOR_API_KEY`, `ORCHESTRATOR_API_SECRET`, `WORKER_LOCATION`
- `lib/lib-worker/src/worker.js` — Reads `ORCHESTRATOR_URL`, `WORKER_LOCATION`, `POLL_INTERVAL_MS`
- `lib/lib-worker/docs/wip/extract-domain-libs.md` — Parent extraction WIP that surfaced these issues
