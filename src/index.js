/**
 * @fob/worker-core
 *
 * Shared worker infrastructure for process engine workers.
 */

/**
 * Task received from the orchestrator for step execution.
 *
 * @typedef {object} Task
 * @property {string} id - Task identifier for reporting completion
 * @property {string} step_type - Maps to handler function (e.g., 'alex/fetch_data')
 * @property {number} step_order - Sequence number for document naming
 * @property {string} work_record_id - Target for document attachments
 * @property {object} item - Primary entity being processed
 * @property {object} context - Additional data from previous steps (includes work_record_id)
 */

// Core worker
export { startWorker } from './worker.js';
export { validateEnv } from './validate-env.js';

// Orchestrator integration
export { attachDocument, attachReport, clearTemp } from './orchestrator.js';

// API clients
export * as txn from './apps/txn.js';
export * as passthrough from './apps/passthrough.js';

// Template rendering
export { renderTemplate } from './utils/template-renderer.js';
