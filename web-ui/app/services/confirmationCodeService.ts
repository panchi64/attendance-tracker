/**
 * Service to fetch confirmation codes from the backend
 */

interface ConfirmationCodeResponse {
    code: string;
    expires_at: string;
    expires_in_seconds: number;
}

/**
 * Fetches the current confirmation code for the given course
 * @param courseId The UUID of the course
 * @returns Promise with the code response, or null if not found
 */
export async function fetchConfirmationCode(courseId: string | null): Promise<ConfirmationCodeResponse | null> {
    if (!courseId) return null;

    try {
        const response = await fetch(`/api/confirmation-code/${courseId}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('No confirmation code found for this course, will retry shortly');
                // Return a temporary placeholder - frontend will retry
                return {
                    code: "PENDING",
                    expires_at: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
                    expires_in_seconds: 5
                };
            }
            throw new Error(`Failed to fetch confirmation code: ${response.status}`);
        }
        return await response.json() as ConfirmationCodeResponse;
    } catch (error) {
        console.error('Error fetching confirmation code:', error);
        // Return a fallback code to avoid breaking the UI
        return {
            code: "ERROR",
            expires_at: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
            expires_in_seconds: 5
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