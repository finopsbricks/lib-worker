# CLAUDE.md

Guidance for Claude Code when working with this package.

## Overview

`@fob/lib-worker` is a shared infrastructure package for process engine workers. It provides:

- **Worker polling loop** - Polls orchestrator for tasks, dispatches to handlers
- **Orchestrator integration** - Attaching documents and reports to work records
- **API clients** - Statements app and passthrough API wrappers
- **Template rendering** - EJS-based template rendering for supporting documents

### Related Repositories

This package is part of the **FinOpsBricks** monorepo (`/Users/alex/ec2code/finopsbricks/`):

- **`apps/orchestrator.finopsbricks.com`** — Process orchestrator. Defines processes, dispatches tasks to workers, stores work records. Workers poll this for tasks.
- **`apps/statements.finopsbricks.com`** — System of record. Stores statements, accounts, transactions. Workers call this API to read/write data.
- **`workers/*`** — Customer-specific workers that consume this package. Each implements org-specific step handlers.
- **`cli/`** — Developer CLI (`fob`) for debugging steps locally in worker repos.
- **`accounting-process-standards/`** — Documentation for step design patterns and process architecture.

## Package Structure

```
src/
├── index.js              # Main exports
├── worker.js             # startWorker function
├── validate-env.js       # Environment validation
├── orchestrator.js       # attachDocument, attachReport, clearTemp
├── apps/
│   ├── statements.js     # Statements app API client
│   └── passthrough.js    # External API passthrough client
└── utils/
    └── template-renderer.js  # EJS template rendering
```

## Usage

Worker repos consume this package:

```javascript
import 'dotenv/config';
import { startWorker } from '@fob/lib-worker';
import { getHandler } from './steps/index.js';

startWorker({ getHandler });
```

Step implementations import utilities:

```javascript
import { statements, attachDocument } from '@fob/lib-worker';

export default async function fetchData(task) {
  const { step, work_record } = task;
  const statement = await statements.getStatement(work_record.item_snapshot.id);
  await attachDocument(work_record.id, 'Data', content, step.slug);
  return { statement };
}
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
