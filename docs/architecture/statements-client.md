# Statements Client

API client for the internal statements application (`src/apps/statements.js`).

## Configuration

Uses environment variables:
- `FOB_STATEMENTS_API_URL` - Base URL
- `FOB_STATEMENTS_API_KEY` - API key header
- `FOB_STATEMENTS_API_SECRET` - API secret header

## Domain Functions

```javascript
import { statements } from '@fob/lib-worker';

await statements.getStatement(id);
await statements.updateStatement(id, updates);
await statements.getAccount(id);
await statements.getTransactions(params);
await statements.getAllTransactions(account_id);  // auto-paginates
await statements.createWorkRecord(data);
await statements.updateChecks(data);
```

## HTTP Methods

```javascript
statements.apiGet(endpoint, params);
statements.apiPost(endpoint, body);
statements.apiPut(endpoint, body);
statements.apiPatch(endpoint, body);
```

## Related Notes

- [statements-auto-pagination.md](/docs/architecture/statements-auto-pagination.md)
- [environment-variables.md](/docs/architecture/environment-variables.md)
