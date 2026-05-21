# Consolidate claude-cli into lib-worker

## Status: SUPERSEDED by [ai-sdk-adoption.md](ai-sdk-adoption.md)

Move `runClaude()` from per-worker `src/utils/claude-cli.js` into `@fob/lib-worker`, replace the hand-rolled `child_process.spawn` wrapper with `execa`, and migrate all consumer repos.

> **Why superseded**: The AI SDK (`ai` + `@openrouter/ai-sdk-provider`) provides a better abstraction than consolidating the CLI wrapper. It gives us `generateObject()` for structured extraction, `generateText()` + tools for agentic tasks, and provider-agnostic model selection — all without spawning CLI processes. Phase 1 proof-of-concept is complete in worker-nowapps. See `ai-sdk-adoption.md` for the active plan.

---

## Problem Statement

`runClaude()` is duplicated in worker repos that need LLM-based steps. Each copy manually reimplements stdin piping, stream buffering, timeout handling, and error objects — exactly what `execa` provides out of the box. The copies have already diverged:

- **worker-nowapps** — 900s default timeout, `model` option, Windows process-tree kill
- **worker-o2c** — 300s default timeout, no `model` option, simpler kill

This will only get worse as more workers adopt LLM steps.

## Current State

| Repo | Has `claude-cli.js`? | Callers |
|------|---------------------|---------|
| worker-nowapps | Yes (90 lines) | 14 step files + `cp-batch.js` |
| worker-o2c | Yes (79 lines) | 5 step files |
| worker-agilitas | No | — |
| worker-sankalp | No | — |
| worker-sarveda | No | — |
| worker-alex | No | — |

## Proposed Solution

Replace the `child_process.spawn` wrapper with `execa`, add it to lib-worker, export from the package, then delete the per-worker copies.

The `execa` version should be ~15 lines and handle:
- stdin piping (prompt sent via stdin, not CLI arg)
- timeout with configurable default (900s)
- model selection (`--model sonnet`)
- clean error objects with stdout/stderr attached

## Implementation Phases

### Phase 1: Quick win — execa proof-of-concept in worker-nowapps ❌
- [ ] Rewrite `src/utils/claude-cli.js` in worker-nowapps to use `execa`
- [ ] Verify it works with an existing LLM step (e.g. AP2 extract_msa)
- [ ] Confirm timeout, model, error handling all work

### Phase 2: Add to lib-worker ❌
- [ ] Add `execa` as a dependency in lib-worker `package.json`
- [ ] Create `src/utils/claude-cli.js` in lib-worker
- [ ] Export `runClaude` from `src/index.js`
- [ ] Bump lib-worker version
- [ ] Run `/bump-dependents` to update all consumer repos

### Phase 3: Migrate worker repos ❌
- [ ] worker-nowapps: import from `@fob/lib-worker`, delete local `src/utils/claude-cli.js`, update all 14+ import paths
- [ ] worker-o2c: import from `@fob/lib-worker`, delete local `src/utils/claude-cli.js`, update all 5 import paths
- [ ] Verify both repos work after migration

## Related Files

- `workers/worker-nowapps/src/utils/claude-cli.js` — Most evolved copy (model option, Windows kill)
- `workers/worker-o2c/src/utils/claude-cli.js` — Simpler copy
- `lib/lib-worker/src/index.js` — Package entry point
- `lib/lib-worker/package.json` — Will need `execa` added

## API Design (target)

```javascript
import { runClaude } from '@fob/lib-worker';

const { stdout } = await runClaude(prompt, {
  timeout: 900_000,  // default
  model: 'sonnet',   // optional
});
```
