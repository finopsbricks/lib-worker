# Environment Variables

Uses `process.env` directly. No config abstraction. Missing required vars cause immediate exit.

## Required

| Variable | Purpose |
|----------|---------|
| `ORCHESTRATOR_API_KEY` | Per-org API key for orchestrator auth |
| `ORCHESTRATOR_API_SECRET` | Per-org API secret for orchestrator auth |
| `WORKER_LOCATION` | Location code for task routing (e.g., `nowapps3`, `agilitas`) |

## Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `ORCHESTRATOR_URL` | http://localhost:3000 | Orchestrator base URL |
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
