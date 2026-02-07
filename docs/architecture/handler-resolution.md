# Handler Resolution

The `getHandler` function maps step types to handler functions. Provided by the consuming worker repo.

```javascript
// src/steps/index.js in worker repo
export function getHandler(step_type) {
  const handlers = {
    'fetch_statement': fetchStatement,
    'verify_statement': verifyStatement,
    'reconcile': reconcile,
  };
  return handlers[step_type] || null;
}
```

## Handler Signature

```javascript
async function handler(task) {
  // task contains: id, step_type, step_order, work_record_id, item, context
  // ... do work ...
  return { result: 'data' };  // becomes task output
}
```

## Error Handling

Throw an error to fail the task. Set `error.retryable = false` for permanent failures.

```javascript
const error = new Error('Invalid data');
error.retryable = false;
throw error;
```

## Related Notes

- [task-structure.md](/docs/architecture/task-structure.md)
- [polling-loop.md](/docs/architecture/polling-loop.md)
