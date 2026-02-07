# Task Structure

Tasks received from the orchestrator contain:

```javascript
{
  id: 'task_123',
  step_type: 'verify_statement',
  step_order: 2,
  work_record_id: 'wr_456',
  item: { id: 'stmt_789', ... },
  context: { account_id: 'acc_012', ... }
}
```

## Fields

| Field | Purpose |
|-------|---------|
| `id` | Task identifier for reporting completion |
| `step_type` | Maps to handler function |
| `step_order` | Sequence number for document naming |
| `work_record_id` | Target for document attachments |
| `item` | Primary entity being processed |
| `context` | Additional data from previous steps |

## Related Notes

- [handler-resolution.md](/docs/architecture/handler-resolution.md)
- [attach-document.md](/docs/architecture/attach-document.md)
