/**
 * Environment validation
 *
 * Validates required environment variables at startup.
 * Fails fast if anything is missing.
 */

/**
 * Validate required environment variables
 * @param {object} options
 * @param {boolean} options.requirePassthrough - Whether passthrough vars are required
 */
export function validateEnv(options = {}) {
  const required = [
    'WORKER_SECRET',
    'WORKER_ORG',
    'FOB_TXN_API_URL',
    'FOB_TXN_API_KEY',
    'FOB_TXN_API_SECRET',
  ];

  if (options.requirePassthrough) {
    required.push(
      'PASSTHROUGH_URL',
      'PASSTHROUGH_API_KEY',
      'PASSTHROUGH_API_SECRET',
      'PASSTHROUGH_ORG_ID'
    );
  }

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[Worker] Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }

  console.log('[Worker] Environment validated');
  console.log('[Worker] Orchestrator:', process.env.ORCHESTRATOR_URL || 'http://localhost:3000');
  console.log('[Worker] Org:', process.env.WORKER_ORG);
  console.log('[Worker] Type:', process.env.WORKER_TYPE || 'customer');
}
