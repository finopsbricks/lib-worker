# Two-Layer Templates

Template resolution checks worker repo first, then falls back to lib-worker.

## Resolution Order

1. `{worker}/src/templates/{path}.md` - Worker-specific templates
2. `{lib-worker}/src/templates/{path}.md` - Shared templates

## Setup

Requires `callerUrl` in startWorker:

```javascript
startWorker({
  getHandler,
  callerUrl: import.meta.url  // Enables worker template resolution
});
```

## Usage

```javascript
import { renderTemplate } from '@fob/lib-worker';

const content = await renderTemplate('verify_statement/summary', data);
```

## Override Pattern

Worker can override lib templates by creating same path:
- Lib: `lib-worker/src/templates/reports/balance.md`
- Worker: `worker/src/templates/reports/balance.md` (takes precedence)

## Related Notes

- [template-helpers.md](/docs/architecture/template-helpers.md)
- [start-worker.md](/docs/architecture/start-worker.md)
