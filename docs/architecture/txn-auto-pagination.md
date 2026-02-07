# Txn Auto-Pagination

`getAllTransactions` automatically fetches all pages of transactions.

```javascript
import { txn } from '@fob/lib-worker';

const transactions = await txn.getAllTransactions(account_id);
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

- [txn-client.md](/docs/architecture/txn-client.md)
