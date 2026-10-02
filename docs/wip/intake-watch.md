# Intake Watch for Line-Head Stations

## Status: IN PROGRESS (~90%) — code done and released; only the worker-alex deploy on its host (alex-pc) remains

Let a line-head (intake) station be triggered by the worker the moment its inbox has something in it, instead of on an hourly cron. A second, separate watcher in `@fob/lib-worker` polls one declared path per station — a folder (worker-chisel `BK-DI0`) or a file (worker-alex `CAR0`, `M0`, `Y0`) — and triggers a run when that path is non-empty. It does not touch the bin-watcher.

---

## Problem Statement

The bin-watcher (`src/bin-watcher.js`, see the FDE handbook's [Station Triggers](../../../../handbooks/fde-handbook/implementation/station-design/station-triggers.md)) only serves **conveyor** stations: it requires step 0 to be `lib-worker:move_files` and watches the upstream station's bin for workpiece folders. A line-head has no upstream bin, so today it can only run on a cron or by hand:

- **BK-DI0** (worker-chisel) drains `config.inbox_dir`. Its cron is hourly and currently `schedule_enabled: false`, so nothing triggers it at all. Worse, BK-DI1 puts the parts of a split bundle back into the inbox — with a cron they wait up to an hour to be classified.
- **CAR0 / M0 / Y0** (worker-alex) drain a text file of URLs (`{archive_root}/inbox.txt`, `{library_root}/input.txt`) on an hourly cron. A pasted URL waits up to an hour.

Setting `watch_enabled: true` on any of these today fails the worker at boot ("has watch_enabled but no move_files step0").

## What "has work" means

Both intake shapes leave their input **empty** after a successful run:

| Line-head | Reads | After a run | What can remain |
|---|---|---|---|
| BK-DI0 | folder `inbox_dir` | every file intaken and deleted, or deleted as a duplicate; zips unzipped; subfolders flattened and removed | files still being copied (younger than `settle_seconds`); zips that won't open (corrupt or password-protected) |
| CAR0, M0, Y0 | file `inbox.txt` / `input.txt` | truncated to 0 bytes — comments and blank lines included | content only when the file was edited mid-run (drain is skipped; the next run drains it) |

So one rule covers both: **the watched path has work when it is non-empty** — a folder with any non-dot entry, or a file larger than 0 bytes. The watcher never parses URLs or inspects zips.

## Proposed Solution

```
lib-worker
  src/intake-watcher.js     — NEW: resolve intake-watched stations, poll each
                               watch_path, trigger when non-empty + nothing in flight
  src/utils/watched-stations.js
                             — resolution branches on step 0: move_files → bin-watch
                               (unchanged); watch_path → intake watch; neither → boot error
  src/bin-watcher.js        — startBinWatcher() also starts the intake loop, so
                               workers' src/index.js doesn't change
  reuses hasInFlightRun() / triggerStationRun() from src/utils/bin-watch-trigger.js
```

### Declaring it

`watch_enabled: true` on the station, plus a `watch_path` in step 0's config:

```jsonc
// worker-chisel BK-DI0
{ "slug": "BK-DI0_01_intake_documents",
  "config": { "inbox_dir": "temp/inbox", "watch_path": "temp/inbox", "settle_seconds": 5, ... } }

// worker-alex CAR0
{ "slug": "CAR0_01_discover_urls",
  "config": { "archive_root": "/Users/alex/Documents/carwale-archive",
              "watch_path": "/Users/alex/Documents/carwale-archive/inbox.txt" } }
```

- A relative `watch_path` resolves against the worker root (`process.cwd()`), the same way steps resolve their own paths. No `~` expansion.
- The watch list is resolved once at boot, like the bin-watcher's.
- A `watch_path` that doesn't exist at boot logs a warning and counts as "no work" every tick — CAR0's iCloud folder may appear later, and the warning still catches a typo.

### Each tick (every 10 s)

1. `stat` the path. Missing → no work. A file → work when `size > 0`. A folder → work when it holds any entry not starting with `.` (matching BK-DI0, which skips dotfiles and dot-folders).
2. Work and no `pending`/`running` work record for the station (`hasInFlightRun`) → `triggerStationRun`.
3. An error on one station is logged and the loop moves on.

Polling, not `fs.watch`: `fs.watch` is unreliable on macOS and in iCloud-synced folders, which is where CAR/M/Y keep their inboxes. One `stat`/`readdir` per station per 10 s costs nothing.

### Decisions

- **Reuse `watch_enabled`, no new flag.** The orchestrator never reads the flag (the worker does), it means the same thing — "the worker starts this station when there's work" — and a new flag would need an orchestrator column. The two watchers stay separate in code; only the flag and the in-flight/trigger helpers are shared.
- **`watch_path` is its own key, even where it duplicates a step key** (`inbox_dir` on BK-DI0). It keeps the watcher independent of how each step names its config. Revisit if the duplication drifts in practice.
- **No minimum-age check in the watcher.** A file still being copied triggers a run that BK-DI0's `settle_seconds` guard turns into a no-op, then the watcher fires again 10 s later — 1–2 empty runs per drop. Accepted, rather than duplicating `settle_seconds` in the watcher.
- **Keep a daily cron as a safety net.** Once the watch is live, each watched line-head drops to a daily cron (`0 0 * * *`) instead of losing its cron entirely, so a hung or misconfigured watcher delays work by a day at most. Both triggers go through the same in-flight guard, so they never stack runs.

### Known consequences

- **BK-DI0 must not leave anything permanent in the inbox**, or the watcher triggers a run every 10 s forever. Zips that won't open move to `temp/stations/BK-DI0/rejected/` — **outside** the inbox, because a `rejected/` folder inside it would be flattened by the tidy pass and would itself count as work.
- **Editing `inbox.txt` while a run happens is now likely, not rare.** A run can truncate the file while it is open in an editor, and the editor may write the old lines back. Harmless: CAR0/M0/Y0 skip URLs already in their intake registry. A URL pasted into the file is taken within ~10 s, even if it was mid-edit.
- Every triggered run is a work record, including the empty ones above. Same as the bin-watcher; runs still show `trigger: 'api'`.

## Implementation Phases

### Phase 1: lib-worker — intake watcher ✅
- [x] `src/utils/watched-stations.js`: `resolveIntakeWatchedStations()` (`watch_enabled` + step 0 `watch_path`, resolved against the worker root); conveyor resolution unchanged; boot error only when a `watch_enabled` station has neither
- [x] `src/intake-watcher.js`: `pathHasWork(abs_path)` (file `size > 0`, folder with a non-dot entry, missing → false), `checkAndTriggerIntake()`, `startIntakeWatcher()`, reusing `hasInFlightRun` / `triggerStationRun`
- [x] `startBinWatcher()` starts the intake loop too; warns at boot for a missing `watch_path`
- [x] Startup warning (`findUntriggeredStations()`, was `findUnwatchedConveyorStations()`) also flags a line-head that a conveyor pulls from and that has neither trigger; standalone stations are not flagged
- [x] Tests: `test/intake-watcher.test.js` (path states, in-flight skip, error isolation) + resolver/warning cases in `test/utils/watched-stations.test.js` — 75 passing
- [x] README + CHANGELOG; released **v0.35.0**
- [x] FDE handbook: `station-triggers.md` gains an "Intake watch (line-heads)" section; `watch_path` in `station-definition-schema.md`

### Phase 2: worker-chisel — BK-DI0 ✅
- [x] BK-DI0 moves zips that won't open and unreadable files to `temp/stations/BK-DI0/rejected/` (clash → `-2`) and reports them as "Rejected", instead of leaving them in the inbox; a top-level `__MACOSX` folder is removed too (the tidy pass's own walker skipped it, so it would have stayed for good)
- [x] Station JSON: `watch_enabled: true`, `watch_path: "temp/inbox"`, safety-net cron `0 0 * * *` with `schedule_enabled: true`; pushed (profile `chisel`)
- [x] Bumped `@fob/lib-worker` to v0.35.0; restarted. Live check: a duplicate PDF, a zip holding a duplicate and a corrupt zip were handled within ~17 s — duplicates deleted, corrupt zip in `rejected/` — and the watcher went quiet once the inbox was empty. Enabling the cron also fired one catch-up run (the station had never run on schedule), which found the files still settling. **Not live-checked:** a two-document bundle's split parts coming back through intake — that needs new content, so it would run the LLM stations and write ledger rows; the watcher sees those parts exactly like any other dropped file
- [x] `docs/lines/BK-DI.md` and `CLAUDE.md`: BK-DI0 is watch-triggered; rejects go to `rejected/`

### Phase 3: worker-alex — CAR0, M0, Y0 🔄
- [x] Station JSONs: `watch_enabled: true`, `watch_path` = the inbox file (`{archive_root}/inbox.txt`, `{library_root}/input.txt`); hourly cron → daily safety net `0 0 * * *` (`schedule_enabled` stays `true`)
- [x] Bumped `@fob/lib-worker` to v0.35.0 (crosses 0.34.0's breaking release): dropped the `splitBundlesStep` import from `src/index.js`; every conveyor config already passes the strict schema
- [x] Boot dry-run against the v0.35.0 resolver: CAR0/M0/Y0 resolve to the intake watcher with their inbox files; conveyors bin-watched as before; the widened startup warning flags AV0, AV1, EM0, SV0–SV3 (EM0 is off on purpose pending a supervised first run)
- [x] worker-alex `CLAUDE.md`: CAR0/M0/Y0 are intake-watched
- [ ] **Deploy on the worker host.** worker-alex runs on `alex-pc` (Linux), not the Mac this was built on, so it couldn't be restarted or live-checked from here. On `alex-pc`: `git pull && npm install`, `fob-orc stations push CAR0 M0 Y0` (profile `alex2526`), restart the worker. The orchestrator still has the hourly crons — deliberately not pushed earlier, since the daily cron would have replaced the hourly one before the host ran the intake watcher. Check `watch_path`s exist there: they are macOS paths (`/Users/alex/Documents/...`); the watcher warns at boot if not
- [ ] Live check on `alex-pc`: paste a URL into each inbox → a run within ~10 s, the file drained to 0 bytes, no further runs

## Out of Scope

- **Email intakes (worker-alex `EM0`, `SI0`)** poll a mailbox, not a path — out of scope; they stay on cron.

## Related Files

- `src/bin-watcher.js` — existing conveyor watcher; `startBinWatcher()` entry point
- `src/intake-watcher.js` — the intake watcher
- `src/utils/watched-stations.js` — station resolution (location filter, `watch_enabled`, boot errors) and the startup warning
- `src/utils/bin-watch-trigger.js` — `hasInFlightRun()` / `triggerStationRun()`, shared
- `workers/worker-chisel/src/steps/BK-DI0__intake_documents/BK-DI0_01_intake_documents.js` — `tidyInbox()` (where corrupt zips are left today) and the `settle_seconds` guard
- `workers/worker-alex/src/steps/CAR0__discover_urls/CAR0_01_discover_urls.js` — `drainInbox()`, the truncate / preserve-appends drain
- `handbooks/fde-handbook/implementation/station-design/station-triggers.md` — as-is trigger reference to update
