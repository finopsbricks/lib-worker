import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// `bin()` in workerPaths.js captures `process.cwd()` at module-load time.
// We must chdir into a tmp dir BEFORE importing the modules under test.
const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpiece-station-test-'));
const original_cwd = process.cwd();
process.chdir(tmp_root);

const { processWorkpiece } = await import('../src/utils/workpiece-station.js');
const { bin } = await import('../src/workerPaths.js');

after(() => {
  process.chdir(original_cwd);
  fs.rmSync(tmp_root, { recursive: true, force: true });
});

beforeEach(() => {
  // Reset bins under tmp_root before each test
  const stations_dir = path.join(tmp_root, 'temp', 'stations');
  if (fs.existsSync(stations_dir)) {
    fs.rmSync(stations_dir, { recursive: true, force: true });
  }
});

function seedInput(station, workpiece_id, files = {}) {
  const wp = path.join(bin(station, 'input'), workpiece_id);
  fs.mkdirSync(wp, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(wp, name), content);
  }
  return wp;
}

describe('processWorkpiece - failure capture', () => {
  it('writes error.json with all enumerable error fields', async () => {
    seedInput('TST', 'wp1', { 'pointer.json': '{"id":"wp1"}' });

    const result = await processWorkpiece({
      station: 'TST',
      workpiece_id: 'wp1',
      body: async () => {
        throw Object.assign(new Error('Upstream 502 Bad Gateway'), {
          status: 502,
          statusText: 'Bad Gateway',
          headers: '{cf-ray=abc; retry-after=60}',
          body: '<html>...long body...</html>',
        });
      },
    });

    assert.equal(result.status, 'failed');

    const error_json_path = path.join(bin('TST', 'failed'), 'wp1', 'error.json');
    assert.ok(fs.existsSync(error_json_path), 'error.json should exist');
    const json = JSON.parse(fs.readFileSync(error_json_path, 'utf8'));

    assert.equal(json.name, 'Error');
    assert.equal(json.message, 'Upstream 502 Bad Gateway');
    assert.equal(json.status, 502);
    assert.equal(json.statusText, 'Bad Gateway');
    assert.equal(json.headers, '{cf-ray=abc; retry-after=60}');
    assert.equal(json.body, '<html>...long body...</html>');
    assert.ok(json.failed_at);
    assert.ok(json.stack);
  });

  it('writes human-readable error.txt with field summary and truncated body', async () => {
    const long_body = 'X'.repeat(600);
    seedInput('TST', 'wp2', { 'pointer.json': '{}' });

    await processWorkpiece({
      station: 'TST',
      workpiece_id: 'wp2',
      body: async () => {
        throw Object.assign(new Error('boom'), {
          status: 502,
          body: long_body,
        });
      },
    });

    const txt = fs.readFileSync(
      path.join(bin('TST', 'failed'), 'wp2', 'error.txt'),
      'utf8',
    );

    assert.match(txt, /Error: boom/, 'name + message present');
    assert.match(txt, /status: 502/, 'status field present');
    assert.match(txt, /body: X{500}…\[\+100 chars, see error\.json\]/, 'body truncated with pointer to JSON');
    assert.match(txt, /at /, 'stack trace present');

    // Message must not appear twice (stack already includes it)
    const message_occurrences = txt.split('Error: boom').length - 1;
    assert.equal(message_occurrences, 1, 'message should appear once, not duplicated by an extra line');
  });

  it('handles errors with no extra fields (just message + stack)', async () => {
    seedInput('TST', 'wp3', {});

    await processWorkpiece({
      station: 'TST',
      workpiece_id: 'wp3',
      body: async () => { throw new Error('plain failure'); },
    });

    const failed_dir = path.join(bin('TST', 'failed'), 'wp3');
    const json = JSON.parse(fs.readFileSync(path.join(failed_dir, 'error.json'), 'utf8'));
    assert.equal(json.message, 'plain failure');
    assert.ok(json.stack);
    assert.equal(json.body, undefined);

    const txt = fs.readFileSync(path.join(failed_dir, 'error.txt'), 'utf8');
    assert.match(txt, /Error: plain failure/);
    assert.doesNotMatch(txt, /body:/, 'no body line when err.body absent');
  });
});
