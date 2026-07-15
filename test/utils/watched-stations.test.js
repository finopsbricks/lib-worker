import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const { resolveWatchedStations } = await import('../../src/utils/watched-stations.js');

let tmp_dir;
let original_cwd;
let original_location;

/**
 * @param {string} filename
 * @param {object} config
 */
function writeStationFile(filename, config) {
  const dir = path.join(tmp_dir, '.orchestrator', 'stations');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(config));
}

describe('resolveWatchedStations', () => {
  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watched-stations-'));
    original_cwd = process.cwd();
    original_location = process.env.WORKER_LOCATION;
    process.chdir(tmp_dir);
    process.env.WORKER_LOCATION = 'alex-laptop1';
  });

  afterEach(() => {
    process.chdir(original_cwd);
    if (original_location === undefined) delete process.env.WORKER_LOCATION;
    else process.env.WORKER_LOCATION = original_location;
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  });

  it('derives source_station/source_bin for a watch_enabled station at this location', async () => {
    writeStationFile('CAR1__capture_listing.json', {
      id: 'maaopXWtoU7I',
      short_code: 'CAR1',
      location: 'alex-laptop1',
      watch_enabled: true,
      steps: [
        { slug: 'lib-worker:move_files', config: { source_bin: 'CAR0/output' } },
        { slug: 'CAR1_01_capture_listing', config: {} },
      ],
    });

    const watched = await resolveWatchedStations();

    assert.deepEqual(watched, [
      { station: 'CAR1', station_id: 'maaopXWtoU7I', source_station: 'CAR0', source_bin: 'output' },
    ]);
  });

  it('skips stations with watch_enabled false or unset', async () => {
    writeStationFile('AV1__verify_balance.json', {
      id: 'av1id',
      short_code: 'AV1',
      location: 'alex-laptop1',
      watch_enabled: false,
      steps: [{ slug: 'lib-worker:move_files', config: { source_bin: 'AV0/output' } }],
    });
    writeStationFile('M0__discover_urls.json', {
      id: 'm0id',
      short_code: 'M0',
      location: 'alex-laptop1',
      steps: [{ slug: 'M0_01_discover_urls', config: {} }],
    });

    const watched = await resolveWatchedStations();

    assert.deepEqual(watched, []);
  });

  it('skips watch_enabled stations at a different location', async () => {
    writeStationFile('VM2__extract_apple_transcript.json', {
      id: 'vm2id',
      short_code: 'VM2',
      location: 'alex-laptop',
      watch_enabled: true,
      steps: [{ slug: 'lib-worker:move_files', config: { source_bin: 'VM0/output' } }],
    });

    const watched = await resolveWatchedStations();

    assert.deepEqual(watched, []);
  });

  it('preserves a nested bin path (e.g. a human-approval-gated conveyor)', async () => {
    writeStationFile('BK-SR2__apply_approved_period.json', {
      id: 'I7ikKYcDo7XH',
      short_code: 'BK-SR2',
      location: 'alex-laptop1',
      watch_enabled: true,
      steps: [{ slug: 'lib-worker:move_files', config: { source_bin: 'BK-SR1/output/approved' } }],
    });

    const watched = await resolveWatchedStations();

    assert.deepEqual(watched, [
      { station: 'BK-SR2', station_id: 'I7ikKYcDo7XH', source_station: 'BK-SR1', source_bin: 'output/approved' },
    ]);
  });

  it('throws when a watch_enabled station has no id (not pushed live yet)', async () => {
    writeStationFile('CAR1__capture_listing.json', {
      short_code: 'CAR1',
      location: 'alex-laptop1',
      watch_enabled: true,
      steps: [{ slug: 'lib-worker:move_files', config: { source_bin: 'CAR0/output' } }],
    });

    await assert.rejects(() => resolveWatchedStations(), /has no id — push it live first/);
  });

  it('throws when a watch_enabled station has no move_files step0', async () => {
    writeStationFile('CAR1__capture_listing.json', {
      id: 'maaopXWtoU7I',
      short_code: 'CAR1',
      location: 'alex-laptop1',
      watch_enabled: true,
      steps: [{ slug: 'CAR1_01_capture_listing', config: {} }],
    });

    await assert.rejects(() => resolveWatchedStations(), /no move_files step0 with source_bin to watch/);
  });
});
