# Multi-Verb-Step Stations in Workpiece Mode

## Status: NOT STARTED

Today every per-item station body must live in a single `defineStep` handler. A station with a logical pipeline (e.g. "extract → validate → dedupe") cannot split that pipeline across multiple verb-steps while still conforming to the workpiece-mode bin contract. This WIP captures the challenges that block a multi-verb-step contract so a future implementer can pick it up with full context.

---

## Problem Statement

`processWorkpiece` is a *per-call* unit: one invocation moves a workpiece `input → doing → output` (success) or `input → failed` (failure). It is therefore implicitly a *per-station* contract — once it returns, the workpiece has left `input/`, and the body that ran cannot be split across multiple orchestrator step invocations without breaking the bin transitions.

This forces an awkward shape on stations whose business logic is naturally a 2–3-stage pipeline:

- **Option A (current recommendation): one body per station.** Collapse the pipeline into one `defineStep` handler with helper functions. Loses the orchestrator-level visibility of each verb-step as a separately runnable / retryable / instrumented unit.
- **Option B: split into sub-stations** with `move_files` conveyors between them. Each sub-station is a clean `processWorkpiece` call. Costs an extra station definition and conveyor per verb, triples orchestrator polling, and inflates the line topology.

Neither shape lets a single station have *three verb-steps* that share `doing/{wp}/` as their working surface. That's what this WIP would unblock.

## Why It's Hard

Each step in a station is delivered as a **separate orchestrator poll** (`worker.js` polls, dispatches one step, reports complete, polls again). Verb-steps within one station therefore run as independent worker invocations, potentially minutes apart, potentially across worker restarts. Any "scaffolding at the station" has to survive that.

Four concrete challenges:

### 1. `cleanupOrphanedDoing` would wipe in-flight workpieces

`cleanupOrphanedDoing` (see `src/utils/workpiece-station.js`) runs at every `startWorker` boot and removes everything in every station's `doing/` bin. This is correct for the current contract: a workpiece in `doing/` means a mid-step crash, and the safe recovery is to discard the partial doing copy and re-process from `input/`.

A multi-verb-step contract needs to distinguish:

- **Stranded** (a worker died inside verb 2, mid-mutation) — should be discarded
- **In flight** (verb 2 completed, verb 3 hasn't run yet, possibly because the worker restarted between the two polls) — should be preserved

A sentinel file inside `doing/{wp}/` (e.g. `.verb_<N>_complete` or `.verb_<slug>_complete`) is the obvious mechanism, but it's a real protocol — `cleanupOrphanedDoing` needs to read sentinels and apply a heuristic, and the contract needs to specify when sentinels are written (atomically, after the body returns) and when they're cleared (on promotion to `output/`).

### 2. The body needs to know "am I first / middle / last"

The first verb-step has to copy `input/{wp}/` → `doing/{wp}/`. Middle verb-steps inherit the existing `doing/{wp}/`. The last verb-step promotes `doing/{wp}/` → `output/{wp}/` and `input/{wp}/` → `done/{wp}/`. Today `processWorkpiece` always does both the copy and the promotion in a single call.

Options:

- **Explicit phase argument**: `processVerbStep({ station, workpiece_id, phase: 'first' | 'middle' | 'last' | 'only', body })`. Verbose at call sites but unambiguous.
- **Station-JSON convention**: mark `is_last: true` on the last verb-step in the station definition; helper derives phase from step order. Less ceremony per call but couples the helper to the orchestrator's step list shape.
- **Derive from `step_order` and station metadata**: the orchestrator already passes `step_order` and the task includes the station's full step list. The helper could read both and figure out its own phase. Cleanest but requires the orchestrator surface to expose the verb count reliably.

### 3. Per-verb retry semantics get muddy

The orchestrator retries individual steps. If verb 2 fails for the whole batch, the orchestrator retries verb 2. But `doing/{wp}/` is in some half-mutated state from verb 2's first attempt (it wrote some artifacts before throwing).

Either:

- **Each verb is required to be idempotent against `doing/`** — a re-run must be safe to overwrite or skip already-written artifacts. Pushes the burden onto step authors.
- **Retry resets `doing/` from `input/`** — but then verb 1's mutations are also lost, which defeats the multi-verb point.
- **Retry only ever re-runs from verb 1** — clean but expensive, and the orchestrator doesn't currently support "retry the whole station" as a unit.

None of these is obviously right; the chosen semantics needs to be documented as part of the contract.

### 4. Per-workpiece failure across verbs

In a single-body station, when one workpiece in a batch fails, `processWorkpiece` promotes that workpiece to `failed/` and the other workpieces in the batch keep flowing — the per-call, per-workpiece model handles this trivially.

In a multi-verb station, if verb 2 fails for 3 of 50 workpieces:

- Those 3 need to go to `failed/` now (with verb-1 mutations preserved in the pristine portion? or discarded?).
- The other 47 need to keep flowing into verb 3.
- The orchestrator's idea of step status is "the step succeeded or it didn't" — it has no per-workpiece concept. So the step itself has to track per-workpiece success/failure internally, and decide whether to report the step as succeeded (because most workpieces flowed) or failed (because any workpiece failed).

A natural answer: the verb-step always reports succeeded if the **batch loop** completed, and per-workpiece failures land in `failed/` via in-step bin transitions. But this means a verb step that throws genuinely (process-level error, not per-workpiece) is hard to distinguish from a verb that ran cleanly with some workpiece failures inside it.

## What the API Might Look Like

Sketch (not committed to):

```js
import { processVerbStep, pooled } from '@fob/lib-worker';

// In each of AP2_01_extract.js, AP2_02_validate_tax.js, AP2_03_dedupe_check.js:
const results = await pooled(pending, config.concurrency, async (workpiece_id) => {
  return processVerbStep({
    station: 'AP2',
    workpiece_id,
    phase: 'first',  // or 'middle' / 'last' / 'only'
    body: async (wp_doing) => {
      // Read prior verb's artifacts from wp_doing, write new ones
      const pointer = JSON.parse(fs.readFileSync(path.join(wp_doing, 'pointer.json'), 'utf8'));
      const fields = await extractInvoice(pointer);
      fs.writeFileSync(path.join(wp_doing, 'extracted.json'), JSON.stringify(fields, null, 2));
      return { firm_key: fields.firm_key };
    },
  });
});
```

`processVerbStep` would:

- On `phase: 'first'` or `'only'`: copy `input/{wp}/` → `doing/{wp}/`, run body, write `.verb_<slug>_complete` marker.
- On `phase: 'middle'`: run body against existing `doing/{wp}/`, write the marker.
- On `phase: 'last'`: run body, then clear all `.verb_*_complete` markers, then promote `doing/` → `output/` and `input/` → `done/`.
- On any throw: per-workpiece failure path (promote `input/{wp}/` → `failed/{wp}/`, overlay log, write error.json + error.txt, rm doing).

`cleanupOrphanedDoing` would learn to read the markers: a `doing/{wp}/` with a complete marker for the most-recently-completed verb is in flight and should be preserved; one without is stranded.

## Why We're Deferring

Real work: ~150–250 LOC of new contract surface, new crash-safety semantics to design and document, a new handbook page, and version-bumped backward-compat care for every worker built on lib-worker. Not justified by the current line of customer work — Option A (one body per station, helpers as functions in `src/core/<area>/`) is good enough.

The AP retrofit (`worker-agilitas/docs/wip/ap-line-retrofit-to-workpiece-mode.md`) collapses AP2's three verb-steps into one body for now. When this WIP is picked up, AP2 is the natural first consumer to refactor back to three verb-steps.

## Related Notes

In this repo:

- `src/utils/workpiece-station.js` — `processWorkpiece` + `cleanupOrphanedDoing` (the contract to extend)
- `src/worker.js` — the polling loop that delivers one task per step

In the fde-handbook:

- `patterns/structural/workpiece-mode.md` — the contract this WIP would extend; currently mandates single body per station
- `patterns/structural/workpiece-anatomy.md` — `log.jsonl` + `pointer.json` shape that marker semantics would have to coexist with

In customer workers:

- `worker-agilitas/docs/wip/ap-line-retrofit-to-workpiece-mode.md` — the consumer who would refactor first
- `worker-alex/src/steps/VM4_01__clean_whisper/VM4_01_clean_whisper.js` — single-body reference today
