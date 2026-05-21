/**
 * Worker polling loop
 *
 * Polls orchestrator for tasks, dispatches to handlers, reports results.
 */

import { validateEnv } from './validate-env.js';
import { initTemplates } from './utils/template-renderer.js';
import { buildUserAgent } from './utils/build-user-agent.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** User agent string (built once at startup) */
let worker_user_agent = null;

/** Session ID assigned by the orchestrator */
let session_id = null;

/** Get the current session ID (for use by orchestrator.js helpers) */
export function getSessionId() {
  return session_id;
}

/**
 * Poll the orchestrator for a task
 * @returns {Promise<object|null>}
 */
async function pollForTask() {
  const url = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  const headers = {
    'api-key': process.env.ORCHESTRATOR_API_KEY,
    'api-secret': process.env.ORCHESTRATOR_API_SECRET,
    'X-Location': process.env.WORKER_LOCATION,
  };

  if (worker_user_agent) {
    headers['X-Worker-User-Agent'] = worker_user_agent;
  }
  if (session_id) {
    headers['X-Worker-Session'] = session_id;
  }

  try {
    const response = await fetch(`${url}/api/worker/poll`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Worker] Poll failed:', response.status, error);
      return null;
    }

    const data = await response.json();

    // Store session ID assigned by the orchestrator
    if (data.session_id && data.session_id !== session_id) {
      if (!session_id) {
        console.log(`[Worker] Session established: ${data.session_id}`);
      }
      session_id = data.session_id;
    }

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

  const headers = {
    'api-key': process.env.ORCHESTRATOR_API_KEY,
    'api-secret': process.env.ORCHESTRATOR_API_SECRET,
    'Content-Type': 'application/json',
  };
  if (session_id) {
    headers['X-Worker-Session'] = session_id;
  }

  try {
    const response = await fetch(`${url}/api/worker/complete`, {
      method: 'POST',
      headers,
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

  const headers = {
    'api-key': process.env.ORCHESTRATOR_API_KEY,
    'api-secret': process.env.ORCHESTRATOR_API_SECRET,
    'Content-Type': 'application/json',
  };
  if (session_id) {
    headers['X-Worker-Session'] = session_id;
  }

  try {
    const response = await fetch(`${url}/api/worker/failed`, {
      method: 'POST',
      headers,
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

  // Build user agent string once at startup
  worker_user_agent = buildUserAgent({ callerUrl });

  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';
  const pollInterval = parseInt(process.env.POLL_INTERVAL_MS) || 2000;

  console.log('================================================');
  console.log('[Worker] Starting worker...');
  console.log('[Worker] Orchestrator:', orchestratorUrl);
  console.log('[Worker] Location:', process.env.WORKER_LOCATION);
  console.log('[Worker] Poll interval:', pollInterval, 'ms');
  console.log('[Worker] User-Agent:', worker_user_agent);
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
