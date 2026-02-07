/**
 * @fob/worker-core
 *
 * Shared worker infrastructure for process engine workers.
 */

// Core worker
export { startWorker } from './worker.js';
export { validateEnv } from './validate-env.js';

// Orchestrator integration
export { attachDocument, attachReport, clearTemp } from './orchestrator.js';

// API clients
export * as txn from './apps/txn.js';
export * as passthrough from './apps/passthrough.js';

// Utilities
export {
  formatAmount,
  calculateDailyBalances,
  compareBalances,
  findPeriodOpeningBalance,
  findPeriodClosingBalance,
} from './utils/balance-calculator.js';

// Report generators (template-based, async)
export {
  generateBalanceReport,
  generateComparisonReport,
} from './utils/report-generators.js';

// Template rendering
export { renderTemplate } from './utils/template-renderer.js';
