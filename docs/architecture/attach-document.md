# attachDocument

Attaches supporting documents to work records during task execution.

```javascript
import { attachDocument } from '@fob/lib-worker';

await attachDocument(
  work_record_id,  // Target work record
  title,           // Document title (e.g., 'Balance Check')
  content,         // Markdown content
  step_order       // For file naming
);
```

## Behavior

1. Writes locally to `temp/{work_record_id}/{step_order}_{title}.md`
2. POSTs to `/api/worker/attach-document`
3. Returns boolean success status

## File Naming

Title is sanitized: spaces become underscores, special chars removed.

Example: `temp/wr_123/2_Balance_Check.md`

## Related Notes

- [attach-report.md](/docs/architecture/attach-report.md)
- [temp-file-storage.md](/docs/architecture/temp-file-storage.md)
- [task-structure.md](/docs/architecture/task-structure.md)
