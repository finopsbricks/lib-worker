// @ts-check
import fs from 'node:fs';
import { bin } from '../workerPaths.js';

/**
 * Classify the outcome of each workpiece that was in `{station}/input/` at the
 * start of this run. Outcome is read from the workpiece's final bin location:
 *
 *   - `done/{wp}/`   → `"done"`   (success — moved forward by the conveyor)
 *   - `failed/{wp}/` → `"failed"` (needs retry / attention)
 *
 * A workpiece still in `doing/{wp}/` at finalize time is a worker bug
 * (processWorkpiece should have promoted it) and is omitted from the map.
 *
 * Workpieces sitting in `done/` or `failed/` that were NOT in `pending` are
 * ignored — they belong to earlier runs.
 *
 * @param {string} station - Station short code (e.g. 'CAR1').
 * @param {string[]} pending - Workpiece IDs that were in input/ when this run began.
 * @returns {Record<string, 'done'|'failed'>}
 */
export function workpieceOutcomes(station, pending) {
  const done_set = listIds(bin(station, 'done'));
  const failed_set = listIds(bin(station, 'failed'));

  /** @type {Record<string, 'done'|'failed'>} */
  const outcomes = {};
  for (const id of pending) {
    if (done_set.has(id)) outcomes[id] = 'done';
    else if (failed_set.has(id)) outcomes[id] = 'failed';
  }
  return outcomes;
}

/** @param {string} dir @returns {Set<string>} */
function listIds(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name),
  );
}
