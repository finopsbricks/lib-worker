/**
 * File and directory movement utilities for worker steps.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Simple pattern match: '*' matches all, '*.pdf' matches .pdf extension, exact name matches exact.
 * @param {string} filename
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesPattern(filename, pattern) {
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) return filename.endsWith(pattern.slice(1));
  return filename === pattern;
}

/**
 * Recursively merge src directory into dst, then remove src.
 * Files in src are moved into dst; subdirectories are merged recursively.
 */
function mergeDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      mergeDir(s, d);
    } else {
      fs.renameSync(s, d);
    }
  }
  fs.rmSync(src, { recursive: true });
}

/**
 * Recursively collect files from dir and all subdirectories.
 * Returns array of { rel_path, full_path } where rel_path is relative to base_dir.
 */
function collectFilesRecursive(dir, pattern, base_dir = dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue;
    const full_path = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      entries.push(...collectFilesRecursive(full_path, pattern, base_dir));
    } else if (dirent.isFile() && matchesPattern(dirent.name, pattern)) {
      entries.push({ rel_path: path.relative(base_dir, full_path), full_path });
    }
  }
  return entries;
}

/**
 * Remove empty directories bottom-up starting from dir, stopping at (but not removing) stop_at.
 */
function removeEmptyDirs(dir, stop_at) {
  if (!fs.existsSync(dir)) return;
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      removeEmptyDirs(path.join(dir, dirent.name), stop_at);
    }
  }
  if (dir !== stop_at && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

/**
 * Move files or directories from source_dir to target_dir.
 *
 * @param {object} options
 * @param {string} options.source_dir - Absolute path to source directory
 * @param {string} options.target_dir - Absolute path to target directory
 * @param {'files' | 'directories'} [options.mode='files'] - What to move
 * @param {string} [options.pattern='*'] - Glob-like filter for files ('*', '*.pdf', 'exact.json')
 * @param {number} [options.batch_size=100] - Max entries to move per call
 * @param {boolean} [options.recursive=false] - Walk subdirectories (files mode only), flatten into target
 * @returns {{ moved_count: number, total_available: number, entries: string[] }}
 */
export function moveFiles({
  source_dir,
  target_dir,
  mode = 'files',
  pattern = '*',
  batch_size = 100,
  recursive = false,
} = {}) {
  const empty_result = { moved_count: 0, total_available: 0, entries: [] };

  if (!fs.existsSync(source_dir)) {
    return empty_result;
  }

  // Recursive file collection: walk subdirs, flatten into target
  if (recursive && mode === 'files') {
    const all_files = collectFilesRecursive(source_dir, pattern).sort((a, b) =>
      a.rel_path.localeCompare(b.rel_path),
    );

    if (all_files.length === 0) return empty_result;

    const batch = all_files.slice(0, batch_size);
    fs.mkdirSync(target_dir, { recursive: true });

    const entries = [];
    for (const file of batch) {
      // Flatten: vendor-a/file.pdf → vendor-a__file.pdf
      const flat_name = file.rel_path.includes(path.sep)
        ? file.rel_path.replaceAll(path.sep, '__')
        : file.rel_path;
      fs.renameSync(file.full_path, path.join(target_dir, flat_name));
      entries.push(flat_name);
    }

    removeEmptyDirs(source_dir, source_dir);

    return { moved_count: entries.length, total_available: all_files.length, entries };
  }

  const dirents = fs.readdirSync(source_dir, { withFileTypes: true });
  let all_entries;

  if (mode === 'directories') {
    all_entries = dirents
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
      .sort();
  } else {
    all_entries = dirents
      .filter(d => d.isFile() && !d.name.startsWith('.') && matchesPattern(d.name, pattern))
      .map(d => d.name)
      .sort();
  }

  if (all_entries.length === 0) {
    return empty_result;
  }

  const batch = all_entries.slice(0, batch_size);

  fs.mkdirSync(target_dir, { recursive: true });

  for (const entry of batch) {
    const src = path.join(source_dir, entry);
    const dst = path.join(target_dir, entry);

    if (mode === 'directories' && fs.existsSync(dst)) {
      // Target dir exists — merge contents recursively
      mergeDir(src, dst);
    } else {
      fs.renameSync(src, dst);
    }
  }

  return { moved_count: batch.length, total_available: all_entries.length, entries: batch };
}
