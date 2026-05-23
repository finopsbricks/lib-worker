# Extract Domain Libraries from lib-worker

## Status: IN PROGRESS (~25%)

Extract specialized concerns from the lib-worker monolith into focused domain libraries. lib-worker currently bundles 6+ unrelated concerns — AI/LLM, Statements API, Passthrough, Email — alongside the core worker framework. This creates unnecessary dependency weight and blurs library boundaries.

---

## Problem Statement

`lib-worker` is the shared framework for all process engine workers. Every worker depends on it. But it has grown to include domain-specific integrations that only a few workers use:

| Concern | Workers that use it | Should every worker pull this in? |
|---------|--------------------|---------------------------------|
| AI/LLM (`generateStructured`, `createModel`, etc.) | worker-nowapps, sankalp/worker-nowapps | No — heaviest deps (`ai`, `@openrouter/ai-sdk-provider`) |
| Statements API (`statements.*`, `clearTemp`) | worker-alex, worker-sarveda | No — app-specific client |
| Email (`sendEmail`) | worker-agilitas, worker-alex | No — standalone integration |
| Passthrough (`passthroughGet/Post`) | _none currently_ | No — unused, app-specific |

Meanwhile, the sibling libs (lib-worker-google, lib-worker-erpnext, lib-worker-llmwhisperer) are clean, focused, and demonstrate the right pattern.

### Impact

- All 10 workers pull in `ai` + `@openrouter/ai-sdk-provider` even though only 2 use LLM features
- Statements API client sits in a "framework" lib despite being an app-specific REST wrapper
- No clear boundary tells developers "this is core vs. optional"

## Proposed Solution

Extract 3 new libraries following the same pattern as lib-worker-google/erpnext/llmwhisperer:

```
lib-worker                  ← core only (slimmed)
lib-worker-ai               ← NEW: LLM structured generation
lib-worker-statements       ← NEW: Statements app API client
lib-worker-email            ← NEW: ZeptoMail email sending
```

**Passthrough** — skip for now. No worker currently imports it. Extract later if/when a consumer appears.

### What stays in lib-worker (core)

- Worker framework: `startWorker`, `defineStep`, `discoverSteps`, `createGetHandler`, `validateEnv`
- Orchestrator API: `attachDocument`, `attachFile`, `attachReport`, `clearTemp`, `findItem`, `createItem`, `findOrCreateItem`, `runProcess`
- Config resolution: `resolveConfig`
- Templates: `renderTemplate`, `renderLocal`, `initTemplates`
- File/path utils: `moveFiles`, `bin`, `workRecordDir`, `workRecordFile`
- Shared steps: `moveFilesStep`, `splitBundlesStep`
- Deps after extraction: `zod`, `zod-to-json-schema`, `ejs`

### What moves out

| New Library | Functions | Source Files | Deps |
|-------------|-----------|-------------|------|
| **lib-worker-ai** | `createModel`, `generateStructured`, `extractDocument`, `renderPrompt`, `extractJsonFromText`, re-exports (`generateText`, `Output`, `tool`) | `src/ai.js` | `@openrouter/ai-sdk-provider`, `ai`, `zod` |
| **lib-worker-statements** | `statements.*` (getStatement, updateStatement, getAccount, getTransactions, getAllTransactions, createWorkRecord, updateChecks, createRule, getRule, getRules, updateRule, runRule, apiGet/Post/Patch/Put) | `src/apps/statements.js` | none (native fetch) |
| **lib-worker-email** | `sendEmail`, `sendEmailToMultiple` | `src/utils/email.js` | none (native fetch) |

---

## Implementation Phases

### Phase 1: Extract lib-worker-ai ✅

Biggest win — removes the heaviest deps from core.

**Create lib-worker-ai:**
- [x] Scaffold repo: `lib/lib-worker-ai/` (package.json, index.js, CHANGELOG, jest config)
- [x] Move `src/ai.js` logic into new lib
- [x] Move `@openrouter/ai-sdk-provider` and `ai` deps to new lib
- [x] Export: `createModel`, `generateStructured`, `extractDocument`, `renderPrompt`, `extractJsonFromText`, `generateText`, `Output`, `tool`
- [x] Add tests (12 tests passing)

**Update lib-worker:**
- [x] Remove `src/ai.js`
- [x] Remove `ai` and `@openrouter/ai-sdk-provider` from package.json deps
- [x] Remove AI exports from `src/index.js`
- [x] Bump lib-worker to v0.19.0

**Migrate consumers:**
- [x] worker-nowapps — 21 files migrated, added `@fob/lib-worker-ai` dep
- [x] sankalp/worker-nowapps — 25 files migrated (incl. 1 mixed-import split), added dep
- [x] worker-nowapps2 — 2 files migrated (mixed imports split), added dep
- [x] worker-alex — no AI imports found (earlier analysis was incorrect), no changes needed
- [x] worker-sarveda — no AI imports found, no changes needed

**Verify:**
- [ ] All workers start and poll successfully
- [ ] Run at least one AI-using step end-to-end in dev

### Phase 2: Extract lib-worker-statements ❌

Clean boundary — app-specific client doesn't belong in framework.

**Create lib-worker-statements:**
- [ ] Scaffold repo: `lib/lib-worker-statements/`
- [ ] Move `src/apps/statements.js` logic into new lib
- [ ] Export all statements functions (getStatement, updateStatement, etc.)
- [ ] Add tests

**Update lib-worker:**
- [ ] Remove `src/apps/statements.js`
- [ ] Remove statements exports from `src/index.js`
- [ ] Bump lib-worker version (minor)

**Migrate consumers:**
- [ ] worker-alex — change `statements` import to `@fob/lib-worker-statements`, add dep
- [ ] worker-sarveda — same

**Verify:**
- [ ] Both workers poll and execute statements-related steps in dev

### Phase 3: Extract lib-worker-email ❌

Small extraction, clean standalone integration.

**Create lib-worker-email:**
- [ ] Scaffold repo: `lib/lib-worker-email/`
- [ ] Move `src/utils/email.js` logic into new lib
- [ ] Export: `sendEmail`, `sendEmailToMultiple`
- [ ] Add tests

**Update lib-worker:**
- [ ] Remove `src/utils/email.js`
- [ ] Remove email exports from `src/index.js`
- [ ] Bump lib-worker version (minor)

**Migrate consumers:**
- [ ] worker-agilitas — change email import to `@fob/lib-worker-email`, add dep
- [ ] worker-alex — same

**Verify:**
- [ ] Email-sending steps work in dev

### Phase 4: Cleanup and passthrough decision ❌

- [ ] Remove `src/apps/passthrough.js` from lib-worker (dead code — no consumers)
- [ ] Remove passthrough exports from `src/index.js`
- [ ] Review: does `src/apps/` directory still make sense, or remove it entirely?
- [ ] Update lib-worker CLAUDE.md and README to reflect slimmed-down scope
- [ ] Final lib-worker version bump
- [ ] Update all workers to pin latest lib-worker version

---

## Consumer Import Map (current → target)

| Worker | Current imports from lib-worker | After extraction |
|--------|-------------------------------|-----------------|
| **worker-nowapps** | defineStep, attachDocument, attachReport, attachFile, renderTemplate, extractDocument, createModel, generateText, generateStructured, workRecordDir, renderPrompt, Output | core: defineStep, attachDocument, attachReport, attachFile, renderTemplate, workRecordDir; **ai**: createModel, generateText, generateStructured, extractDocument, renderPrompt, Output |
| **sankalp/worker-nowapps** | same as above | same split as above |
| **worker-alex** | defineStep, attachDocument, attachReport, renderTemplate, extractDocument, statements, clearTemp, findOrCreateItem, runProcess, sendEmail | core: defineStep, attachDocument, attachReport, renderTemplate, clearTemp, findOrCreateItem, runProcess; **ai**: extractDocument; **statements**: statements; **email**: sendEmail |
| **worker-sarveda** | attachDocument, attachReport, renderTemplate, extractDocument, statements, clearTemp | core: attachDocument, attachReport, renderTemplate, clearTemp; **ai**: extractDocument; **statements**: statements |
| **worker-agilitas** | defineStep, attachDocument, attachReport, attachFile, renderTemplate, sendEmail | core: defineStep, attachDocument, attachReport, attachFile, renderTemplate; **email**: sendEmail |
| **worker-nowapps2** | defineStep, attachReport, attachDocument, renderLocal, extractDocument, moveFilesStep, splitBundlesStep, bin | core: defineStep, attachReport, attachDocument, renderLocal, moveFilesStep, splitBundlesStep, bin; **ai**: extractDocument |
| **worker-o2c** | defineStep, attachReport, attachDocument, moveFilesStep, bin | unchanged (core only) |
| **worker-emiritus** | startWorker, discoverSteps, createGetHandler | unchanged (core only) |
| **worker-template** | startWorker, discoverSteps, createGetHandler | unchanged (core only) |

## Related Files

- `lib/lib-worker/src/index.js` — current monolith exports
- `lib/lib-worker/src/ai.js` — AI module to extract
- `lib/lib-worker/src/apps/statements.js` — Statements client to extract
- `lib/lib-worker/src/apps/passthrough.js` — Dead code to remove
- `lib/lib-worker/src/utils/email.js` — Email module to extract
