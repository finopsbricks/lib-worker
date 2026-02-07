# compareBalances

Compares two balance sets (e.g., statement vs. app transactions).

```javascript
import { compareBalances } from '@fob/lib-worker';

const result = compareBalances(
  source_balances,   // From statement
  target_balances,   // From app
  { tolerance: 0 }   // Optional amount tolerance
);
```

## Return Structure

```javascript
{
  matched: ['2024-01-01', '2024-01-02'],
  mismatched: [
    {
      date: '2024-01-03',
      source: { opening: 15000, closing: 18000 },
      target: { opening: 15000, closing: 17500 },
      difference: { closing: 500 }
    }
  ],
  missing_in_target: ['2024-01-04'],
  extra_in_target: ['2024-01-05']
}
```

## Features

- Intelligent inference of missing dates
- Calculates differences for mismatches
- Handles sparse balance data

## Related Notes

- [calculate-daily-balances.md](/docs/architecture/calculate-daily-balances.md)
