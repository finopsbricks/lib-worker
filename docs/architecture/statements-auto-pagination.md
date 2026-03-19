# Statements Auto-Pagination

`getAllTransactions` automatically fetches all pages of transactions.

```javascript
import { statements } from '@fob/lib-worker';

const transactions = await statements.getAllTransactions(account_id);
// Returns all transactions, fetching 100 per page until exhausted
```

## Behavior

1. Fetches first page (100 records)
2. If response has more pages, continues fetching
3. Concatenates all results
4. Returns complete array

## When to Use

- `getTransactions(params)` - When you need specific filtering or single page
- `getAllTransactions(account_id)` - When you need all transactions for an account

## Related Notes

- [statements-client.md](/docs/architecture/statements-client.md)
