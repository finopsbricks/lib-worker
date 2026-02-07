# Txn Client

API client for the internal transaction application (`src/apps/txn.js`).

## Configuration

Uses environment variables:
- `FOB_TXN_API_URL` - Base URL
- `FOB_TXN_API_KEY` - API key header
- `FOB_TXN_API_SECRET` - API secret header

## Domain Functions

```javascript
import { txn } from '@fob/lib-worker';

await txn.getStatement(id);
await txn.updateStatement(id, updates);
await txn.getAccount(id);
await txn.getTransactions(params);
await txn.getAllTransactions(account_id);  // auto-paginates
await txn.createWorkRecord(data);
await txn.updateChecks(data);
```

## HTTP Methods

```javascript
txn.apiGet(endpoint, params);
txn.apiPost(endpoint, body);
txn.apiPut(endpoint, body);
txn.apiPatch(endpoint, body);
```

## Related Notes

- [txn-auto-pagination.md](/docs/architecture/txn-auto-pagination.md)
- [environment-variables.md](/docs/architecture/environment-variables.md)
