"use client";

import { useState, useEffect } from 'react';
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
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(0);

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
          setExpiresInSeconds(codeData.expires_in_seconds);
          setProgress(calculateProgress(codeData.expires_in_seconds));
          setError(null);
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
      if (expiresInSeconds <= 0) {
        // When expires, fetch a new code
        fetchCode();
        return;
      }

      setExpiresInSeconds(prev => prev - 1);
      setProgress(calculateProgress(expiresInSeconds - 1));
    };

    // Initial fetch
    fetchCode();

    // Set up polling for code refreshes (every 4.5 minutes to be safe)
    pollInterval = setInterval(fetchCode, 4.5 * 60 * 1000);

    // Set up progress bar updates (every second)
    progressInterval = setInterval(updateProgress, 1000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [courseId, expiresInSeconds]);

  return { code, progress, error };
}