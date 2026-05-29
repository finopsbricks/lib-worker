# Multi-Source move_files Config

## Status: IN PROGRESS (~75%)

Extend `lib-worker:move_files` to support a `moves` array config, allowing multiple source→target operations in a single step. This avoids needing duplicate step slugs in process definitions.

---

## Problem Statement

HCN3 and HI3 need to pull from both `output` and `done` bins of the previous station. Today this requires two `lib-worker:move_files` steps with the same slug, which the orchestrator can't sequence correctly (step_outputs keyed by slug, findIndex always returns first match).

## Proposed Solution

Support two config signatures — the existing simple form and a new `moves` array.

### Signature 1: Simple (existing, unchanged)

```json
{
  "source_bin": "HCN2/output",
  "target_bin": "HCN3/input",
  "mode": "directories",
  "pattern": "*",
  "batch_size": 5
}
```

### Signature 2: Moves array

```json
{
  "moves": [
    { "source_bin": "HCN2/output", "target_bin": "HCN3/input", "mode": "directories", "batch_size": 5 },
    { "source_bin": "HCN2/done",   "target_bin": "HCN3/input", "mode": "directories", "batch_size": 5 }
  ]
}
```

Each move is self-contained with its own `source_bin`, `target_bin`, `mode`, `pattern`, `batch_size`. Defaults apply per move (`mode: "files"`, `pattern: "*"`, `batch_size: 100`).

### Config keys per move

| Key | Values | Default | Notes |
|-----|--------|---------|-------|
| `source_bin` | string (e.g. `"HCN2/output"`) | required | |
| `target_bin` | string (e.g. `"HCN3/input"`) | required | |
| `mode` | `"files"`, `"directories"` | `"files"` | |
| `pattern` | `"*"`, `"*.pdf"`, `"exact.json"` | `"*"` | Only meaningful in file mode |
| `batch_size` | number | `100` | Per-move limit |
| `report` | boolean | `false` | Top-level only. `true` → `attachReport`, `false` → `attachDocument` |

### Output schema

Aggregated across all moves. Same shape as today — backward compatible:

```json
{
  "moved_count": 7,
  "total_available": 10,
  "entries": ["bundle_a", "bundle_b", "bundle_c", "bundle_a", "bundle_b", "bundle_c", "bundle_d"]
}
```

Per-move detail goes in the attached markdown, not the output schema. By default the markdown is uploaded as a supporting document (`attachDocument`). Set `report: true` to upload as the work record report instead.

### Report

The report template should show a per-move breakdown:

```
## Move Files Report

| # | Source | Target | Mode | Moved | Available |
|---|--------|--------|------|-------|-----------|
| 1 | HCN2/output | HCN3/input | directories | 3 | 3 |
| 2 | HCN2/done | HCN3/input | directories | 4 | 7 |

**Total moved**: 7 / 10 available
```

## Implementation Phases

### Phase 1: Code changes ✅

- [x] Update input schema to accept either simple or moves config (`z.union()`)
- [x] Normalize simple config into single-element moves array internally
- [x] Loop over moves, call `moveFiles()` for each, aggregate results
- [x] Update report template to show per-move breakdown
- [x] Default to `attachDocument` instead of `attachReport` (shared steps are supporting evidence)
- [x] Add `report: true` config opt-in for rare solo-step case
- [x] Apply same fix to `split_bundles` shared step

### Phase 2: Tests ✅

- [x] Test: simple config still works (existing tests pass)
- [x] Test: moves array with two moves — aggregated counts
- [x] Test: moves array with different modes per move
- [x] Test: moves array with one move having nothing to move
- [x] Test: empty moves array rejected
- [x] Test: validation rejects config with neither source_bin nor moves
- [x] Test: report contains per-move breakdown
- [x] Test: `report: true` calls `attachReport` instead of `attachDocument`

### Phase 3: Process definitions ✅

- [x] Update HCN3 process definition — collapse two steps into one with `moves`
- [x] Update HI3 process definition — collapse two steps into one with `moves`

### Phase 4: Documentation 🔄

- [ ] Update FDE handbook assembly-line-processing.md — document moves config
- [ ] Release new lib-worker version
- [ ] Bump dependency in worker-nowapps2

## Related Files

- `lib/lib-worker/src/steps/move_files.js` — step implementation
- `lib/lib-worker/src/steps/split_bundles.js` — split_bundles step (same attachDocument fix)
- `lib/lib-worker/src/files.js` — moveFiles utility
- `lib/lib-worker/src/steps/move_files_report.md` — report template
- `lib/lib-worker/test/move_files_step.test.js` — step-level tests
- `workers/worker-nowapps2/.orchestrator/processes/HCN3__merge_credit_notes.json`
- `workers/worker-nowapps2/.orchestrator/processes/HI3__merge_invoices.json`
