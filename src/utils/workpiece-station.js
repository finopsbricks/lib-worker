// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { bin } from '../workerPaths.js';
import { logEvent } from './workpiece-log.js';

/**
 * @template T
 * @typedef {{ status: 'ok', value: T } | { status: 'failed', error: Error }} RunResult
 */

/**
 * Run a per-workpiece step under the 5-bin doing-bin contract.
 *
 *   1. Copy input/{workpiece_id}/ → doing/{workpiece_id}/ (full content)
 *   2. Emit station_started to doing/log.jsonl
 *   3. Call body(wp_doing) — mutates the doing-bin working copy, returns value
 *   4a. Success: emit station_complete, doing → output (replacing any prior
 *       partial), input → done
 *   4b. Failure: emit station_failed, input → failed (pristine), overlay log
 *       from doing, write error.txt, rm -rf doing
 *
 * @template T
 * @param {object} args
 * @param {string} args.station       - Station short code (e.g. 'VM2')
 * @param {string} args.workpiece_id  - Workpiece directory name
 * @param {(wp_doing: string) => Promise<T>} args.body
 * @returns {Promise<RunResult<T>>}
 */
export async function processWorkpiece({ station, workpiece_id, body }) {
  const wp_input  = path.join(bin(station, 'input'),  workpiece_id);
  const wp_doing  = path.join(bin(station, 'doing'),  workpiece_id);
  const wp_output = path.join(bin(station, 'output'), workpiece_id);
  const wp_done   = path.join(bin(station, 'done'),   workpiece_id);
  const wp_failed = path.join(bin(station, 'failed'), workpiece_id);

  fs.cpSync(wp_input, wp_doing, { recursive: true });
  logEvent(wp_doing, station, 'station_started');

  try {
    const value = await body(wp_doing);
    logEvent(wp_doing, station, 'station_complete');

    if (fs.existsSync(wp_output)) {
      fs.rmSync(wp_output, { recursive: true, force: true });
    }
    fs.renameSync(wp_doing, wp_output);
    fs.renameSync(wp_input, wp_done);

    return { status: 'ok', value };
  } catch (err) {
    logEvent(wp_doing, station, 'station_failed');
    promoteToFailed({ wp_input, wp_doing, wp_failed, err });
    return { status: 'failed', error: err };
  }
}

/**
 * @param {object} args
 * @param {string} args.wp_input
 * @param {string} args.wp_doing
 * @param {string} args.wp_failed
 * @param {Error} args.err
 */
function promoteToFailed({ wp_input, wp_doing, wp_failed, err }) {
  if (fs.existsSync(wp_failed)) {
    fs.rmSync(wp_failed, { recursive: true, force: true });
  }
  fs.renameSync(wp_input, wp_failed);

  const doing_log = path.join(wp_doing, 'log.jsonl');
  if (fs.existsSync(doing_log)) {
    fs.copyFileSync(doing_log, path.join(wp_failed, 'log.jsonl'));
  }

  fs.writeFileSync(
    path.join(wp_failed, 'error.txt'),
    `${new Date().toISOString()}\n${err.message}\n${err.stack || ''}`,
  );

  fs.rmSync(wp_doing, { recursive: true, force: true });
}
