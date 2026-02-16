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

/**
 * Write content to local temp folder.
 * Written in all environments (needed by CLI-based LLM steps).
 * Cleaned up after process completion in production (see clearTemp).
 */
function writeToLocalTemp(work_record_id, filename, content) {
  try {
    const dir = path.join('temp', work_record_id);
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
    const dir = path.join('temp', work_record_id);
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
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  // Write to local temp
  const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '_');
  writeToLocalTemp(work_record_id, `${step_slug}_${safeTitle}.md`, content);

  try {
    const response = await fetch(`${url}/api/worker/attach-document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
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
 * Attach the final report to a work record
 * @param {string} work_record_id
 * @param {string} content - Markdown content
 */
export async function attachReport(work_record_id, content) {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  // Write to local temp
  writeToLocalTemp(work_record_id, 'report.md', content);

  try {
    const response = await fetch(`${url}/api/worker/attach-report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
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
