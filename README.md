# @fob/lib-worker

The worker framework for FinOpsBricks customer workers. Provides the polling loop, the `defineStep()` API, orchestrator HTTP integration, and bundled conveyor/PDF steps.

## Install

```bash
npm install @fob/lib-worker@file:../../lib/lib-worker
```

## Env Vars

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ORCHESTRATOR_API_KEY` | Yes | — | Orchestrator API key (also identifies the org) |
| `ORCHESTRATOR_API_SECRET` | Yes | — | Orchestrator API secret |
| `WORKER_LOCATION` | Yes | — | Worker location identifier (sent as `X-Location`; orchestrator dispatches only stations whose `location` matches) |
| `ORCHESTRATOR_URL` | No | `http://localhost:4005` | Orchestrator server URL |
| `POLL_INTERVAL_MS` | No | `2000` | Polling frequency (ms) |
| `NODE_ENV` | No | — | When set to `development`, dev-mode behaviors apply (e.g. `clearTemp` becomes a no-op) |

Path conventions are hard-coded relative to `process.cwd()`:

- Station bins: `temp/stations/{station}/{type}/`
- Per-work-record scratch: `temp/work_records/{work_record_id}/`

## Exports

### Core Worker

| Function | Description |
|---|---|
| `startWorker({ getHandler, validateOptions? })` | Start the polling loop |
| `validateEnv(options)` | Validate required env vars at startup |
| `defineStep({ slug, name, inputSchema, outputSchema, execute })` | Define a step handler with Zod validation |
| `isStepDefinition(value)` | Type guard for `defineStep` output |
| `getStepHandler(definition)` | Extract the executable handler from a step definition |
| `createHandler(definition)` | Wrap a step definition into a handler function |

### Step Discovery

| Function | Description |
|---|---|
| `discoverSteps(dir)` | Auto-discover step modules in a directory |
| `createGetHandler(definitions)` | Build a `getHandler` from a definitions map |

### Orchestrator Integration

| Function | Description |
|---|---|
| `attachDocument(work_record_id, title, content, step_slug)` | Attach a supporting markdown document |
| `attachReport(work_record_id, content)` | Attach the final summary report |
| `attachFile(work_record_id, title, buffer, filename, step_slug)` | Attach a binary file (Excel, PDF, etc.) |
| `clearTemp(work_record_id)` | Clear temp files for a work record (no-op in dev mode) |
| `findItemByExternalId(external_id)` | Look up an item by external ID |
| `createItem(data)` | Create a new item |
| `findOrCreateItem(external_id, data)` | Upsert by external ID |
| `runProcess(process_slug, item)` | Trigger a process run |

### Template Rendering

| Function | Description |
|---|---|
| `renderTemplate(template_name, data)` | Render an EJS template bundled with lib-worker |
| `renderLocal(template_path, data)` | Render an EJS template from the worker's own templates dir |
| `initTemplates(options)` | Initialize template loader (called by `startWorker`) |

### Config + Paths

| Function | Description |
|---|---|
| `resolveConfig(step, work_record)` | Resolve a step config from process definition + runtime context |
| `bin(station, ...segments)` | Resolve a station bin path (auto-creates) |
| `workRecordDir(work_record_id)` | Per-work-record scratch directory (auto-creates) |
| `workRecordFile(work_record_id, ...segments)` | Per-work-record file path (auto-creates parents) |

### File + Step Helpers

| Function | Description |
|---|---|
| `moveFiles(sources, destination)` | Move files between bins |
| `processWorkpiece({ task, processOne })` | 5-bin doing-bin contract helper for workpiece-mode steps |
| `cleanupOrphanedDoing(station)` | Clean up stuck `doing/` entries |
| `logEvent(work_record_id, event)` | Emit a structured event |
| `pooled(items, options, fn)` | Run an async function over items with bounded concurrency |
| `stripFrontmatter(markdown)` | Strip YAML frontmatter |
| `countWords(text)` | Word count helper |

### Bundled Steps

| Slug | Export | Description |
|---|---|---|
| `lib-worker:move_files` | `moveFilesStep` | Move files between assembly-line bins (supports `moves` array) |
| `lib-worker:split_bundles` | `splitBundlesStep` | Split multi-page PDF bundles into individual page PDFs |

## Usage

```javascript
import 'dotenv/config';
import { startWorker, createGetHandler, discoverSteps } from '@fob/lib-worker';

const definitions = await discoverSteps('./src/steps');
startWorker({ getHandler: createGetHandler(definitions) });
```

```javascript
import { defineStep, attachDocument } from '@fob/lib-worker';
import { z } from 'zod';

export default defineStep({
  slug: 'EX1_fetch_data',
  name: 'Fetch data',
  inputSchema: z.object({ account_id: z.string() }),
  outputSchema: z.object({ row_count: z.number() }),
  async execute({ input, work_record, step }) {
    const data = await fetchSomething(input.account_id);
    await attachDocument(work_record.id, 'Raw data', JSON.stringify(data, null, 2), step.slug);
    return { row_count: data.length };
  },
});
```

## See Also

- FDE Handbook → `step-patterns/` for step authoring patterns (`defineStep`, schemas, document attachment, error handling)
- FDE Handbook → `worker-internals/` for `startWorker` lifecycle, handler resolution, task structure
- Platform Handbook → `architecture/worker-internals/` for framework internals
