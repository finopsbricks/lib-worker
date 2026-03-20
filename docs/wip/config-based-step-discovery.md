# Config-Based Step Discovery

## Status: IN PROGRESS (~40%)

Replace explicit step registry (`steps/index.js`) in worker repos with automatic filesystem-based discovery, using the `slug` field already present in `defineStep()` definitions. Mirrors the parser discovery pattern in the statements app.

---

## Problem Statement

### Current Pattern

Every worker repo maintains a manual `steps/index.js` registry:

```javascript
// worker-nowapps/src/steps/index.js (207 lines, ~50 imports)
import scanIncomingFolder from './AP1__document_intake/01__scan_incoming_folder.js';
import extractText from './AP1__document_intake/02__extract_text.js';
// ... 50+ more imports ...

export const steps = {
  'nowapps2/scan_incoming_folder': scanIncomingFolder,
  'nowapps2/extract_text': extractText,
  // ... 50+ more mappings ...
};

export function getHandler(step_type) {
  const step = steps[step_type] || null;
  if (!step) return null;
  if (isStepDefinition(step)) return createHandler(step);
  return step;
}
```

### Issues

1. **Slug duplication** — The step slug is defined in `defineStep({ slug: 'nowapps2/scan_incoming_folder' })` AND repeated in the registry map. Two places to keep in sync.

2. **Manual maintenance** — Every new step requires: create the file, import it in index.js, add the mapping entry. Every rename touches three places.

3. **Boilerplate growth** — `worker-nowapps` has ~100 lines of imports + ~90 lines of registry. `worker-alex` has ~30 imports + ~25 mappings. This only grows.

4. **No enable/disable** — Only way to disable a step is to remove it from the registry or delete the file. No graceful mechanism for development, debugging, or staged rollouts.

5. **Inconsistent across workers** — Some workers use `getStepHandler()` from lib-worker, others inline the `isStepDefinition` check. The `getHandler` function is duplicated in every worker.

### What Already Works (Parser Pattern)

The statements app solved this same problem for parsers:

```
src/parsers/
  hdfc_cc/
    hdfc_cc__csv.js    ← defineParser({ file_format: 'csv', enabled: true, ... })
    hdfc_cc__pdf.js
  icici_cc/
    icici_cc__csv.js
```

- **No index.js** — `getAllParsers()` scans `src/parsers/` filesystem
- **Config-driven filtering** — Uses `file_format` and `enabled` from parser config
- **Self-contained** — Each parser file is the single source of truth

## Proposed Solution

### 1. Add `enabled` Field to `defineStep()`

```javascript
// lib-worker/src/define-step.js
export function defineStep(config) {
  const {
    slug,
    name,
    description,
    inputSchema,
    outputSchema,
    execute,
    enabled = true,        // NEW
  } = config;

  return {
    __isStepDefinition: true,
    slug,
    name,
    description,
    inputSchema,
    outputSchema,
    execute,
    enabled,
  };
}
```

### 2. Add `discoverSteps()` to lib-worker

```javascript
// lib-worker/src/discover-steps.js
import { readdirSync } from 'fs';
import path from 'path';
import { isStepDefinition, createHandler } from './define-step.js';

/**
 * Scan a directory tree for step files and build a handler registry.
 * Each .js file must default-export a defineStep() definition.
 *
 * @param {string} steps_dir - Absolute path to the steps/ directory
 * @returns {Promise<Map<string, Function>>} slug → handler map
 */
export async function discoverSteps(steps_dir) {
  const step_files = findStepFiles(steps_dir);
  const handlers = new Map();

  for (const file_path of step_files) {
    const module = await import(file_path);
    const step = module.default;

    if (!isStepDefinition(step)) {
      console.warn(`[discoverSteps] Skipping ${file_path} — not a step definition`);
      continue;
    }

    if (step.enabled === false) {
      console.log(`[discoverSteps] Skipping disabled step: ${step.slug}`);
      continue;
    }

    if (handlers.has(step.slug)) {
      throw new Error(`[discoverSteps] Duplicate slug "${step.slug}" in ${file_path}`);
    }

    handlers.set(step.slug, createHandler(step));
  }

  console.log(`[discoverSteps] Discovered ${handlers.size} steps`);
  return handlers;
}

/**
 * Recursively find all .js files in a directory.
 * Skips index.js files and non-.js files.
 */
function findStepFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findStepFiles(full_path));
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      files.push(full_path);
    }
  }

  return files;
}
```

### 3. Add `createGetHandler()` Convenience Function

```javascript
// lib-worker/src/discover-steps.js (continued)

/**
 * Create a getHandler function from discovered steps.
 * Drop-in replacement for the manually-maintained getHandler in worker repos.
 *
 * @param {Map<string, Function>} handlers - From discoverSteps()
 * @returns {function(string): Function|null}
 */
export function createGetHandler(handlers) {
  return (step_type) => handlers.get(step_type) || null;
}
```

### 4. Simplified Worker Entry Point

```javascript
// worker-nowapps/src/index.js (AFTER)
import 'dotenv/config';
import { startWorker, discoverSteps, createGetHandler } from '@fob/lib-worker';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const steps_dir = path.join(__dirname, 'steps');

const handlers = await discoverSteps(steps_dir);
const getHandler = createGetHandler(handlers);

startWorker({ getHandler, callerUrl: import.meta.url });
```

### 5. Step File Convention

Steps stay exactly as they are — no changes to step files:

```
src/steps/
  AP1__document_intake/
    01__scan_incoming_folder.js    ← defineStep({ slug: 'nowapps2/scan_incoming_folder', ... })
    02__extract_text.js
  AP2__extract_msa/
    01__extract_msa_data.js
  verify_statement/
    fetch_data.js
```

The directory structure is purely organizational. The `slug` in `defineStep()` is the source of truth for registration.

## Benefits

1. **Single source of truth** — Slug only in `defineStep()`, never repeated
2. **Zero-maintenance registry** — Add a step file, it's auto-discovered
3. **Enable/disable** — `enabled: false` in step definition skips it
4. **Duplicate detection** — Throws on duplicate slugs at startup
5. **Less boilerplate** — Eliminates ~100 lines of imports/registry per worker
6. **Consistent** — All workers use the same discovery mechanism from lib-worker

## Trade-offs

### Performance
- **Old:** Static imports, instant lookup
- **New:** Dynamic imports at startup, then same instant lookup
- **Impact:** One-time cost at worker startup (~50-100ms for ~50 steps). Negligible — workers are long-running processes.

### Debugging
- **Old:** Explicit registry makes it clear what's registered
- **New:** Need startup logs to see what was discovered
- **Mitigation:** `discoverSteps()` logs all discovered steps + skipped files. Could add a `--list-steps` CLI flag.

### Legacy Support
- **Old-style plain function steps** (not using `defineStep()`) won't be discovered since they lack `__isStepDefinition` marker.
- **No fallback convention.** All steps must be migrated to `defineStep()` before switching a worker to auto-discovery. This keeps the architecture clean — one format, one discovery mechanism.

## Implementation Phases

### Phase 1: Foundation in lib-worker ✅
- [x] Add `enabled` field to `defineStep()` (default: `true`)
- [x] Create `src/discover-steps.js` with `discoverSteps()` and `createGetHandler()`
- [x] Export from `src/index.js`
- [x] Handle edge cases: empty dirs, non-step .js files, files that fail to import

### Phase 2: Migrate one worker (worker-alex — smallest) ✅
- [x] Replace `steps/index.js` with discovery-based `src/index.js`
- [x] Delete `steps/index.js`
- [ ] Verify all steps discovered correctly at startup
- [ ] Test full execution flow end-to-end

### Phase 3: Migrate remaining workers ❌
- [ ] worker-nowapps (largest, ~50 steps) — all steps use `defineStep()`, ready
- [ ] worker-agilitas — all steps use `defineStep()`, ready
- [ ] worker-o2c — 44 plain-function steps, needs `defineStep()` migration first
- [ ] worker-sankalp — needs verification
- [ ] worker-sarveda — 9 plain-function steps, needs `defineStep()` migration first

### Phase 4: Cleanup ❌
- [ ] Remove `getStepHandler` from lib-worker exports (if no longer needed)
- [ ] Update worker scaffold/template (if exists)
- [ ] Update documentation

## Related Files

### lib-worker (changes)
- `src/define-step.js` — Add `enabled` field
- `src/discover-steps.js` — New file: discovery logic
- `src/index.js` — Export new functions

### Worker repos (migrations)
- `worker-*/src/index.js` — Simplified entry point
- `worker-*/src/steps/index.js` — Deleted after migration

### Reference (parser pattern)
- `apps/statements.finopsbricks.com/src/utils/parser/detectParsers.js` — Filesystem scan pattern
- `apps/statements.finopsbricks.com/src/utils/parser/defineParser.js` — Config-based definition

## Prerequisites

- **Migrate plain-function steps to `defineStep()`** — worker-o2c (44 steps) and worker-sarveda (9 steps) use plain async functions. These must be migrated to `defineStep()` before those workers can switch to auto-discovery. worker-nowapps, worker-alex, and worker-agilitas already use `defineStep()` for all steps.

## Open Questions

1. **Hot reload in dev** — Should discovery re-run on file changes during development? Or is restart sufficient?
