# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

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
