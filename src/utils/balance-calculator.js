/**
 * Balance calculation utilities
 * Used by verify_statement steps
 */

/**
 * Format amount for display (divide by 1000 for rupees)
 * @param {number} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  if (amount === null || amount === undefined) return '-';
  return (amount / 1000).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate daily balances from a list of transactions
 *
 * @param {Object} options
 * @param {Array} options.transactions - Array of transactions with date, inflow, outflow
 * @param {number} options.opening_balance - Opening balance (in stored format, i.e., rupees * 1000)
 * @param {string} options.period_start - Start date (YYYY-MM-DD)
 * @param {string} options.period_end - End date (YYYY-MM-DD)
 * @returns {Object|null} Daily balances keyed by date
 */
export function calculateDailyBalances({ transactions, opening_balance = 0, period_start, period_end }) {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Sort transactions by date
  const sorted_txns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Check if transactions have balance field (extracted from statement)
  const has_balance = sorted_txns.some((t) => t.balance !== undefined && t.balance !== null);

  // Group transactions by date
  const txns_by_date = {};
  for (const txn of sorted_txns) {
    const date = txn.date?.split('T')[0];
    if (!date) continue;
    if (!txns_by_date[date]) {
      txns_by_date[date] = [];
    }
    txns_by_date[date].push(txn);
  }

  // Determine period range
  const start_date = period_start || Object.keys(txns_by_date).sort()[0];
  const end_date = period_end || Object.keys(txns_by_date).sort().pop();

  if (!start_date || !end_date) {
    return null;
  }

  // Generate all dates in the period
  const all_dates = [];
  let current_date = new Date(start_date);
  const last_date = new Date(end_date);
  while (current_date <= last_date) {
    all_dates.push(current_date.toISOString().split('T')[0]);
    current_date.setDate(current_date.getDate() + 1);
  }

  const daily_balances = {};
  let running_balance = opening_balance;

  for (const date of all_dates) {
    const day_txns = txns_by_date[date] || [];
    const day_opening = running_balance;
    const inflow = day_txns.reduce((sum, t) => sum + (t.inflow || 0), 0);
    const outflow = day_txns.reduce((sum, t) => sum + (t.outflow || 0), 0);

    const closing_balance = day_opening + inflow - outflow;
    running_balance = closing_balance;

    // Verify computed balance matches at least one transaction's extracted balance
    let balance_verified = null;
    if (has_balance && day_txns.length > 0) {
      const extracted_balances = day_txns.map((t) => t.balance);
      balance_verified = extracted_balances.includes(closing_balance);
    }

    daily_balances[date] = {
      opening_balance: day_opening,
      inflow,
      outflow,
      closing_balance,
      transaction_count: day_txns.length,
      balance_verified,
    };
  }

  return {
    balance_source: has_balance ? 'computed_verified' : 'computed',
    total_transactions: transactions.length,
    period_start: start_date,
    period_end: end_date,
    balances: daily_balances,
  };
}

/**
 * Find opening balance for a period by looking at previous balances
 * @param {Object} balances - Daily balances
 * @param {string} period_start - Start date
 * @param {number} default_balance - Default if no prior balance found
 * @returns {number}
 */
export function findPeriodOpeningBalance(balances, period_start, default_balance) {
  if (!balances) return default_balance;

  let opening_balance = default_balance;
  const sorted_dates = Object.keys(balances).sort();

  for (const date of sorted_dates) {
    if (date < period_start) {
      opening_balance = balances[date].closing_balance;
    } else {
      break;
    }
  }

  return opening_balance;
}

/**
 * Find closing balance for a period by looking at balances up to period_end
 * @param {Object} balances - Daily balances
 * @param {string} period_end - End date
 * @param {number} default_balance - Default if no balance found
 * @returns {number}
 */
export function findPeriodClosingBalance(balances, period_end, default_balance) {
  if (!balances) return default_balance;

  let closing_balance = default_balance;
  const sorted_dates = Object.keys(balances).sort();

  for (const date of sorted_dates) {
    if (date <= period_end) {
      closing_balance = balances[date].closing_balance;
    } else {
      break;
    }
  }

  return closing_balance;
}

/**
 * Compare two sets of daily balances
 *
 * @param {Object} source_balances - Source daily balances (e.g., from statement)
 * @param {Object} target_balances - Target daily balances (e.g., from transactions)
 * @param {Object} options
 * @param {Object} options.all_target_balances - Full target balances for inferring missing dates
 * @param {number} options.account_opening_balance - Account opening balance for inference
 * @returns {Object} Comparison result with matched, mismatched, missing, extra arrays
 */
export function compareBalances(source_balances, target_balances, options = {}) {
  const { all_target_balances = target_balances, account_opening_balance = 0 } = options;

  const comparison = {
    matched: [],
    mismatched: [],
    missing_in_target: [],
    extra_in_target: [],
  };

  const source_dates = Object.keys(source_balances);
  const target_dates = new Set(Object.keys(target_balances));

  for (const date of source_dates) {
    const source = source_balances[date];
    const target = target_balances[date];

    if (!target) {
      // If source has no transactions for this day, infer target balance from previous day
      if (source.inflow === 0 && source.outflow === 0 && source.transaction_count === 0) {
        const sorted_target_dates = Object.keys(all_target_balances).sort();
        let last_closing = account_opening_balance;
        for (const d of sorted_target_dates) {
          if (d < date) {
            last_closing = all_target_balances[d].closing_balance;
          } else {
            break;
          }
        }

        if (source.opening_balance === last_closing && source.closing_balance === last_closing) {
          comparison.matched.push({ date });
        } else {
          comparison.mismatched.push({
            date,
            source,
            target: {
              opening_balance: last_closing,
              closing_balance: last_closing,
              inflow: 0,
              outflow: 0,
              transaction_count: 0,
            },
            diff: {
              opening_balance: source.opening_balance - last_closing,
              closing_balance: source.closing_balance - last_closing,
              inflow: 0,
              outflow: 0,
            },
          });
        }
      } else {
        comparison.missing_in_target.push({ date, source });
      }
      continue;
    }

    const matches =
      source.opening_balance === target.opening_balance &&
      source.closing_balance === target.closing_balance &&
      source.inflow === target.inflow &&
      source.outflow === target.outflow;

    if (matches) {
      comparison.matched.push({ date });
    } else {
      comparison.mismatched.push({
        date,
        source,
        target,
        diff: {
          opening_balance: source.opening_balance - target.opening_balance,
          closing_balance: source.closing_balance - target.closing_balance,
          inflow: source.inflow - target.inflow,
          outflow: source.outflow - target.outflow,
        },
      });
    }

    target_dates.delete(date);
  }

  // Dates in target but not in source
  for (const date of target_dates) {
    comparison.extra_in_target.push({ date, target: target_balances[date] });
  }

  return comparison;
}

/**
 * Generate markdown report for daily balances (proper markdown table format)
 * @param {Object} options
 * @param {Object} options.balances - Daily balances object
 * @param {string} options.title - Report title
 * @param {Object} options.metadata - Additional metadata (fileName, periodStart, periodEnd, openingBalance, balanceSource)
 * @returns {string} Formatted markdown report
 */
export function generateBalanceReport({ balances, title, metadata = {} }) {
  const lines = [];

  // Header
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  if (metadata.file_name) lines.push(`**File:** ${metadata.file_name}`);
  if (metadata.period_start && metadata.period_end) {
    lines.push(`**Period:** ${metadata.period_start} to ${metadata.period_end}`);
  }
  if (metadata.opening_balance !== undefined) {
    lines.push(`**Opening Balance:** ${formatAmount(metadata.opening_balance)}`);
    lines.push(`**Balance Source:** ${metadata.balance_source || 'computed'}`);
  }
  lines.push('');

  // Markdown table header (date and numeric columns right-aligned)
  lines.push('| Date | Opening | Inflow | Outflow | Closing | Txns |');
  lines.push('|-----:|--------:|-------:|--------:|--------:|-----:|');

  const dates = Object.keys(balances).sort();
  for (const date of dates) {
    const d = balances[date];
    lines.push(
      `| ${date} | ${formatAmount(d.opening_balance)} | ${d.inflow ? formatAmount(d.inflow) : '-'} | ${d.outflow ? formatAmount(d.outflow) : '-'} | ${formatAmount(d.closing_balance)} | ${d.transaction_count || '-'} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate markdown comparison report (proper markdown table format)
 * @param {Object} options
 * @param {string} options.statement_id - Statement ID
 * @param {string} options.file_name - Statement file name
 * @param {string} options.account_id - Account ID
 * @param {string} options.period_start - Period start date
 * @param {string} options.period_end - Period end date
 * @param {Object} options.comparison - Comparison result from compareBalances
 * @returns {string} Formatted markdown comparison report
 */
export function generateComparisonReport({ statement_id, file_name, account_id, period_start, period_end, comparison }) {
  const lines = [];

  // Header
  lines.push('# Statement Comparison Report');
  lines.push('');
  lines.push(`**Statement ID:** ${statement_id}`);
  lines.push(`**File:** ${file_name || 'N/A'}`);
  lines.push(`**Account:** ${account_id}`);
  lines.push(`**Period:** ${period_start} to ${period_end}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Summary section
  lines.push('## Comparison Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Matched | ${comparison.matched.length} days |`);
  lines.push(`| Mismatched | ${comparison.mismatched.length} days |`);
  lines.push(`| Missing in App | ${comparison.missing_in_target.length} days |`);
  lines.push(`| Extra in App | ${comparison.extra_in_target.length} days |`);
  lines.push('');

  if (comparison.matched.length > 0 && comparison.mismatched.length === 0 && comparison.missing_in_target.length === 0) {
    lines.push('> **ALL MATCHED** - Statement fully reconciled with app transactions');
    lines.push('');
  }

  if (comparison.mismatched.length > 0) {
    lines.push('## Mismatches');
    lines.push('');
    lines.push('| Date | Field | Statement | App Txns | Diff |');
    lines.push('|-----:|-------|----------:|--------:|-----:|');
    for (const m of comparison.mismatched) {
      if (m.diff.opening_balance !== 0) {
        lines.push(`| ${m.date} | opening | ${formatAmount(m.source.opening_balance)} | ${formatAmount(m.target.opening_balance)} | ${formatAmount(m.diff.opening_balance)} |`);
      }
      if (m.diff.inflow !== 0) {
        lines.push(`| ${m.date} | inflow | ${formatAmount(m.source.inflow)} | ${formatAmount(m.target.inflow)} | ${formatAmount(m.diff.inflow)} |`);
      }
      if (m.diff.outflow !== 0) {
        lines.push(`| ${m.date} | outflow | ${formatAmount(m.source.outflow)} | ${formatAmount(m.target.outflow)} | ${formatAmount(m.diff.outflow)} |`);
      }
      if (m.diff.closing_balance !== 0) {
        lines.push(`| ${m.date} | closing | ${formatAmount(m.source.closing_balance)} | ${formatAmount(m.target.closing_balance)} | ${formatAmount(m.diff.closing_balance)} |`);
      }
    }
    lines.push('');
  }

  if (comparison.missing_in_target.length > 0) {
    lines.push('## Missing in App Transactions');
    lines.push('');
    lines.push('| Date | Opening | Inflow | Outflow | Closing | Txns |');
    lines.push('|-----:|--------:|-------:|--------:|--------:|-----:|');
    for (const m of comparison.missing_in_target) {
      const d = m.source;
      lines.push(`| ${m.date} | ${formatAmount(d.opening_balance)} | ${formatAmount(d.inflow)} | ${formatAmount(d.outflow)} | ${formatAmount(d.closing_balance)} | ${d.transaction_count} |`);
    }
    lines.push('');
  }

  if (comparison.extra_in_target.length > 0) {
    lines.push('## Extra in App Transactions');
    lines.push('');
    lines.push('| Date | Opening | Inflow | Outflow | Closing | Txns |');
    lines.push('|-----:|--------:|-------:|--------:|--------:|-----:|');
    for (const e of comparison.extra_in_target) {
      const d = e.target;
      lines.push(`| ${e.date} | ${formatAmount(d.opening_balance)} | ${formatAmount(d.inflow)} | ${formatAmount(d.outflow)} | ${formatAmount(d.closing_balance)} | ${d.transaction_count} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
