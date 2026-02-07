# Package Overview

`@fob/lib-worker` is shared infrastructure for process engine workers. It abstracts orchestrator communication, API clients, and document generation.

## What It Provides

- **Worker polling loop** - Polls orchestrator for tasks, dispatches to handlers
- **Orchestrator integration** - Attaching documents and reports to work records
- **API clients** - Txn app and passthrough API wrappers
- **Template system** - EJS-based markdown document generation
- **Utilities** - Balance calculation and report generation

## Usage

```javascript
import { startWorker } from '@fob/lib-worker';
import { getHandler } from './steps/index.js';

startWorker({ getHandler, callerUrl: import.meta.url });
```

## Related Notes

- [start-worker.md](/docs/architecture/start-worker.md)
- [environment-variables.md](/docs/architecture/environment-variables.md)
- [txn-client.md](/docs/architecture/txn-client.md)
