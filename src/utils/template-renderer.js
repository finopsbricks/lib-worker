/**
 * Template Renderer - EJS-based template rendering for supporting documents
 *
 * Two-layer template system:
 * - Worker templates: `src/templates/` in each worker repo (checked first)
 * - Lib templates: `src/templates/` in lib-worker (fallback, shared partials)
 *
 * Templates use .md extension for VS Code markdown + EJS highlighting.
 *
 * Setup: Call initTemplates(import.meta.url) once at worker startup.
 * This is done automatically by startWorker() when you pass callerUrl.
 *
 * Usage in step handlers:
 *   import { renderTemplate } from '@fob/lib-worker';
 *   const content = await renderTemplate('verify_statement/check_balances', data);
 *
 * Including partials (EJS resolves from worker first, then lib):
 *   <%- include('partials/transactions-table', { transactions }) %>
 */

import ejs from 'ejs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Module state - set once at worker startup
let workerTemplatesDir = null;
let libTemplatesDir = null;

// Template cache for production performance
const templateCache = new Map();

/**
 * Shared helpers available to all templates
 *
 * Note: formatAmount was removed - workers should pass their own
 * formatting function as data if needed.
 */
const helpers = {
  formatDate: (date, style = 'short') => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const options = style === 'short'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  },

  formatPercent: (ratio) => {
    if (ratio === null || ratio === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
    }).format(ratio);
  },

  formatNumber: (num) => {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
  },
};

/**
 * Initialize template directories from a caller's import.meta.url
 *
 * Called automatically by startWorker() - no need to call directly.
 *
 * @param {string} callerUrl - import.meta.url from the worker's entry point
 */
export function initTemplates(callerUrl) {
  // Worker templates directory
  let dir = dirname(fileURLToPath(callerUrl));

  // Walk up until we find 'src' directory
  while (dir !== '/' && !dir.endsWith('/src')) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  workerTemplatesDir = join(dir, 'templates');

  // Lib templates directory (relative to this file)
  libTemplatesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
}

/**
 * Render an EJS template with the given data
 *
 * Looks for templates in worker directory first, then falls back to lib-worker.
 * EJS includes also resolve in this order, allowing workers to override partials.
 *
 * @param {string} templateName - Template path relative to src/templates (without .md extension)
 * @param {object} data - Data to pass to the template
 * @returns {Promise<string>} Rendered template content
 *
 * @example
 * import { renderTemplate } from '@fob/lib-worker';
 *
 * const doc = await renderTemplate('verify_statement/check_equation', {
 *   statement,
 *   equation_holds,
 * });
 */
export async function renderTemplate(templateName, data) {
  if (!workerTemplatesDir) {
    throw new Error('Templates not initialized. Pass callerUrl to startWorker().');
  }

  const workerPath = join(workerTemplatesDir, `${templateName}.md`);
  const libPath = join(libTemplatesDir, `${templateName}.md`);

  // Check cache first (in production)
  let template = templateCache.get(workerPath) || templateCache.get(libPath);
  let templatePath;

  if (!template) {
    // Try worker templates first, fall back to lib
    try {
      template = await readFile(workerPath, 'utf-8');
      templatePath = workerPath;
    } catch (err) {
      if (err.code === 'ENOENT') {
        template = await readFile(libPath, 'utf-8');
        templatePath = libPath;
      } else {
        throw err;
      }
    }

    // Cache in production
    if (process.env.NODE_ENV === 'production') {
      templateCache.set(templatePath, template);
    }
  } else {
    // Determine path for cached template (for EJS filename option)
    templatePath = templateCache.has(workerPath) ? workerPath : libPath;
  }

  // Merge data with helpers
  const templateData = {
    ...data,
    ...helpers,
  };

  // views array: worker first, then lib (for include resolution)
  return ejs.render(template, templateData, {
    filename: templatePath,
    views: [workerTemplatesDir, libTemplatesDir],
  });
}
