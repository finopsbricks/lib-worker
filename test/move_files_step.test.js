import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmp_dir;

// Mock orchestrator (attachReport is an HTTP call we don't want)
const attachReportCalls = [];
mock.module('../src/orchestrator.js', {
  namedExports: {
    attachReport: async (...args) => { attachReportCalls.push(args); },
  },
});

// Mock workerPaths so bin() resolves to our tmp dir
mock.module('../src/workerPaths.js', {
  namedExports: {
    bin: (station, type) => {
      const dir = path.join(tmp_dir, 'stations', station, type);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },
  },
});

// Import step AFTER mocks are in place
const { default: moveFilesStep } = await import('../src/steps/move_files.js');

// ── Helpers ──────────────────────────────────────────────────

function mkfile(rel_path, content = '') {
  const full = path.join(tmp_dir, rel_path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function exists(rel_path) {
  return fs.existsSync(path.join(tmp_dir, rel_path));
}

const mockContext = { work_record: { id: 'wr_test_123' } };

// ── Schema validation ────────────────────────────────────────

describe('move_files inputSchema', () => {
  it('accepts simple config', () => {
    const result = moveFilesStep.inputSchema.safeParse({
      source_bin: 'HI1/output',
      target_bin: 'HI3/input',
    });
    assert.ok(result.success);
    assert.equal(result.data.source_bin, 'HI1/output');
    assert.equal(result.data.mode, 'files');
    assert.equal(result.data.pattern, '*');
    assert.equal(result.data.batch_size, 100);
  });

  it('accepts moves array', () => {
    const result = moveFilesStep.inputSchema.safeParse({
      moves: [
        { source_bin: 'HI1/output', target_bin: 'HI3/input' },
        { source_bin: 'HI1/done', target_bin: 'HI3/input', mode: 'directories' },
      ],
    });
    assert.ok(result.success);
    assert.equal(result.data.moves.length, 2);
    assert.equal(result.data.moves[1].mode, 'directories');
  });

  it('rejects empty moves array', () => {
    const result = moveFilesStep.inputSchema.safeParse({ moves: [] });
    assert.ok(!result.success);
  });

  it('rejects config without source_bin or moves', () => {
    const result = moveFilesStep.inputSchema.safeParse({ target_bin: 'HI3/input' });
    assert.ok(!result.success);
  });
});

// ── Execute ──────────────────────────────────────────────────

describe('move_files execute', () => {
  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'move-files-step-'));
    attachReportCalls.length = 0;
  });

  afterEach(() => {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  });

  it('simple config still works', async () => {
    mkfile('stations/HI1/output/a.txt', 'aaa');
    mkfile('stations/HI1/output/b.txt', 'bbb');

    const result = await moveFilesStep.execute(
      { source_bin: 'HI1/output', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
      mockContext,
    );

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 2);
    assert.deepEqual(result.entries, ['a.txt', 'b.txt']);
    assert.ok(exists('stations/HI3/input/a.txt'));
    assert.ok(!exists('stations/HI1/output/a.txt'));
    assert.equal(attachReportCalls.length, 1);
    assert.equal(attachReportCalls[0][0], 'wr_test_123');
  });

  it('moves array with two moves aggregates counts', async () => {
    mkfile('stations/HI1/output/a.txt', 'aaa');
    mkfile('stations/HI1/done/b.txt', 'bbb');
    mkfile('stations/HI1/done/c.txt', 'ccc');

    const config = {
      moves: [
        { source_bin: 'HI1/output', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
        { source_bin: 'HI1/done', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
      ],
    };

    const result = await moveFilesStep.execute(config, mockContext);

    assert.equal(result.moved_count, 3);
    assert.equal(result.total_available, 3);
    assert.deepEqual(result.entries, ['a.txt', 'b.txt', 'c.txt']);
    assert.ok(exists('stations/HI3/input/a.txt'));
    assert.ok(exists('stations/HI3/input/b.txt'));
    assert.ok(exists('stations/HI3/input/c.txt'));
    assert.equal(attachReportCalls.length, 1);
  });

  it('moves array with different modes', async () => {
    mkfile('stations/HI1/output/doc.pdf', 'pdf');
    mkfile('stations/HI1/done/bundle_a/page.txt', 'text');

    const config = {
      moves: [
        { source_bin: 'HI1/output', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
        { source_bin: 'HI1/done', target_bin: 'HI3/input', mode: 'directories', pattern: '*', batch_size: 100 },
      ],
    };

    const result = await moveFilesStep.execute(config, mockContext);

    assert.equal(result.moved_count, 2);
    assert.deepEqual(result.entries, ['doc.pdf', 'bundle_a']);
    assert.ok(exists('stations/HI3/input/doc.pdf'));
    assert.ok(exists('stations/HI3/input/bundle_a/page.txt'));
  });

  it('one move has nothing to transfer', async () => {
    // First source is empty (doesn't exist), second has files
    mkfile('stations/HI1/done/x.txt', 'xxx');

    const config = {
      moves: [
        { source_bin: 'HI1/output', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
        { source_bin: 'HI1/done', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
      ],
    };

    const result = await moveFilesStep.execute(config, mockContext);

    assert.equal(result.moved_count, 1);
    assert.equal(result.total_available, 1);
    assert.deepEqual(result.entries, ['x.txt']);
  });

  it('report contains per-move breakdown', async () => {
    mkfile('stations/HI1/output/a.txt', 'aaa');
    mkfile('stations/HI1/done/b.txt', 'bbb');

    const config = {
      moves: [
        { source_bin: 'HI1/output', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
        { source_bin: 'HI1/done', target_bin: 'HI3/input', mode: 'files', pattern: '*', batch_size: 100 },
      ],
    };

    await moveFilesStep.execute(config, mockContext);

    const report = attachReportCalls[0][1];
    assert.ok(report.includes('HI1/output'));
    assert.ok(report.includes('HI1/done'));
    assert.ok(report.includes('HI3/input'));
    assert.ok(report.includes('**Total moved**: 2 / 2 available'));
  });
});
