/**
 * Report Generators - Template-based report generation
 *
 * These functions generate markdown reports using EJS templates.
 * Templates are in lib-worker/src/templates/reports/.
 */

import { renderTemplate } from './template-renderer.js';

/**
 * Generate markdown balance report
 *
 * @param {Object} options
 * @param {Object} options.balances - Daily balance data keyed by date
 * @param {string} options.title - Report title
 * @param {Object} options.metadata - Additional metadata (file_name, period_start, period_end, opening_balance, balance_source)
 * @returns {Promise<string>} Formatted markdown report
 */
export async function generateBalanceReport({ balances, title, metadata = {} }) {
  return renderTemplate('reports/balance-report', {
    balances,
    title,
    metadata,
  });
}

/**
 * Generate markdown comparison report
 *
 * @param {Object} options
 * @param {string} options.statement_id - Statement ID
 * @param {string} options.file_name - Statement file name
 * @param {string} options.account_id - Account ID
 * @param {string} options.period_start - Period start date
 * @param {string} options.period_end - Period end date
 * @param {Object} options.comparison - Comparison result from compareBalances
 * @returns {Promise<string>} Formatted markdown comparison report
 */
export async function generateComparisonReport({ statement_id, file_name, account_id, period_start, period_end, comparison }) {
  return renderTemplate('reports/comparison-report', {
    statement_id,
    file_name,
    account_id,
    period_start,
    period_end,
    comparison,
  });
}
