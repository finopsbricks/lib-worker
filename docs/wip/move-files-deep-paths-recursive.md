# move_files: Deep Bin Paths & Recursive File Collection

## Status: COMPLETE

Fix `move_files` step to support bin paths deeper than 2 segments and add recursive file collection from subfolders.

---

## Problem Statement

Two issues with `lib-worker:move_files`:

1. **`parseBin` silently drops path segments beyond 2.** Config like `source_bin: "CD2/output/PO"` destructures to `[station, type]` = `["CD2", "output"]`, discarding `"PO"`. The step reads from `CD2/output/` instead of `CD2/output/PO/`. Affects CD3 (PO) and CD4 (MSA) process definitions.

2. **No recursive file collection.** `moveFiles()` only reads direct children via `readdirSync`. Files nested in subfolders within the source are silently skipped.

## Proposed Solution

### Fix 1: Deep bin paths

- Update `bin()` in `workerPaths.js` to accept variadic segments: `bin(station, ...segments)`
- Update `move_files.js` to destructure `parseBin` result as `[station, ...rest]` and pass through

### Fix 2: Recursive option

- Add `recursive: z.boolean().default(false)` to `moveSchema`
- When `recursive: true` and `mode: 'files'`: walk subdirectories, collect matching files, flatten into target using `__` separator for subfolder paths (e.g., `vendor-a/file.pdf` → `vendor-a__file.pdf`)
- Clean up empty source directories after moving
- `batch_size` and `pattern` apply to the flattened file list

## Implementation Phases

### Phase 1: Deep bin paths ✅
- [x] Update `bin()` in `workerPaths.js` to accept rest segments
- [x] Update `parseBin` usage in `move_files.js`
- [x] Existing tests pass (deep paths are transparent to `moveFiles()`)

### Phase 2: Recursive file collection ✅
- [x] Add recursive file walking to `moveFiles()` in `files.js`
- [x] Add `recursive` to `moveSchema` in `move_files.js`
- [x] Add 8 tests for recursive mode (all pass)
- [x] Handle filename flattening (`/` → `__`) and empty dir cleanup

## Related Files

- `src/workerPaths.js` - `bin()` function
- `src/files.js` - `moveFiles()` core logic
- `src/steps/move_files.js` - Step definition and schema
- `test/files.test.js` - Unit tests for moveFiles
- `test/move_files_step.test.js` - Integration tests for the step
