# calculateDailyBalances

Computes daily opening/closing balances from transactions.

```javascript
import { calculateDailyBalances } from '@fob/lib-worker';

const result = calculateDailyBalances({
  transactions,      // Array with date, amount fields
  opening_balance,   // Starting balance
  period_start,      // 'YYYY-MM-DD'
  period_end         // 'YYYY-MM-DD'
});
```

## Return Structure

```javascript
{
  balance_source: 'calculated',  // or 'extracted'
  total_transactions: 150,
  period_start: '2024-01-01',
  period_end: '2024-01-31',
  balances: {
    '2024-01-01': { opening: 10000, closing: 12500, inflow: 5000, outflow: 2500 },
    '2024-01-02': { opening: 12500, closing: 15000, inflow: 3000, outflow: 500 },
  }
}
```

## Balance Source

- `calculated` - Computed from transactions
- `extracted` - Parsed from statement (when statement provides balances)

## Related Notes

- [compare-balances.md](/docs/architecture/compare-balances.md)
- [template-helpers.md](/docs/architecture/template-helpers.md)
