# Passthrough Client

Generic wrapper for external finance APIs (Zoho Books, QuickBooks, Razorpay, etc.).

## Configuration

- `PASSTHROUGH_URL` - Base URL (default: https://fetch.cashflowy.io)
- `PASSTHROUGH_API_KEY` - API key
- `PASSTHROUGH_API_SECRET` - API secret
- `PASSTHROUGH_ORG_ID` - Organization ID

## Functions

```javascript
import { passthroughGet, passthroughPost } from '@fob/lib-worker';

await passthroughGet(connector_id, '/invoices', { status: 'sent' });
await passthroughPost(connector_id, '/payments', { amount: 1000 });
```

## Endpoint Pattern

Requests route to:
```
/org/{ORG_ID}/integrations/{connector_id}/passthrough{endpoint}
```

## Related Notes

- [txn-client.md](/docs/architecture/txn-client.md)
- [environment-variables.md](/docs/architecture/environment-variables.md)
