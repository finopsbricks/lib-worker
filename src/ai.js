/**
 * AI SDK wrapper for OpenRouter with structured generation helpers
 *
 * Provides LLM-powered structured data extraction via OpenRouter.
 * Uses Zod schemas for output validation and EJS for prompt templating.
 *
 * Requires OPENROUTER_API_KEY environment variable.
 */

import { toJSONSchema } from 'zod';
import ejs from 'ejs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { wrapLanguageModel, extractJsonMiddleware, generateText } from 'ai';

export { generateText, Output, tool } from 'ai';

export function createModel(modelId = 'anthropic/claude-sonnet-4.6') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY env var is not set');
  const base = createOpenRouter({ apiKey })(modelId, {
    extraBody: { provider: { order: ['Anthropic'], allow_fallbacks: false } },
  });
  return wrapLanguageModel({ model: base, middleware: extractJsonMiddleware() });
}

export function renderPrompt(template, schema, vars = {}) {
  const json_schema = JSON.stringify(toJSONSchema(schema), null, 2);
  return ejs.render(template, { json_schema, ...vars });
}

export function extractJsonFromText(text) {
  // 1. Raw parse
  try { return JSON.parse(text); } catch {}
  // 2. Strip markdown code fences
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }
  // 3. Find first { or [ that could start JSON
  const start = text.search(/[\[{]/);
  if (start >= 0) {
    try { return JSON.parse(text.slice(start)); } catch {}
  }
  throw new Error(`No valid JSON found in response`);
}

function parseAndValidate(text, schema, context_label) {
  let parsed;
  try {
    parsed = extractJsonFromText(text);
  } catch (err) {
    throw new Error(`${context_label} failed to produce valid JSON: ${err.message}\nRaw response (first 500 chars):\n${text.slice(0, 500)}`);
  }
  const check = schema.safeParse(parsed);
  if (!check.success) {
    const errors = check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`${context_label} schema validation failed:\n  ${errors.join('\n  ')}\nRaw response (first 500 chars):\n${text.slice(0, 500)}`);
  }
  return check.data;
}

export async function generateStructured({
  system,
  user,
  schema,
  model_id,
  context_label = 'LLM call',
} = {}) {
  if (!system) throw new Error('generateStructured: system prompt is required');
  if (!user) throw new Error('generateStructured: user prompt is required');
  if (!schema) throw new Error('generateStructured: schema is required');

  const model = createModel(model_id);
  const { text, usage } = await generateText({ model, system, prompt: user });
  const data = parseAndValidate(text, schema, context_label);
  return { data, usage };
}

export async function extractDocument(text_content, schema, {
  document_type,
  prompt_template,
  model_id,
} = {}) {
  const system = renderPrompt(prompt_template, schema);
  return generateStructured({
    system,
    user: `Extract structured data from this ${document_type}:\n\n${text_content}`,
    schema,
    model_id,
    context_label: `${document_type} extraction`,
  });
}
