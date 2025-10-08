"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchConfirmationCode, calculateProgress } from '../services/confirmationCodeService';

/**
 * Hook to manage confirmation code fetching and progress
 *
 * @param courseId - The ID of the course to fetch confirmation code for
 * @returns Object containing the current code, progress percentage, and error if any
 */
export function useConfirmationCode(courseId: string | null) {
  const [code, setCode] = useState<string>("...");
  const [progress, setProgress] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const expiresInSecondsRef = useRef<number>(0);
  const refreshIntervalRef = useRef<number>(300); // Default to 5 minutes (300 seconds)

  useEffect(() => {
    if (!courseId) {
      setCode('------');
      setProgress(0);
      setError(null);
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;
    let progressInterval: NodeJS.Timeout | null = null;

    // Function to fetch the code from backend
    const fetchCode = async () => {
      try {
        const codeData = await fetchConfirmationCode(courseId);
        if (codeData) {
          // If we get a temporary PENDING code, shorten the poll interval
          if (codeData.code === "PENDING") {
            // Retry sooner (every second) until we get a real code
            setTimeout(fetchCode, 1000);
            setCode('PENDING...');
            return;
          }

          setCode(codeData.code);
          expiresInSecondsRef.current = codeData.expires_in_seconds;
          setProgress(calculateProgress(codeData.expires_in_seconds));
          setError(null);

          // Update refresh interval from server response
          if (codeData.refresh_interval_seconds) {
            refreshIntervalRef.current = codeData.refresh_interval_seconds;
          }
        } else {
          setCode('NO CODE');
          setProgress(0);
          setError('No code available');
        }
      } catch (error) {
        console.error('Failed to fetch confirmation code:', error);
        setCode('ERROR');
        setProgress(0);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Function to update the progress bar
    const updateProgress = () => {
      if (expiresInSecondsRef.current <= 0) {
        // When expires, fetch a new code
        fetchCode();
        return;
      }

      expiresInSecondsRef.current -= 1;
      setProgress(calculateProgress(expiresInSecondsRef.current));
    };

    // Initial fetch
    fetchCode();

    // Set up polling for code refreshes
    // Poll 10 seconds before the refresh interval to ensure we get the new code in time
    const pollIntervalMs = Math.max(
      (refreshIntervalRef.current - 10) * 1000,
      30000 // Minimum 30 seconds
    );
    pollInterval = setInterval(fetchCode, pollIntervalMs);

    // Set up progress bar updates (every second)
    progressInterval = setInterval(updateProgress, 1000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [courseId]);

  return { code, progress, error };
}