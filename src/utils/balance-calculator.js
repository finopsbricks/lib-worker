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

