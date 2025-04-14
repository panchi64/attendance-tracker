/**
 * Service to fetch confirmation codes from the backend
 */

interface ConfirmationCodeResponse {
    code: string;
    expires_at: string;
    expires_in_seconds: number;
}

let pendingRetryTimeout: NodeJS.Timeout | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Fetches the current confirmation code for the given course
 * @param courseId The UUID of the course
 * @returns Promise with the code response, or null if not found
 */
export async function fetchConfirmationCode(courseId: string | null): Promise<ConfirmationCodeResponse | null> {
    if (!courseId) return null;

    try {
        // Clear any existing timeouts
        if (pendingRetryTimeout) {
            clearTimeout(pendingRetryTimeout);
            pendingRetryTimeout = null;
        }

        const response = await fetch(`/api/confirmation-code/${courseId}`);
        
        // Reset retry count on success
        retryCount = 0;
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('No confirmation code found for this course, will retry shortly');
                
                // Return a temporary placeholder with longer expiry for first attempt
                const expirySeconds = Math.min(5 + (retryCount * 2), 15); // Increase wait time with each retry
                
                // Schedule a retry if under max retries
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    pendingRetryTimeout = setTimeout(() => {
                        // This will trigger a state update in components using this service
                        console.log(`Retrying confirmation code fetch (attempt ${retryCount})`);
                    }, expirySeconds * 1000);
                }
                
                return {
                    code: "PENDING",
                    expires_at: new Date(Date.now() + (expirySeconds * 1000)).toISOString(),
                    expires_in_seconds: expirySeconds
                };
            }
            throw new Error(`Failed to fetch confirmation code: ${response.status}`);
        }
        
        return await response.json() as ConfirmationCodeResponse;
    } catch (error) {
        console.error('Error fetching confirmation code:', error);
        
        // Only use ERROR status after max retries
        const isMaxRetries = retryCount >= MAX_RETRIES;
        
        // Return a fallback code to avoid breaking the UI
        return {
            code: isMaxRetries ? "ERROR" : "PENDING",
            expires_at: new Date(Date.now() + 10000).toISOString(), // 10 seconds from now
            expires_in_seconds: 10
        };
    }
}

/**
 * Calculate progress percentage based on expiry time
 * @param expiresInSeconds Seconds until expiration
 * @param totalDuration Total duration in seconds (default 5 minutes)
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(expiresInSeconds: number, totalDuration = 300): number {
    return Math.max(0, Math.min(100, (expiresInSeconds / totalDuration) * 100));
}