# Polling Loop

Infinite loop that fetches tasks from the orchestrator and dispatches to handlers.

## Flow

1. GET `/api/worker/poll` with auth headers
2. If no task, wait `POLL_INTERVAL_MS` (default 2000ms)
3. If task received, resolve handler and execute
4. Report success or failure to orchestrator
5. Repeat

## Poll Request Headers

```
Authorization: Bearer {WORKER_SECRET}
X-Worker-Type: {WORKER_TYPE}
X-Worker-Org: {WORKER_ORG}
```

## After Execution

- Success: POST `/api/worker/complete` with `{ task_id, output }`
- Failure: POST `/api/worker/failed` with `{ task_id, error, retryable }`

## Related Notes

- [task-structure.md](/docs/architecture/task-structure.md)
- [handler-resolution.md](/docs/architecture/handler-resolution.md)
- [graceful-shutdown.md](/docs/architecture/graceful-shutdown.md)
