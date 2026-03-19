# Environment Variables

Uses `process.env` directly. No config abstraction. Missing required vars cause immediate exit.

## Required

| Variable | Purpose |
|----------|---------|
| `WORKER_SECRET` | Bearer token for orchestrator auth |
| `WORKER_ORG` | Organization identifier |
| `FOB_STATEMENTS_API_URL` | Statements app base URL |
| `FOB_STATEMENTS_API_KEY` | Statements app API key |
| `FOB_STATEMENTS_API_SECRET` | Statements app API secret |

## Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `ORCHESTRATOR_URL` | http://localhost:3000 | Orchestrator base URL |
| `WORKER_TYPE` | customer | Worker type identifier |
| `POLL_INTERVAL_MS` | 2000 | Polling interval |
| `NODE_ENV` | - | If 'development', skips temp cleanup |

## Passthrough (if used)

| Variable | Purpose |
|----------|---------|
| `PASSTHROUGH_URL` | Passthrough base URL |
| `PASSTHROUGH_API_KEY` | API key |
| `PASSTHROUGH_API_SECRET` | API secret |
| `PASSTHROUGH_ORG_ID` | Organization ID |

## Related Notes

- [start-worker.md](/docs/architecture/start-worker.md)
- [statements-client.md](/docs/architecture/statements-client.md)
- [passthrough-client.md](/docs/architecture/passthrough-client.md)
