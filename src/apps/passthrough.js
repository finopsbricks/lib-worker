/**
 * Passthrough API Client (fetch.cashflowy.io)
 *
 * Generic wrapper for calling external finance APIs (Zoho Books, QuickBooks, Razorpay, etc.)
 * through the Cashflowy passthrough service.
 *
 * Uses process.env directly for credentials.
 */

const getHeaders = () => ({
  'api-key': process.env.PASSTHROUGH_API_KEY,
  'api-secret': process.env.PASSTHROUGH_API_SECRET,
  'Content-Type': 'application/json',
});

/**
 * GET request to passthrough API
 * @param {string} endpoint - API endpoint
 * @param {object} params - Query parameters
 * @returns {Promise<object>}
 */
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${process.env.PASSTHROUGH_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Passthrough API Error ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * POST request to passthrough API
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
async function apiPost(endpoint, body = {}) {
  const url = `${process.env.PASSTHROUGH_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Passthrough API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// =============================================================================
// Passthrough functions
// =============================================================================

/**
 * GET request through passthrough to external API
 * @param {string} connector_id - Connector ID for the integration
 * @param {string} endpoint - External API endpoint (e.g., '/invoices')
 * @param {object} params - Query parameters
 * @returns {Promise<object>}
 */
export async function passthroughGet(connector_id, endpoint, params = {}) {
  const passthrough_endpoint = `/org/${process.env.PASSTHROUGH_ORG_ID}/integrations/${connector_id}/passthrough${endpoint}`;
  return apiGet(passthrough_endpoint, params);
}

/**
 * POST request through passthrough to external API
 * @param {string} connector_id - Connector ID for the integration
 * @param {string} endpoint - External API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
export async function passthroughPost(connector_id, endpoint, body = {}) {
  const passthrough_endpoint = `/org/${process.env.PASSTHROUGH_ORG_ID}/integrations/${connector_id}/passthrough${endpoint}`;
  return apiPost(passthrough_endpoint, body);
}

// =============================================================================
// Export base functions for custom calls
// =============================================================================

export { apiGet, apiPost };
