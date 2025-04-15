"use client";

import { useState, useEffect } from 'react';

/**
 * Hook to provide the current date and time with automatic updates
 * 
 * @param updateIntervalMs - Optional interval in milliseconds (defaults to 1000ms/1sec)
 * @returns The current Date object that updates at the specified interval
 */
export function useCurrentTime(updateIntervalMs: number = 1000) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Set up interval to update time regularly
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, updateIntervalMs);

    // Clean up interval on component unmount
    return () => clearInterval(timeInterval);
  }, [updateIntervalMs]);

  return currentTime;
}