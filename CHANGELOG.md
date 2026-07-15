# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

## [0.30.1] - 2026-07-15

### Fixed

- `processWorkpiece()` now clears any existing `doing/` and `done/` directory before writing into it, matching the overwrite behavior `output/` and `failed/` already had. Previously a manual retry of a workpiece that had already completed once threw `ENOTEMPTY` renaming `input/` → `done/` (since a prior successful run's `done/{workpiece_id}` still existed), misfiling the retry as a station failure. A stranded `doing/` copy from a crash mid-run is now also blown away on the next attempt instead of merging via `cpSync`.

## [0.28.0] - 2026-06-18

### Added

- `attachWorkpieces(work_record_id, workpieces)` — voluntary worker → orchestrator call that records the per-workpiece outcome map on a WR. The map is `workpiece_id → "done" | "failed"`; the orchestrator derives `done_count` / `failed_count` and stores all three. Modelled on `attachReport` / `attachDocument`. Steps build the map from their own knowledge (a `seeded` list for line-heads, a `results` array for body stations) and call this once before `attachReport`. Empty `{}` is valid and represents a no-op run.

### Removed

- **Breaking:** `workpieceOutcomes(station, pending)`. Bin-walking helper from 0.27.0 — replaced by `attachWorkpieces` plus per-step explicit map building. The previous design (nesting `workpieces` inside step `output` and letting the orchestrator lift it) is gone; steps now report directly to a dedicated endpoint.

## [0.27.0] - 2026-06-18

### Added

- ~~`workpieceOutcomes(station, pending)`~~ — **superseded in 0.28.0.** Bin-walking helper that classified workpieces into a `Record<string, "done"|"failed">` by walking `done/` and `failed/`. Replaced by per-step explicit map building plus `attachWorkpieces`.

## [0.26.0] - 2026-06-18

### Added

- `wr` (work record id) is now recorded on every `log.jsonl` event emitted by `processWorkpiece` and `logEvent`. This lets a workpiece's log answer "which WR processed this transition?" — previously only timestamp and station were recorded, so the WR side of the linkage required matching by inference. Older log lines without `wr` remain valid; readers should treat missing `wr` as unknown.

### Changed

- **Breaking:** `logEvent(wp, station, event)` → `logEvent(wp, station, work_record_id, event)`. All callers must thread the WR id through.
- **Breaking:** `processWorkpiece({ station, workpiece_id, body })` → `processWorkpiece({ station, workpiece_id, work_record_id, body })`. The new arg is passed to the three auto-emitted lifecycle events. Steps read `work_record.id` from their step context and forward it.

## [0.25.0] - 2026-06-06

### Added

- `processWorkpiece` failure capture now writes a structured `error.json` alongside `error.txt` in the failed bin. Any enumerable own properties attached to the thrown Error (e.g. `status`, `statusText`, `headers`, `body`, `cause`) are serialized — making upstream-API failures self-diagnosable. Full body lives in `error.json`; `error.txt` carries a 500-char-truncated preview.

### Changed

- `error.txt` format: now `failed_at`, `Name: message`, one line per extra field, then stack. Previously duplicated the message line above the stack — V8's `err.stack` already begins with `Name: message`, so the duplicate is now stripped.

## [0.24.0] - 2026-06-06

### Added

- **Workpiece Mode** — 5-bin doing-bin contract for stations that process items with per-item bodies. New helpers:
  - `processWorkpiece({ station, workpiece_id, body })` — wraps the body in input → doing → mutate → output/done on success, or input → failed with log overlay on error
  - `logEvent(wp, station, event)` — append one event to `{wp}/log.jsonl`; auto-emitted as `station_started` / `station_complete` / `station_failed` by `processWorkpiece`
  - `cleanupOrphanedDoing()` — discards stranded `doing/{wp}/` directories from a prior crashed run; called automatically by `startWorker` at boot
- General step-authoring helpers, hoisted from worker repos:
  - `pooled(items, concurrency, fn)` — bounded-concurrency async pool, preserves input order
  - `stripFrontmatter(md)` — strip leading YAML frontmatter block
  - `countWords(text)` — whitespace-split word count

### Changed

- `bin()` JSDoc lists `'doing'` as an allowed bin type alongside the prior four
- `startWorker` now runs `cleanupOrphanedDoing()` at boot before the polling loop (no-op when no `doing/` bins exist)

## [0.23.0] - 2026-05-31

### Added
- `recursive` option for `moveFiles()` and `lib-worker:move_files` step — walks subdirectories and flattens files into target using `__` separator (e.g., `vendor-a/file.pdf` → `vendor-a__file.pdf`)

### Fixed
- `bin()` now accepts arbitrary depth segments — `source_bin: "CD2/output/PO"` was silently dropping the third segment and reading from `CD2/output/` instead
- `move_files` step passes all bin path segments through to `bin()` via rest destructuring

## [0.22.0] - 2026-05-29

### Added
- Multi-source moves in `lib-worker:move_files` step — `source_bin` now accepts an array of bins to merge files from multiple sources into one target
- Test suite for `move_files` step (file mode, directory mode, multi-source mode)

### Fixed
- `move_files` step defaults to `attachDocument` instead of `attachReport`
- `split_bundles` step defaults to `attachDocument` instead of `attachReport`

## [0.21.1] - 2026-05-29

### Fixed
- `moveFiles` directory mode now merges into existing target directories instead of failing with `ENOTEMPTY` — enables two `move_files` steps to move same-named bundles to the same target

### Added
- Test suite for `moveFiles` (file and directory modes)

## [0.21.0] - 2026-05-29

### Changed
- **BREAKING**: Bin layout migrated from flat `temp/work_area/{station}_{type}/` to nested `temp/stations/{station}/{type}/`
- **BREAKING**: `move_files` config format changed from `"HI1_output"` to `"HI1/output"` — all process definitions must update `source_bin`/`target_bin` values
- `parseBin()` now splits on `/` instead of last underscore
- Internal constant renamed from `WORK_AREA` to `STATIONS`

## [0.20.0] - 2026-05-23

### Removed
- Statements API client extracted to `@fob/lib-worker-statements`
- Passthrough API client removed (no consumers)
- Email utilities extracted to `@fob/lib-worker-email` — `sendEmail`, `sendEmailToMultiple`

## [0.19.0] - 2026-05-23

### Removed
- AI/LLM utilities extracted to `@fob/lib-worker-ai` — `createModel`, `generateStructured`, `extractDocument`, `renderPrompt`, `extractJsonFromText`, `generateText`, `Output`, `tool`
- Removed `ai` and `@openrouter/ai-sdk-provider` dependencies

## [0.18.0] - 2026-05-22

### Added
- `split_bundles` shared step (`lib-worker:split_bundles`) — splits a PDF bundle into individual page PDFs using qpdf. Requires `qpdf` binary on the host.

## [0.17.0] - 2026-05-22

### Changed
- `move_files` step slug renamed to `lib-worker:move_files` — library steps now namespace their slugs with `lib-name:` prefix for clarity in process definitions

## [0.14.0] - 2026-05-21

### Added
- Worker User-Agent and session support — workers now send structured `User-Agent` and `X-Session-ID` headers to orchestrator during polling
- `buildUserAgent()` utility for constructing standardized user agent strings
- Export `moveFiles` from file utilities

### Changed
- Updated architecture documentation for location-based routing

## [0.13.0] - 2026-05-21

### Added
- AI/LLM structured generation utilities (`generateStructured`, `extractDocument`, `createModel`, `renderPrompt`, `extractJsonFromText`) — consolidates duplicated code from worker repos
- New dependencies: `ai`, `@openrouter/ai-sdk-provider`

### Changed
- Renamed `STEP_PREFIX` env var to `WORKER_LOCATION`
- Renamed `X-Step-Prefix` poll header to `X-Location`
- Config resolver uses first-dot parsing instead of slash-based prefix matching

## [0.12.0] - 2026-05-20

### Removed
- `WORKER_TYPE` env var and `X-Worker-Type` poll header — worker type is no longer sent to orchestrator

## [0.6.1] - 2026-03-07

### Fixed
- `attachDocument` and `attachReport` skip remote POST for local CLI runs (`fob steps run`) to avoid noisy 404 errors

## [0.6.0] - 2026-03-02

### Added
- Rules API endpoints in txn client: `createRule`, `getRule`, `getRules`, `updateRule`, `runRule`

### Changed
- Migrated worker authentication from shared secret to per-org API keys
- Replaced `WORKER_SECRET` env var with `ORCHESTRATOR_API_KEY` and `ORCHESTRATOR_API_SECRET`
- Replaced `WORKER_ORG` env var with `STEP_PREFIX`
- Auth headers changed from `Authorization: Bearer` to `api-key`/`api-secret` headers
- Worker poll header changed from `X-Worker-Org` to `X-Step-Prefix`

## [0.5.0] - 2026-03-02

### Added
- `resolveConfig()` utility for resolving template variables in step configs — supports `{{env.VAR_NAME}}` for environment variables and `{{step_slug.field.path}}` for previous step outputs
- Exported `resolveConfig` from main package index

### Changed
- `createHandler()` now automatically resolves config templates before input validation using `resolveConfig`

## [0.4.1] - 2026-02-24

### Added
- Export `createHandler` for test usage

## [0.4.0] - 2026-02-24

### Added
- `defineStep()` factory function for declarative step definitions with Zod schema validation
- `isStepDefinition()` helper to check if a value is a step definition
- `createHandler()` function that wraps step definitions with automatic input/output validation
- `getStepHandler()` function for registry lookup with step definition enforcement
- New dependencies: `zod` and `zod-to-json-schema` for schema validation

### Fixed
- Temp filename handling in `attachDocument` - sanitized step slugs to avoid subdirectory issues and simplified filenames to just use the title

### Changed
- Updated architecture documentation for task structure, handler resolution, and document attachment

## [0.3.0] - 2026-02-16

### Changed
- Renamed `step_type` to `slug` in task handling (breaking change for task interface)
- Updated `getHandler` to receive `slug` instead of `step_type`

### Added
- JSDoc `@typedef` for `Task` object in main exports

## [0.2.0] - 2026-02-07

### Added
- Worker polling loop (`startWorker`) for process engine workers
- Orchestrator integration (`attachDocument`, `attachReport`, `clearTemp`)
- Txn app API client with auto-pagination support
- Passthrough API client for external service calls
- EJS-based template rendering system with two-layer templates
- Comprehensive architecture documentation (18 docs)

### Changed
- Refined template renderer implementation

### Removed
- Balance calculator utilities (moved to worker repos)
- Report generator utilities (consolidated elsewhere)
- Sample report templates (no longer needed in shared lib)
