# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.17.0] - 2026-05-22

### Changed
- `move_files` step slug renamed to `lib-worker:move_files` — library steps now namespace their slugs with `lib-name:` prefix for clarity in process definitions

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

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
