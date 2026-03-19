# Rename txn Client to statements in lib-worker

## Status: NOT STARTED

Rename the `txn` API client export to `statements` in lib-worker, release a new version, and update all consuming workers. No backward compatibility — clean rename.

---

## Problem Statement

The txn app has been renamed to `statements.finopsbricks.com`. The lib-worker package still exports the API client as `txn` with env vars `FOB_TXN_*`. All references need updating to `statements` / `FOB_STATEMENTS_*`.

## Proposed Solution

Single coordinated update: rename in lib-worker, release new version, update all workers that consume it.

---

## Implementation Phases

### Phase 1: lib-worker Changes 🔄

#### 1a: Rename Source File
- [ ] Rename `src/apps/txn.js` → `src/apps/statements.js`
- [ ] Update JSDoc comment from "txn.fobrix.com API Client" → "statements.finopsbricks.com API Client"
- [ ] Update env var references: `FOB_TXN_API_KEY` → `FOB_STATEMENTS_API_KEY`
- [ ] Update env var references: `FOB_TXN_API_SECRET` → `FOB_STATEMENTS_API_SECRET`
- [ ] Update all docstring references from "txn API" → "statements API"

#### 1b: Update Export
- [ ] `src/index.js` — `export * as txn` → `export * as statements`

#### 1c: Update Configuration
- [ ] `.env.example` — Rename `FOB_TXN_API_URL` → `FOB_STATEMENTS_API_URL`, `FOB_TXN_API_KEY` → `FOB_STATEMENTS_API_KEY`, `FOB_TXN_API_SECRET` → `FOB_STATEMENTS_API_SECRET`

#### 1d: Update Documentation
- [ ] Rename `docs/architecture/txn-client.md` → `docs/architecture/statements-client.md`
- [ ] Rename `docs/architecture/txn-auto-pagination.md` → `docs/architecture/statements-auto-pagination.md`
- [ ] Update content in both renamed docs
- [ ] `docs/architecture/environment-variables.md` — Update FOB_TXN references
- [ ] `docs/architecture/package-overview.md` — Update link to statements-client.md
- [ ] `docs/architecture/passthrough-client.md` — Update txn documentation links
- [ ] `docs/code-review/docs-pattern-review.md` — Update file references
- [ ] `README.md` — Update import examples and exports list
- [ ] `CLAUDE.md` — Update architecture docs and code examples
- [ ] `CHANGELOG.md` — Add entry for rename

#### 1e: Release
- [ ] Bump version (minor: new export name is a breaking change for consumers)
- [ ] `npm publish` or update monorepo package version

### Phase 2: Worker Updates ❌

#### 2a: worker-alex (9 step files + 2 test files)
- [ ] `src/steps/verify_statement/push_checks.js` — `import { txn }` → `import { statements }`
- [ ] `src/steps/verify_statement/update_review.js` — update import + usage
- [ ] `src/steps/verify_statement/fetch_data.js` — update import + usage
- [ ] `src/steps/verify_statement/upload_work_record.js` — update import + usage
- [ ] `src/steps/discover_classification_rules/fetch_unknown_transactions.js` — update import + usage
- [ ] `src/steps/discover_classification_rules/upload_rule_discovery_work_record.js` — update import + usage
- [ ] `src/steps/discover_classification_rules/classify_and_create_rules.js` — update import + `txn.apiPost` → `statements.apiPost`
- [ ] `src/steps/data_freshness_report/upload_freshness_work_record.js` — update import + usage
- [ ] `src/steps/data_freshness_report/fetch_account_freshness.js` — update import + usage
- [ ] `tests/steps/data_freshness_report/data_contracts.test.js` — update mock references
- [ ] `tests/steps/data_freshness_report/fetch_account_freshness.test.js` — update mock references (~15 occurrences)
- [ ] `.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*` (update values to point at statements.finopsbricks.com)
- [ ] `CLAUDE.md` — update import examples
- [ ] `docs/wip/migrate-fin-ops-alex-business-logic.md` — update import example
- [ ] `wip/simplify-data-freshness-process.md` — update FOB_TXN references
- [ ] Update lib-worker version in `package.json`

#### 2b: worker-sarveda (3 step files)
- [ ] `src/steps/verify_statement/update_review.js` — update import + usage
- [ ] `src/steps/verify_statement/fetch_data.js` — update import + usage
- [ ] `src/steps/verify_statement/upload_work_record.js` — update import + usage
- [ ] `.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `CLAUDE.md` — update import examples
- [ ] Update lib-worker version in `package.json`

#### 2c: worker-o2c (3 step files)
- [ ] `src/steps/verify_statement/update_review.js` — update import + usage
- [ ] `src/steps/verify_statement/fetch_data.js` — update import + usage
- [ ] `src/steps/verify_statement/upload_work_record.js` — update import + usage
- [ ] `src/config.js` — update FOB_TXN references
- [ ] `.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `CLAUDE.md` — update import examples
- [ ] Update lib-worker version in `package.json`

#### 2d: Workers with no txn code (env + docs only)
- [ ] `worker-agilitas/.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-agilitas/.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-agilitas/CLAUDE.md` — update import examples
- [ ] `worker-agilitas/package.json` — update lib-worker version
- [ ] `worker-sankalp/.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-sankalp/.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-sankalp/CLAUDE.md` — update import examples
- [ ] `worker-sankalp/package.json` — update lib-worker version
- [ ] `worker-nowapps/.env.example` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-nowapps/.env` — `FOB_TXN_*` → `FOB_STATEMENTS_*`
- [ ] `worker-nowapps/docs/00-end-to-end-msa-to-invoice-flow.md` — update FOB_TXN references
- [ ] `worker-nowapps/package.json` — update lib-worker version

### Phase 3: Documentation Cleanup (Other Repos) ❌

- [ ] `apps/orchestrator.finopsbricks.com/CLAUDE.md` — update txn app reference
- [ ] `apps/orchestrator.finopsbricks.com/docs/architecture/*.md` — update "txn app" references (5 files)
- [ ] `apps/orchestrator.finopsbricks.com/docs/wip/ideas/api-docs.md` — update txn.fobrix.com references
- [ ] `lib/lib-ui/README.md` — update txn.fobrix.com reference
- [ ] `lib/lib-ui/CLAUDE.md` — update txn app reference
- [ ] `lib/lib-ui/docs/wip/*.md` — update txn references (2 files)
- [ ] `lib/lib-ui/docs/architecture/no-build-step.md` — update txn reference
- [ ] `cli/CLAUDE.md` — update txn app reference

---

## Related Files

- `lib/lib-worker/src/apps/txn.js` — API client to rename
- `lib/lib-worker/src/index.js` — Export to update
- `workers/worker-alex/src/steps/` — Heaviest consumer (9 files)
- `workers/worker-sarveda/src/steps/verify_statement/` — 3 files
- `workers/worker-o2c/src/steps/verify_statement/` — 3 files
