/**
 * Orchestrator integration
 *
 * Functions for interacting with the orchestrator:
 * - Attaching supporting documents to work records
 * - Attaching final reports
 * - Managing temp files for dev mode
 */

import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

/** Local work record IDs (from `fob steps run`) should skip remote calls. */
const isLocalRun = (work_record_id) => work_record_id.startsWith('local-');

/** Resolve the temp directory for a work record. */
function workRecordDir(work_record_id) {
  return path.join('temp', 'work_records', work_record_id);
}

/**
 * Write content to local temp folder.
 * Written in all environments (needed by CLI-based LLM steps).
 * Cleaned up after process completion in production (see clearTemp).
 */
function writeToLocalTemp(work_record_id, filename, content) {
  try {
    const dir = workRecordDir(work_record_id);
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`[Orchestrator] Wrote ${filepath}`);
  } catch (err) {
    console.error('[Orchestrator] Failed to write local file:', err.message);
  }
}

/**
 * Clear temp folder for a work record.
 * Skipped in dev mode so files remain for inspection.
 */
export function clearTemp(work_record_id) {
  if (isDev) {
    console.log(`[Orchestrator] Dev: skipping temp cleanup for ${work_record_id}`);
    return;
  }
  try {
    const dir = workRecordDir(work_record_id);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[Orchestrator] Cleared temp: ${dir}`);
  } catch (err) {
    console.error('[Orchestrator] Failed to clear temp:', err.message);
  }
}

/**
 * Attach a supporting document to a work record
 * @param {string} work_record_id
 * @param {string} title
 * @param {string} content
 * @param {string} step_slug
 */
export async function attachDocument(work_record_id, title, content, step_slug) {
  // Write to local temp (just use title as filename)
  const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '_');
  writeToLocalTemp(work_record_id, `${safeTitle}.md`, content);

  if (isLocalRun(work_record_id)) return true;

  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${url}/api/worker/attach-document`, {
      method: 'POST',
      headers: {
        'api-key': process.env.ORCHESTRATOR_API_KEY,
        'api-secret': process.env.ORCHESTRATOR_API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_record_id,
        title,
        content,
        step_slug,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Orchestrator] attach-document failed:', response.status, error);
      return false;
    }

    console.log(`[Orchestrator] Document attached: "${title}"`);
    return true;
  } catch (error) {
    console.error('[Orchestrator] attach-document error:', error.message);
    return false;
  }
}

/**
 * Attach a binary file to a work record
 * @param {string} work_record_id
 * @param {string} title - Display title
 * @param {string} filepath - Path to the file on disk
 * @param {string} step_slug
 */
export async function attachFile(work_record_id, title, filepath, step_slug) {
  // Copy to local temp (always, for dev inspection)
  try {
    const dir = workRecordDir(work_record_id);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(filepath));
    fs.copyFileSync(filepath, dest);
    console.log(`[Orchestrator] Copied ${filepath} → ${dest}`);
  } catch (err) {
    console.error('[Orchestrator] Failed to copy file to temp:', err.message);
  }

  if (isLocalRun(work_record_id)) return true;

  const MIME_MAP = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  const ext = path.extname(filepath).toLowerCase();
  const mime_type = MIME_MAP[ext] || 'application/octet-stream';
  const filename = path.basename(filepath);

  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const file_buffer = fs.readFileSync(filepath);
    const content_base64 = file_buffer.toString('base64');

    const response = await fetch(`${url}/api/worker/attach-file`, {
      method: 'POST',
      headers: {
        'api-key': process.env.ORCHESTRATOR_API_KEY,
        'api-secret': process.env.ORCHESTRATOR_API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_record_id,
        title,
        step_slug,
        filename,
        mime_type,
        content_base64,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Orchestrator] attach-file failed:', response.status, error);
      return false;
    }

    console.log(`[Orchestrator] File attached: "${title}" (${filename})`);
    return true;
  } catch (error) {
    console.error('[Orchestrator] attach-file error:', error.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal HTTP helpers (reuse auth from env)
// ---------------------------------------------------------------------------

async function orchestratorGet(urlPath) {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';
  const res = await fetch(`${url}${urlPath}`, {
    headers: {
      'api-key': process.env.ORCHESTRATOR_API_KEY,
      'api-secret': process.env.ORCHESTRATOR_API_SECRET,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${urlPath}: ${res.status} — ${text}`);
  }
  return res.json();
}

async function orchestratorPost(urlPath, body) {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';
  const res = await fetch(`${url}${urlPath}`, {
    method: 'POST',
    headers: {
      'api-key': process.env.ORCHESTRATOR_API_KEY,
      'api-secret': process.env.ORCHESTRATOR_API_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${urlPath}: ${res.status} — ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Item management
// ---------------------------------------------------------------------------

/**
 * Find an item by external_id.
 * Returns the item object or null if not found.
 *
 * @param {string} external_id
 * @returns {Promise<Object|null>}
 */
export async function findItemByExternalId(external_id) {
  const result = await orchestratorGet(
    `/api/v1/items?external_id=${encodeURIComponent(external_id)}`
  );
  const items = result.data || [];
  return items.length > 0 ? items[0] : null;
}

/**
 * Create a new item.
 *
 * @param {Object} params
 * @param {string} params.type - Item type (e.g., 'msa_file')
 * @param {string} params.name - Display name
 * @param {string} params.external_id - External ID for deduplication
 * @param {Object} [params.metadata] - Arbitrary metadata
 * @returns {Promise<Object>} Created item
 */
export async function createItem({ type, name, external_id, metadata }) {
  const result = await orchestratorPost('/api/v1/items', {
    type,
    name,
    external_id,
    metadata: metadata || {},
  });
  return result.data || result;
}

/**
 * Find an existing item by external_id, or create a new one.
 *
 * @param {Object} params
 * @param {string} params.type
 * @param {string} params.name
 * @param {string} params.external_id
 * @param {Object} [params.metadata]
 * @returns {Promise<{item: Object, created: boolean}>}
 */
export async function findOrCreateItem({ type, name, external_id, metadata }) {
  const existing = await findItemByExternalId(external_id);
  if (existing) {
    return { item: existing, created: false };
  }
  const item = await createItem({ type, name, external_id, metadata });
  return { item, created: true };
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

/**
 * Run a process. Creates a work record and queues execution.
 *
 * @param {string} process_id - Process ID
 * @param {Object} [options]
 * @param {string} [options.item_id] - Item ID (required for item-scoped processes)
 * @returns {Promise<{status: string, work_record_id: string, job_id: string}>}
 */
export async function runProcess(process_id, { item_id } = {}) {
  const body = item_id ? { item_id } : {};
  const result = await orchestratorPost(`/api/v1/processes/${process_id}/run`, body);
  return result.data || result;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function attachReport(work_record_id, content) {
  // Write to local temp
  writeToLocalTemp(work_record_id, 'report.md', content);

  if (isLocalRun(work_record_id)) return true;

  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${url}/api/worker/attach-report`, {
      method: 'POST',
      headers: {
        'api-key': process.env.ORCHESTRATOR_API_KEY,
        'api-secret': process.env.ORCHESTRATOR_API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        work_record_id,
        content,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Orchestrator] attach-report failed:', response.status, error);
      return false;
    }

    console.log(`[Orchestrator] Report attached`);
    return true;
  } catch (error) {
    console.error('[Orchestrator] attach-report error:', error.message);
    return false;
  }
}
