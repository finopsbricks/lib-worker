# @fob/lib-worker

Shared worker infrastructure for process engine workers.

## Installation

```bash
npm install github:finopsbricks/lib-worker
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@fob/lib-worker": "github:finopsbricks/lib-worker"
  }
}
```

## Usage

### Entry Point

```javascript
import 'dotenv/config';
import { startWorker } from '@fob/lib-worker';
import { getHandler } from './steps/index.js';

startWorker({ getHandler });
```

### Step Implementation

```javascript
import { txn, attachDocument } from '@fob/lib-worker';

export default async function fetchData(task) {
  const { step, work_record } = task;

  const statement = await txn.getStatement(work_record.item_snapshot.id);

  await attachDocument(
    work_record.id,
    'Statement Data',
    JSON.stringify(statement, null, 2),
    step.slug
  );

  return { statement };
}
```

### Using Passthrough API

For workers that need external API access (Zoho Books, QuickBooks, etc.):

```javascript
import { startWorker } from '@fob/lib-worker';
import { getHandler } from './steps/index.js';

// Require passthrough env vars
startWorker({
  getHandler,
  validateOptions: { requirePassthrough: true }
});
```

```javascript
import { passthrough } from '@fob/lib-worker';

const invoices = await passthrough.passthroughGet(
  'zohobooks_connector_id',
  '/invoices',
  { status: 'unpaid' }
);
```

## Exports

### Core

- `startWorker({ getHandler, validateOptions })` - Start the worker polling loop
- `validateEnv(options)` - Validate required environment variables

### Orchestrator

- `attachDocument(work_record_id, title, content, step_slug)` - Attach supporting document
- `attachReport(work_record_id, content)` - Attach final report
- `clearTemp(work_record_id)` - Clear temp files (skipped in dev mode)

### API Clients

- `txn` - Txn app API client
  - `getStatement(id)`
  - `updateStatement(id, updates)`
  - `getAccount(id)`
  - `getTransactions(params)`
  - `getAllTransactions(account_id)`
  - `createWorkRecord(data)`
  - `updateChecks(data)`
  - `apiGet(endpoint, params)`
  - `apiPost(endpoint, body)`
  - `apiPatch(endpoint, body)`
  - `apiPut(endpoint, body)`

- `passthrough` - External API passthrough client
  - `passthroughGet(connector_id, endpoint, params)`
  - `passthroughPost(connector_id, endpoint, body)`
  - `apiGet(endpoint, params)`
  - `apiPost(endpoint, body)`

### Utilities

- `formatAmount(amount)` - Format amount for display
- `calculateDailyBalances(options)` - Calculate daily balances from transactions
- `compareBalances(source, target, options)` - Compare two balance sets
- `findPeriodOpeningBalance(balances, period_start, default)`
- `findPeriodClosingBalance(balances, period_end, default)`
- `generateBalanceReport(options)` - Generate markdown balance report
- `generateComparisonReport(options)` - Generate markdown comparison report

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

### Required

- `WORKER_SECRET` - Authentication secret for orchestrator
- `WORKER_ORG` - Organization identifier
- `FOB_TXN_API_URL` - Txn app API URL
- `FOB_TXN_API_KEY` - Txn app API key
- `FOB_TXN_API_SECRET` - Txn app API secret

### Optional

- `ORCHESTRATOR_URL` - Orchestrator URL (default: http://localhost:3000)
- `WORKER_TYPE` - Worker type (default: customer)
- `POLL_INTERVAL_MS` - Polling interval (default: 2000)

### Passthrough (if required)

- `PASSTHROUGH_URL` - Passthrough API URL
- `PASSTHROUGH_API_KEY` - Passthrough API key
- `PASSTHROUGH_API_SECRET` - Passthrough API secret
- `PASSTHROUGH_ORG_ID` - Organization ID for passthrough

## Requirements

- Node.js >= 18.0.0

## License

MIT
