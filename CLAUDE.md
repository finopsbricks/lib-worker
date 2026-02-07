# CLAUDE.md

Guidance for Claude Code when working with this package.

## Overview

`@fob/lib-worker` is a shared infrastructure package for process engine workers. It provides:

- **Worker polling loop** - Polls orchestrator for tasks, dispatches to handlers
- **Orchestrator integration** - Attaching documents and reports to work records
- **API clients** - Txn app and passthrough API wrappers
- **Utilities** - Balance calculation functions for verify_statement steps

## Package Structure

```
src/
├── index.js              # Main exports
├── worker.js             # startWorker function
├── validate-env.js       # Environment validation
├── orchestrator.js       # attachDocument, attachReport, clearTemp
├── apps/
│   ├── txn.js            # Txn app API client
│   └── passthrough.js    # External API passthrough client
└── utils/
    └── balance-calculator.js  # Financial utilities
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
import { txn, attachDocument } from '@fob/lib-worker';

export default async function fetchData(task) {
  const statement = await txn.getStatement(task.item.id);
  await attachDocument(work_record_id, 'Data', content, step_order);
  return { statement };
}
```

## Environment Variables

This package uses `process.env` directly. No config abstraction.

Required vars are validated at startup by `validateEnv()`.

See `.env.example` for all variables and defaults.

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
