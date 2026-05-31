import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { moveFiles } from '../src/files.js';

let tmp_dir;

beforeEach(() => {
  tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'movefiles-'));
});

afterEach(() => {
  fs.rmSync(tmp_dir, { recursive: true, force: true });
});

function mkfile(rel_path, content = '') {
  const full = path.join(tmp_dir, rel_path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function exists(rel_path) {
  return fs.existsSync(path.join(tmp_dir, rel_path));
}

function read(rel_path) {
  return fs.readFileSync(path.join(tmp_dir, rel_path), 'utf8');
}

// ── File mode ────────────────────────────────────────────────

describe('moveFiles - file mode', () => {
  it('moves files from source to target', () => {
    mkfile('src/a.txt', 'aaa');
    mkfile('src/b.txt', 'bbb');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
    });

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 2);
    assert.deepEqual(result.entries, ['a.txt', 'b.txt']);
    assert.equal(read('dst/a.txt'), 'aaa');
    assert.equal(read('dst/b.txt'), 'bbb');
    assert.ok(!exists('src/a.txt'));
    assert.ok(!exists('src/b.txt'));
  });

  it('respects batch_size', () => {
    mkfile('src/a.txt');
    mkfile('src/b.txt');
    mkfile('src/c.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      batch_size: 2,
    });

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 3);
    assert.ok(exists('src/c.txt'));
  });

  it('filters by pattern', () => {
    mkfile('src/a.pdf');
    mkfile('src/b.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      pattern: '*.pdf',
    });

    assert.equal(result.moved_count, 1);
    assert.deepEqual(result.entries, ['a.pdf']);
    assert.ok(exists('src/b.txt'));
  });

  it('returns empty result when source does not exist', () => {
    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'nope'),
      target_dir: path.join(tmp_dir, 'dst'),
    });

    assert.equal(result.moved_count, 0);
    assert.equal(result.total_available, 0);
  });

  it('skips dotfiles', () => {
    mkfile('src/.hidden');
    mkfile('src/visible.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
    });

    assert.equal(result.moved_count, 1);
    assert.ok(exists('src/.hidden'));
  });
});

// ── Directory mode ───────────────────────────────────────────

describe('moveFiles - directory mode', () => {
  it('moves directories from source to target', () => {
    mkfile('src/bundle_a/_pages/p1.pdf', 'pdf1');
    mkfile('src/bundle_b/_pages/p1.pdf', 'pdf2');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
    });

    assert.equal(result.moved_count, 2);
    assert.equal(read('dst/bundle_a/_pages/p1.pdf'), 'pdf1');
    assert.ok(!exists('src/bundle_a'));
  });

  it('merges into existing target directory', () => {
    // Simulate: first move_files puts TXTs in target
    mkfile('dst/bundle/_pages/p1.txt', 'text1');
    mkfile('dst/bundle/_pages/p2.txt', 'text2');

    // Second move_files puts PDFs from done
    mkfile('src/bundle/_pages/p1.pdf', 'pdf1');
    mkfile('src/bundle/_pages/p2.pdf', 'pdf2');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
    });

    assert.equal(result.moved_count, 1);
    // All four files should be in dst/bundle/_pages/
    assert.equal(read('dst/bundle/_pages/p1.txt'), 'text1');
    assert.equal(read('dst/bundle/_pages/p2.txt'), 'text2');
    assert.equal(read('dst/bundle/_pages/p1.pdf'), 'pdf1');
    assert.equal(read('dst/bundle/_pages/p2.pdf'), 'pdf2');
    // Source bundle should be removed
    assert.ok(!exists('src/bundle'));
  });

  it('merges nested subdirectories', () => {
    // Target already has some files
    mkfile('dst/bundle/sub1/a.txt', 'a');
    // Source has files in same and different subdirs
    mkfile('src/bundle/sub1/b.txt', 'b');
    mkfile('src/bundle/sub2/c.txt', 'c');

    moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
    });

    assert.equal(read('dst/bundle/sub1/a.txt'), 'a');
    assert.equal(read('dst/bundle/sub1/b.txt'), 'b');
    assert.equal(read('dst/bundle/sub2/c.txt'), 'c');
    assert.ok(!exists('src/bundle'));
  });

  it('moves directory normally when target does not exist', () => {
    mkfile('src/bundle/_pages/p1.pdf', 'pdf1');

    moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
    });

    assert.equal(read('dst/bundle/_pages/p1.pdf'), 'pdf1');
    assert.ok(!exists('src/bundle'));
  });

  it('skips dot-directories', () => {
    mkfile('src/.hidden/file.txt');
    mkfile('src/visible/file.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
    });

    assert.equal(result.moved_count, 1);
    assert.ok(exists('src/.hidden'));
  });

  it('respects batch_size in directory mode', () => {
    mkfile('src/a/file.txt');
    mkfile('src/b/file.txt');
    mkfile('src/c/file.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      mode: 'directories',
      batch_size: 2,
    });

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 3);
    assert.ok(exists('src/c'));
  });
});

// ── Recursive file mode ─────────────────────────────────────

describe('moveFiles - recursive mode', () => {
  it('collects files from subdirectories and flattens into target', () => {
    mkfile('src/vendor-a/invoice1.pdf', 'pdf1');
    mkfile('src/vendor-b/invoice2.pdf', 'pdf2');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 2);
    assert.deepEqual(result.entries, ['vendor-a__invoice1.pdf', 'vendor-b__invoice2.pdf']);
    assert.equal(read('dst/vendor-a__invoice1.pdf'), 'pdf1');
    assert.equal(read('dst/vendor-b__invoice2.pdf'), 'pdf2');
  });

  it('includes top-level files alongside nested files', () => {
    mkfile('src/top.pdf', 'top');
    mkfile('src/sub/nested.pdf', 'nested');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.equal(result.moved_count, 2);
    assert.ok(result.entries.includes('top.pdf'));
    assert.ok(result.entries.includes('sub__nested.pdf'));
    assert.equal(read('dst/top.pdf'), 'top');
    assert.equal(read('dst/sub__nested.pdf'), 'nested');
  });

  it('handles deeply nested subdirectories', () => {
    mkfile('src/a/b/c/deep.txt', 'deep');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.equal(result.moved_count, 1);
    assert.deepEqual(result.entries, ['a__b__c__deep.txt']);
    assert.equal(read('dst/a__b__c__deep.txt'), 'deep');
  });

  it('cleans up empty subdirectories after moving', () => {
    mkfile('src/sub/file.txt', 'data');

    moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.ok(exists('src'), 'source root should remain');
    assert.ok(!exists('src/sub'), 'empty subdir should be removed');
  });

  it('applies pattern filter in recursive mode', () => {
    mkfile('src/sub/a.pdf', 'pdf');
    mkfile('src/sub/b.txt', 'txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
      pattern: '*.pdf',
    });

    assert.equal(result.moved_count, 1);
    assert.deepEqual(result.entries, ['sub__a.pdf']);
    assert.ok(exists('src/sub/b.txt'), 'non-matching file should remain');
  });

  it('respects batch_size in recursive mode', () => {
    mkfile('src/a/file1.txt');
    mkfile('src/b/file2.txt');
    mkfile('src/c/file3.txt');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
      batch_size: 2,
    });

    assert.equal(result.moved_count, 2);
    assert.equal(result.total_available, 3);
  });

  it('skips dotfiles and dot-directories in recursive mode', () => {
    mkfile('src/.hidden/secret.txt');
    mkfile('src/visible/.dotfile');
    mkfile('src/visible/normal.txt', 'ok');

    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'src'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.equal(result.moved_count, 1);
    assert.deepEqual(result.entries, ['visible__normal.txt']);
    assert.ok(exists('src/.hidden/secret.txt'));
    assert.ok(exists('src/visible/.dotfile'));
  });

  it('returns empty result when source does not exist', () => {
    const result = moveFiles({
      source_dir: path.join(tmp_dir, 'nope'),
      target_dir: path.join(tmp_dir, 'dst'),
      recursive: true,
    });

    assert.equal(result.moved_count, 0);
    assert.equal(result.total_available, 0);
  });
});
