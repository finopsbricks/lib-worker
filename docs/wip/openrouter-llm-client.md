# Add OpenRouter LLM client to lib-worker

## Status: SUPERSEDED by [ai-sdk-adoption.md](ai-sdk-adoption.md)

Add a `runLLM()` utility that calls OpenRouter's chat completions API, providing a portable alternative to `runClaude()` that doesn't depend on the Claude CLI being installed.

> **Why superseded**: The AI SDK wraps OpenRouter with a proper provider abstraction (`@openrouter/ai-sdk-provider`) plus structured output (`generateObject`), tool calling, and middleware (`extractJsonMiddleware` for code fence stripping). The raw-fetch `runLLM()` prototype in `src/utils/openrouter.js` is superseded by `src/utils/ai.js` which uses the AI SDK. See `ai-sdk-adoption.md` for the active plan.

---

## Problem Statement

`runClaude()` shells out to the Claude Code CLI (`claude --print --dangerously-skip-permissions`). This works but has drawbacks:

1. **Requires Claude CLI installed** on every machine that runs a worker
2. **CLI overhead** — spawning a full Node.js process for each LLM call
3. **No model flexibility** — locked to whatever Claude exposes via CLI
4. **Slash command coupling** — some callers use CLI slash commands (`/extract-msa`), which can't be ported. But many callers just send a raw prompt and read stdout back

OpenRouter provides a single HTTP endpoint (`https://openrouter.ai/api/v1/chat/completions`) that routes to hundreds of models (Claude, GPT, Gemini, etc.) with a unified API. A direct HTTP call is simpler, faster, and more portable.

## Current `runClaude` Usage (worker-nowapps)

Two calling patterns exist:

| Pattern | Example | Portable? |
|---------|---------|-----------|
| Slash command | `runClaude('/extract-msa input.txt output.txt')` | No — CLI-specific |
| Raw prompt | `runClaude('Read file and write JSON response to output')` | Yes |
| Raw prompt (stdout) | `const { stdout } = await runClaude(prompt)` | Yes |

The raw prompt callers (11 of 19 call sites) can be migrated to `runLLM()`. Slash command callers would need their prompts inlined first.

## Proposed Solution

A thin wrapper around `fetch` that calls the OpenRouter chat completions endpoint. No SDK dependency — just native `fetch`.

### Target API

```javascript
import { runLLM } from '@fob/lib-worker';

// Simple — send prompt, get text back
const response = await runLLM(prompt);

// With options
const response = await runLLM(prompt, {
  model: 'anthropic/claude-sonnet-4',  // default
  timeout: 120_000,                     // default 120s
  system: 'You are a data extraction assistant.',
});

// response = { text, model, usage: { prompt_tokens, completion_tokens } }
```

### Environment

Requires `OPENROUTER_API_KEY` env var. Not validated at worker startup — only checked when `runLLM()` is called (since not all steps use LLM).

## Implementation Phases

### Phase 1: Local proof-of-concept in worker-nowapps ✅
- [x] Create `src/utils/openrouter.js` in worker-nowapps
- [x] Implement `runLLM(prompt, options)` using native `fetch`
- [x] Handle: timeout (AbortController), error responses, rate limits
- [ ] Test with a simple extraction step (e.g. classify_documents)
- [ ] Compare output quality/speed vs `runClaude` on same prompt

### Phase 2: Move to lib-worker ❌
- [ ] Create `src/utils/openrouter.js` in lib-worker
- [ ] Export `runLLM` from `src/index.js`
- [ ] Add `OPENROUTER_API_KEY` to env var documentation (not to startup validation)
- [ ] Bump lib-worker version
- [ ] Run `/bump-dependents`

### Phase 3: Migrate raw-prompt callers ❌
- [ ] Replace `runClaude(prompt)` with `runLLM(prompt)` in raw-prompt call sites
- [ ] Keep `runClaude` for slash-command callers (until those prompts are inlined)
- [ ] Test migrated steps end-to-end

## Related Files

- `workers/worker-nowapps/src/utils/claude-cli.js` — Current implementation to compare against
- `lib/lib-worker/src/index.js` — Package exports
- `lib/lib-worker/docs/wip/consolidate-claude-cli.md` — Sibling WIP for CLI consolidation

## Notes

- OpenRouter API is OpenAI-compatible (`/v1/chat/completions`), so the client could also work with any OpenAI-compatible endpoint by swapping the base URL
- No `execa` or `child_process` needed — pure HTTP
- The slash-command callers are a separate concern; those need the CLI or need their prompt logic extracted into the step itself
