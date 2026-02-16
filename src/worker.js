/**
 * Worker polling loop
 *
 * Polls orchestrator for tasks, dispatches to handlers, reports results.
 */

import { validateEnv } from './validate-env.js';
import { initTemplates } from './utils/template-renderer.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll the orchestrator for a task
 * @returns {Promise<object|null>}
 */
async function pollForTask() {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${url}/api/worker/poll`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
        'X-Worker-Type': process.env.WORKER_TYPE || 'customer',
        'X-Worker-Org': process.env.WORKER_ORG,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Worker] Poll failed:', response.status, error);
      return null;
    }

    const data = await response.json();
    return data.task;
  } catch (error) {
    console.error('[Worker] Poll error:', error.message);
    return null;
  }
}

/**
 * Report task completion to orchestrator
 * @param {string} step_queue_id
 * @param {object} output
 */
async function reportComplete(step_queue_id, output) {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${url}/api/worker/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step_queue_id, output }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Worker] Complete report failed:', response.status, error);
    }
  } catch (error) {
    console.error('[Worker] Complete report error:', error.message);
  }
}

/**
 * Report task failure to orchestrator
 * @param {string} step_queue_id
 * @param {string} error
 * @param {boolean} retryable
 */
async function reportFailed(step_queue_id, error, retryable = true) {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${url}/api/worker/failed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step_queue_id, error, retryable }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Worker] Failed report failed:', response.status, err);
    }
  } catch (err) {
    console.error('[Worker] Failed report error:', err.message);
  }
}

/**
 * Execute a task
 * @param {object} task
 * @param {function} getHandler
 */
async function executeTask(task, getHandler) {
  const { step_queue_id, step } = task;

  console.log(`[Worker] Executing ${step_queue_id}: ${step.slug}`);

  const handler = getHandler(step.slug);

  if (!handler) {
    console.error(`[Worker] No handler for slug: ${step.slug}`);
    await reportFailed(step_queue_id, `Unknown slug: ${step.slug}`, false);
    return;
  }

  try {
    const output = await handler(task);
    console.log(`[Worker] Task ${step_queue_id} completed successfully`);
    await reportComplete(step_queue_id, output);
  } catch (error) {
    console.error(`[Worker] Task ${step_queue_id} failed:`, error.message);
    await reportFailed(step_queue_id, error.message, true);
  }
}

/**
 * Start the worker polling loop
 * @param {object} options
 * @param {function} options.getHandler - Function to resolve slug to handler
 * @param {string} options.callerUrl - import.meta.url from the worker's entry point (for template resolution)
 * @param {object} options.validateOptions - Options for validateEnv
 */
export async function startWorker({ getHandler, callerUrl, validateOptions = {} }) {
  validateEnv(validateOptions);

  // Initialize templates directory for renderTemplate()
  if (callerUrl) {
    initTemplates(callerUrl);
  }

  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';
  const workerType = process.env.WORKER_TYPE || 'customer';
  const pollInterval = parseInt(process.env.POLL_INTERVAL_MS) || 2000;

  console.log('================================================');
  console.log('[Worker] Starting customer worker...');
  console.log('[Worker] Orchestrator:', orchestratorUrl);
  console.log('[Worker] Type:', workerType);
  console.log('[Worker] Org:', process.env.WORKER_ORG);
  console.log('[Worker] Poll interval:', pollInterval, 'ms');
  console.log('================================================');

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Worker] Received SIGTERM, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Worker] Received SIGINT, shutting down...');
    process.exit(0);
  });

  while (true) {
    const task = await pollForTask();

    if (task) {
      await executeTask(task, getHandler);
    }

    await sleep(pollInterval);
  }
}
