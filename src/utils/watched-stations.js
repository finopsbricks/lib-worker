/**
 * Resolves which stations a worker should bin-watch trigger, by reading the
 * calling worker's own .orchestrator/ files directly (the same files
 * `fob-orc lines/stations pull` keep in sync with the orchestrator).
 *
 * A line owns the worker location (orchestrator D3): `.orchestrator/lines/*.json`
 * carries `{ code, location }`, and every station file names its line by code.
 * A station is "at this location" when its line's location equals
 * `process.env.WORKER_LOCATION`. A single worker repo may hold lines at several
 * locations, and a worker process only ever executes tasks for its own — so it
 * must not bin-watch-trigger stations meant for a different one.
 *
 * Eligibility to be watched is `watch_enabled === true` on the station itself —
 * a real orchestrator-side column (Stations.watch_enabled), not a hardcoded list.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} WatchedStation
 * @property {string} station - Short_code, used for logging.
 * @property {string} station_id - The station's database id. `/api/v1/work-records?process=` does an
 *   exact match against this id — unlike `/api/v1/stations/:id/run`, it does NOT resolve short_codes —
 *   so the in-flight check and the trigger call must both use this, not `station`.
 * @property {string} source_station - Short_code of the upstream station whose bin to watch.
 * @property {string} source_bin - Bin path within source_station (e.g. 'output', or a nested bin
 *   like 'output/approved' for a human-approval-gated conveyor).
 */

/**
 * @param {string} dir
 * @returns {Promise<{ file: string, config: any }[]>}
 */
async function readJsonDir(dir) {
  const files = await readdir(dir);
  const result = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const raw = await readFile(path.join(dir, file), 'utf8');
    result.push({ file, config: JSON.parse(raw) });
  }
  return result;
}

/**
 * Codes of the lines served by this worker's location.
 *
 * A missing `.orchestrator/lines/` is an error, not "no lines": every station
 * needs a line to be routable, so a repo without line files has not been
 * pulled since lines became an object. Fail at boot rather than silently
 * watch nothing.
 *
 * @returns {Promise<Set<string>>}
 */
async function readLocalLineCodes() {
  const lines_dir = path.join(process.cwd(), '.orchestrator', 'lines');
  const worker_location = process.env.WORKER_LOCATION;

  let lines;
  try {
    lines = await readJsonDir(lines_dir);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    throw new Error(
      `watched-stations: ${lines_dir} does not exist. Lines own the worker location now — ` +
        'run `fob-orc lines pull --all && fob-orc stations pull --all` in this repo.',
    );
  }

  const codes = new Set();
  for (const { file, config } of lines) {
    if (!config.code) throw new Error(`watched-stations: line file ${file} has no code`);
    if (config.location === worker_location) codes.add(config.code);
  }
  return codes;
}

/**
 * Read every station JSON whose line is served by this worker's location.
 * @returns {Promise<{ file: string, config: object }[]>}
 */
async function readLocationStations() {
  const stations_dir = path.join(process.cwd(), '.orchestrator', 'stations');
  const local_line_codes = await readLocalLineCodes();
  const stations = await readJsonDir(stations_dir);

  const result = [];
  for (const { file, config } of stations) {
    if (!config.line) {
      throw new Error(`watched-stations: station "${config.short_code}" (${file}) has no line`);
    }
    if (!local_line_codes.has(config.line)) continue;
    result.push({ file, config });
  }
  return result;
}

/**
 * @returns {Promise<WatchedStation[]>}
 */
export async function resolveWatchedStations() {
  const stations = await readLocationStations();
  const watched = [];

  for (const { file, config } of stations) {
    if (config.watch_enabled !== true) continue;

    if (!config.id) {
      throw new Error(`watched-stations: station "${config.short_code}" (${file}) has no id — push it live first`);
    }

    const first_step = config.steps?.[0];
    const source_bin_path = first_step?.config?.source_bin;

    if (first_step?.slug !== 'lib-worker:move_files' || !source_bin_path) {
      throw new Error(
        `watched-stations: station "${config.short_code}" (${file}) has watch_enabled but no move_files step0 with source_bin to watch`,
      );
    }

    // Split on the FIRST slash only — everything after is the (possibly
    // nested, e.g. "output/approved") bin path, not just a single segment.
    const slash_index = source_bin_path.indexOf('/');
    const source_station = slash_index === -1 ? '' : source_bin_path.slice(0, slash_index);
    const source_bin = slash_index === -1 ? '' : source_bin_path.slice(slash_index + 1);
    if (!source_station || !source_bin) {
      throw new Error(
        `watched-stations: station "${config.short_code}" (${file}) has an unparseable source_bin "${source_bin_path}"`,
      );
    }

    watched.push({ station: config.short_code, station_id: config.id, source_station, source_bin });
  }

  return watched;
}

/**
 * Short_codes of downstream conveyor stations (has a `move_files` step0 —
 * i.e. is structurally eligible for bin-watch) that currently have NEITHER
 * `schedule_enabled` NOR `watch_enabled` set — nothing will ever trigger
 * them. This is exactly the gap that let BK-SR sit fully dormant and
 * unnoticed for a while: nothing forced anyone to notice it was eligible.
 * Enabled-but-off-on-purpose stations (`is_enabled: false`) and archived
 * stations are not flagged — those are already unambiguous.
 *
 * Informational only — this never throws, just reports.
 *
 * @returns {Promise<string[]>}
 */
export async function findUnwatchedConveyorStations() {
  const stations = await readLocationStations();
  const unwatched = [];

  for (const { config } of stations) {
    if (config.is_enabled === false) continue;
    if (config.archived_at) continue;
    if (config.schedule_enabled === true || config.watch_enabled === true) continue;

    const first_step = config.steps?.[0];
    if (first_step?.slug !== 'lib-worker:move_files') continue;

    unwatched.push(config.short_code);
  }

  return unwatched;
}
