/**
 * CSRF Token Service
 *
 * Manages CSRF tokens for protected API requests.
 * Tokens are fetched from the server and stored in memory.
 */

let csrfToken: string | null = null;

/**
 * Fetch a new CSRF token from the server
 * This should be called on app initialization
 */
export async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token');

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }

    const data = await response.json();
    csrfToken = data.token;

    console.log('CSRF token fetched successfully');
    return csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Get the current CSRF token
 * If no token exists, fetches a new one
 */
export async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    return await fetchCsrfToken();
  }
  return csrfToken;
}

/**
 * Clear the stored CSRF token
 * Call this if a request fails with 403 CSRF error to force re-fetch
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Make a fetch request with CSRF token automatically included
 * Use this for all POST/PUT/DELETE requests to protected endpoints
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCsrfToken();

  const headers = new Headers(options.headers || {});
  headers.set('X-CSRF-Token', token);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 403 with CSRF error, clear token and retry once
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.error === 'csrf_validation_failed' || data.error === 'csrf_token_missing') {
      console.warn('CSRF token invalid or expired, fetching new token and retrying...');
      clearCsrfToken();

      // Retry with new token
      const newToken = await getCsrfToken();
      headers.set('X-CSRF-Token', newToken);

      return fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}
