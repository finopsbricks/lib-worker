import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// `bin()` captures process.cwd() at module-load. Match the workpiece-station
// test setup: chdir into a tmp dir before importing.
const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpiece-outcomes-test-'));
const original_cwd = process.cwd();
process.chdir(tmp_root);

const { workpieceOutcomes } = await import('../src/utils/workpiece-outcomes.js');
const { bin } = await import('../src/workerPaths.js');

after(() => {
  process.chdir(original_cwd);
  fs.rmSync(tmp_root, { recursive: true, force: true });
});

beforeEach(() => {
  const stations_dir = path.join(tmp_root, 'temp', 'stations');
  if (fs.existsSync(stations_dir)) {
    fs.rmSync(stations_dir, { recursive: true, force: true });
  }
});

function seedBin(station, bin_name, ids) {
  for (const id of ids) {
    fs.mkdirSync(path.join(bin(station, bin_name), id), { recursive: true });
  }
}

describe('workpieceOutcomes', () => {
  it('returns empty map when pending is empty', () => {
    assert.deepEqual(workpieceOutcomes('TST', []), {});
  });

  it('classifies all-done', () => {
    seedBin('TST', 'done', ['a', 'b', 'c']);
    assert.deepEqual(
      workpieceOutcomes('TST', ['a', 'b', 'c']),
      { a: 'done', b: 'done', c: 'done' },
    );
  });

  it('classifies all-failed', () => {
    seedBin('TST', 'failed', ['x', 'y']);
    assert.deepEqual(
      workpieceOutcomes('TST', ['x', 'y']),
      { x: 'failed', y: 'failed' },
    );
  });

  it('classifies a mixed batch', () => {
    seedBin('TST', 'done', ['a', 'b']);
    seedBin('TST', 'failed', ['c']);
    assert.deepEqual(
      workpieceOutcomes('TST', ['a', 'b', 'c']),
      { a: 'done', b: 'done', c: 'failed' },
    );
  });

  it('omits a workpiece still stuck in doing/ (worker bug case)', () => {
    seedBin('TST', 'done', ['a']);
    seedBin('TST', 'doing', ['b']); // stuck
    const result = workpieceOutcomes('TST', ['a', 'b']);
    assert.deepEqual(result, { a: 'done' });
    assert.ok(!('b' in result), 'b should not appear in the outcome map');
  });

  it('ignores prior-run residue in done/ and failed/ (only pending counts)', () => {
    // Prior-run leftovers
    seedBin('TST', 'done', ['old1', 'old2']);
    seedBin('TST', 'failed', ['old3']);
    // This run only processes one new item
    seedBin('TST', 'done', ['new1']);
    assert.deepEqual(
      workpieceOutcomes('TST', ['new1']),
      { new1: 'done' },
    );
  });

  it('handles a station with no bins yet (first run, line-head, etc.)', () => {
    assert.deepEqual(workpieceOutcomes('NEVER_RAN', ['ghost']), {});
  });

  it('prefers done over failed when an id is somehow in both', () => {
    // Shouldn't happen in practice, but guard the ordering
    seedBin('TST', 'done', ['x']);
    seedBin('TST', 'failed', ['x']);
    assert.deepEqual(workpieceOutcomes('TST', ['x']), { x: 'done' });
  });
});
