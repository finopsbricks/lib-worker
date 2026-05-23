# CLAUDE.md

Guidance for Claude Code when working with this package.

## Overview

`@fob/lib-worker` is the core infrastructure package for process engine workers. It provides:

- **Worker polling loop** — Polls orchestrator for tasks, dispatches to step handlers
- **Step framework** — `defineStep()` with Zod schema validation, auto-discovery, config resolution
- **Orchestrator integration** — Attaching documents/files/reports to work records, item CRUD, process triggering
- **Template rendering** — Two-layer EJS templates (worker overrides lib defaults)
- **File/path utils** — Assembly-line bin paths, file movement between stations
- **Shared steps** — `move_files`, `split_bundles` (namespaced as `lib-worker:*`)

### Sibling Libraries

Domain-specific integrations live in separate packages — workers only pull in what they need:

| Library | Purpose | Deps |
|---------|---------|------|
| `@fob/lib-worker-ai` | LLM structured generation via OpenRouter | ai, @openrouter/ai-sdk-provider |
| `@fob/lib-worker-google` | Google Sheets + Drive + sync engine | @googleapis/sheets, @googleapis/drive |
| `@fob/lib-worker-erpnext` | ERPNext/Frappe REST client | none |
| `@fob/lib-worker-llmwhisperer` | PDF text extraction via LLMWhisperer | none |
| `@fob/lib-worker-statements` | statements.finopsbricks.com API client | none |
| `@fob/lib-worker-email` | Email sending via Zepto Mail | none |

### Related Repositories

This package is part of **FinOpsBricks** (`/Users/alex/ec2code/finopsbricks/`):

- **`apps/orchestrator.finopsbricks.com`** — Process orchestrator. Defines processes, dispatches tasks to workers, stores work records.
- **`apps/statements.finopsbricks.com`** — System of record for statements, accounts, transactions.
- **`workers/*`** — Customer-specific workers that consume this package.
- **`cli/`** — Developer CLI (`fob`) for debugging steps locally.
- **`accounting-process-standards/`** — Step design patterns and process architecture docs.

## Package Structure

```
src/
├── index.js                  # Main exports (26 functions)
├── worker.js                 # startWorker — polling loop
├── validate-env.js           # Fail-fast env validation
├── orchestrator.js           # attachDocument, attachFile, attachReport, clearTemp, item CRUD, runProcess
├── define-step.js            # defineStep, createHandler, getStepHandler
├── discover-steps.js         # discoverSteps, createGetHandler
├── renderLocal.js            # Co-located EJS template rendering
├── workerPaths.js            # bin(), workRecordDir(), workRecordFile()
├── files.js                  # moveFiles()
├── steps/
│   ├── move_files.js         # lib-worker:move_files shared step
│   └── split_bundles.js      # lib-worker:split_bundles shared step
└── utils/
    ├── config-resolver.js    # {{env.VAR}} and {{step_slug.field}} resolution
    ├── template-renderer.js  # Two-layer EJS rendering
    └── build-user-agent.js   # Worker user-agent string builder
```

## Usage

Worker repos consume this package:

```javascript
import 'dotenv/config';
import { startWorker, discoverSteps, createGetHandler } from '@fob/lib-worker';

const steps = await discoverSteps(new URL('./steps', import.meta.url));
startWorker({ getHandler: createGetHandler(steps), callerUrl: import.meta.url });
```

Step implementations use `defineStep()`:

```javascript
import { defineStep, attachDocument } from '@fob/lib-worker';
import { z } from 'zod';

export default defineStep({
  slug: 'fetch_data',
  name: 'Fetch Data',
  description: 'Fetches data from source',
  inputSchema: z.object({ source_id: z.string() }),
  outputSchema: z.object({ record_count: z.number() }),
  execute: async (config, context) => {
    const { work_record, step } = context;
    // ... do work ...
    await attachDocument(work_record.id, 'Summary', markdown, step.slug);
    return { record_count: 42 };
  },
});
```

## Environment Variables

This package uses `process.env` directly. No config abstraction.

Required vars are validated at startup by `validateEnv()`.

See `.env.example` for all variables and defaults.

## Releasing

After running `/release` and the version is updated, always prompt the user to run:

```
/bump-dependents
```

This updates `package.json` and `package-lock.json` in all dependent repos under `/Users/alex/ec2code/finopsbricks/` to the new version, then commits and pushes each one.

## Key Principles

1. **No config object** - Use `process.env` directly throughout
2. **Fail fast** - Missing required env vars cause immediate exit
3. **Defaults in .env.example** - Not in code

## Standards Reference

This project follows standards documented in separate repositories.

### Accounting Process Standards (Primary)

Standards specific to building AI-powered accounting processes, step design, and system integration.

**Location**: `~/ec2code/finopsbricks/accounting-process-standards`

Key topics:
- **Principles**: `deterministic-before-llm.md`, `audit-trail-first.md`, `structured-checks.md`, `step-independence.md`
- **Architecture**: `system-layers.md`, `orchestrator-integration.md`, `system-of-record-integration.md`
- **Steps**: `step-handler-pattern.md`, `step-output-contract.md`, `document-attachment.md`, `check-structure.md`
- **Processes**: `process-phases.md`, `verification-workflow.md`, `step-sequencing.md`
- **Naming**: `step-types.md`, `check-naming.md`, `variables-and-functions.md`

### General Engineering Standards

General web development standards (JavaScript, testing, git workflow).

**Location**: `~/ec2code/alex/engineering-standards`
