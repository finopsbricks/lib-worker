/**
 * @fob/worker-core
 *
 * Shared worker infrastructure for process engine workers.
 */

/**
 * Task received from the orchestrator for step execution.
 *
 * @typedef {object} Task
 * @property {string} step_queue_id - StepQueue ID for reporting completion
 * @property {object} step - Step definition
 * @property {string} step.slug - Step slug, maps to handler function (e.g., 'alex/fetch_data')
 * @property {object} step.config - Step configuration from process definition
 * @property {object} work_record - Work record context
 * @property {string} work_record.id - Work record ID for document attachments
 * @property {object} work_record.item_snapshot - Primary entity being processed
 * @property {Object<string, object>} work_record.step_outputs - Outputs from previous steps keyed by slug
 * @property {string} org_id - Organization ID
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
