/**
 * txn.fobrix.com API Client
 *
 * Wrapper for calling the transactions app API endpoints.
 * Uses process.env directly for credentials.
 */

const getHeaders = () => ({
  'api-key': process.env.FOB_TXN_API_KEY,
  'api-secret': process.env.FOB_TXN_API_SECRET,
  'Content-Type': 'application/json',
});

/**
 * GET request to txn API
 * @param {string} endpoint - API endpoint (e.g., '/statements/123')
 * @param {object} params - Query parameters
 * @returns {Promise<object>}
 */
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${process.env.FOB_TXN_API_URL}${endpoint}`);
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
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * POST request to txn API
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
async function apiPost(endpoint, body = {}) {
  const url = `${process.env.FOB_TXN_API_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * PATCH request to txn API
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
async function apiPatch(endpoint, body = {}) {
  const url = `${process.env.FOB_TXN_API_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * PUT request to txn API
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
async function apiPut(endpoint, body = {}) {
  const url = `${process.env.FOB_TXN_API_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// =============================================================================
// Statement endpoints
// =============================================================================

export async function getStatement(id) {
  return apiGet(`/statements/${id}`);
}

export async function updateStatement(id, updates) {
  return apiPatch(`/statements/${id}`, updates);
}

// =============================================================================
// Account endpoints
// =============================================================================

export async function getAccount(id) {
  return apiGet(`/accounts/${id}`);
}

// =============================================================================
// Transaction endpoints
// =============================================================================

export async function getTransactions(params = {}) {
  return apiGet('/transactions', params);
}

/**
 * Fetch all transactions for an account (handles pagination)
 * @param {string} account_id - Account ID
 * @returns {Promise<Array>} All transactions
 */
export async function getAllTransactions(account_id) {
  let all_transactions = [];
  let page = 1;
  let has_more = true;

  while (has_more) {
    const response = await getTransactions({ accounts: account_id, limit: 100, page });
    const transactions = response.data || [];
    all_transactions = all_transactions.concat(transactions);
    has_more = transactions.length === 100;
    page++;
  }

  return all_transactions;
}

// =============================================================================
// Work Record endpoints
// =============================================================================

export async function createWorkRecord(data) {
  return apiPost('/work-records', data);
}

// =============================================================================
// Checks endpoints
// =============================================================================

export async function updateChecks(data) {
  return apiPut('/checks', data);
}

// =============================================================================
// Export base functions for custom calls
// =============================================================================

export { apiGet, apiPost, apiPut, apiPatch };
