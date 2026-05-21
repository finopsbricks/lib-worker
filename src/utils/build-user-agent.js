/**
 * Build a user agent string for this worker process.
 *
 * Format mimics browser UA strings:
 * fob-worker/<lib_version> (<os> <arch>; <hostname>; <username>; pid:<pid>) node/<node_version> worker/<worker_version> ram:<gb>GB cpu:<count>x<model> cwd:<dir> sudo:<yes|no>
 *
 * Example:
 * fob-worker/0.13.0 (linux x64; ip-172-31-4-52; ubuntu; pid:3847) node/20.11.0 worker/1.2.0 ram:16GB cpu:4xIntel_Xeon_E5-2676 cwd:/home/ubuntu/workers/nowapps sudo:no
 */

import os from 'os';
import { createRequire } from 'module';

/**
 * @param {object} [options]
 * @param {string} [options.callerUrl] - import.meta.url from the worker entry point (to find worker package.json)
 * @returns {string}
 */
export function buildUserAgent(options = {}) {
  // lib-worker version from our own package.json
  const require_fn = createRequire(import.meta.url);
  let lib_version = 'unknown';
  try {
    const pkg = require_fn('../../package.json');
    lib_version = pkg.version;
  } catch {
    // fallback
  }

  // Worker repo version (from caller's package.json)
  // callerUrl is typically src/index.js, so package.json is one level up
  let worker_version = 'unknown';
  if (options.callerUrl) {
    try {
      const caller_require = createRequire(options.callerUrl);
      const caller_pkg = caller_require('../package.json');
      worker_version = caller_pkg.version || 'unknown';
    } catch {
      // Worker may not have package.json at expected path
    }
  }

  const platform = os.platform();
  const arch = os.arch();
  const hostname = os.hostname();

  let username = 'unknown';
  try {
    username = os.userInfo().username;
  } catch {
    // May fail in some environments
  }

  const pid = process.pid;
  const node_version = process.version.replace('v', '');
  const ram_gb = Math.round(os.totalmem() / (1024 * 1024 * 1024));

  const cpus = os.cpus();
  const cpu_count = cpus.length;
  const cpu_model = cpus.length > 0
    ? cpus[0].model.replace(/\s+/g, '_').replace(/[()@]/g, '').substring(0, 40)
    : 'unknown';

  const cwd = process.cwd();

  let is_sudo = false;
  try {
    is_sudo = process.getuid?.() === 0;
  } catch {
    // getuid not available on Windows
  }

  const parts = [
    `fob-worker/${lib_version}`,
    `(${platform} ${arch}; ${hostname}; ${username}; pid:${pid})`,
    `node/${node_version}`,
    `worker/${worker_version}`,
    `ram:${ram_gb}GB`,
    `cpu:${cpu_count}x${cpu_model}`,
    `cwd:${cwd}`,
    `sudo:${is_sudo ? 'yes' : 'no'}`,
  ];

  return parts.join(' ');
}
