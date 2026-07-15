/**
 * Resolves which stations a worker should bin-watch trigger, by reading the
 * calling worker's own .orchestrator/stations/*.json files directly (the
 * same files `fob stations push/pull` keep in sync with the orchestrator).
 *
 * Eligibility is `watch_enabled === true` on the station itself — a real
 * orchestrator-side column (Stations.watch_enabled), not a hardcoded list —
 * AND `location === process.env.WORKER_LOCATION`, since a single worker
 * repo's station folder can span multiple physical worker locations (a
 * worker process only ever executes tasks for its own location, and must
 * not bin-watch-trigger stations meant for a different one).
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
 * @returns {Promise<WatchedStation[]>}
 */
export async function resolveWatchedStations() {
  const stations_dir = path.join(process.cwd(), '.orchestrator', 'stations');
  const worker_location = process.env.WORKER_LOCATION;
  const files = await readdir(stations_dir);
  const watched = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const raw = await readFile(path.join(stations_dir, file), 'utf8');
    const config = JSON.parse(raw);

    if (config.watch_enabled !== true) continue;
    if (config.location !== worker_location) continue;

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
