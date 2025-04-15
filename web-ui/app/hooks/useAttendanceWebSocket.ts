"use client";

import { useState, useEffect, useRef } from 'react';

/**
 * Hook to manage WebSocket connection for real-time attendance updates
 * 
 * @param courseId - The ID of the course to connect to
 * @param onMessage - Callback function to handle attendance updates
 * @returns Connection status and error information
 */
export function useAttendanceWebSocket(courseId: string | null, onMessage: (count: number) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset error state
    setError(null);

    if (!courseId) {
      console.log("WS: No course ID, closing connection if any.");
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      setIsConnected(false);
      return;
    }

    let isMounted = true;
    console.log("WS: Attempting to connect for course:", courseId);

    const connectWebSocket = () => {
      if (!isMounted) return;

      // Close existing connection if any
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      // Determine WebSocket URL - try the non-host version first
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${courseId}`;
      console.log("WS: Connecting to:", wsUrl);

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          if (!isMounted) return;
          console.log('WS: WebSocket connected for course:', courseId);
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset attempt counter on success
        };

        wsRef.current.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log("WS: Received message:", data);
            if (data.type === 'attendance_update' && typeof data.presentCount === 'number') {
              onMessage(data.presentCount);
            }
          } catch (err) {
            console.error('WS: Error parsing WebSocket message:', err);
          }
        };

        wsRef.current.onerror = (event) => {
          if (!isMounted) return;
          console.error('WS: WebSocket error:', event);
          setError('Connection error. Attempting to reconnect...');
          setIsConnected(false);
          // Error will trigger a close event, which will handle reconnection
        };

        wsRef.current.onclose = (event) => {
          if (!isMounted) return;
          console.log('WS: WebSocket connection closed.', event.reason);
          setIsConnected(false);

          // Implement exponential backoff for reconnection attempts
          const maxReconnectAttempts = 10;
          const baseDelay = 1000; // 1 second

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(
              30000, // max 30 seconds
              baseDelay * Math.pow(1.5, reconnectAttemptsRef.current) +
              (Math.random() * 1000) // Add jitter
            );

            console.log(`WS: Attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts}. Reconnecting in ${Math.round(delay)}ms...`);

            reconnectAttemptsRef.current += 1;

            const timeout = setTimeout(() => {
              if (isMounted) {
                connectWebSocket();
              }
            }, delay);

            reconnectTimeoutRef.current = timeout;
          } else {
            setError(`Failed to connect after ${maxReconnectAttempts} attempts. Please refresh the page.`);
            console.error(`WS: Giving up after ${maxReconnectAttempts} attempts`);
          }
        };
      } catch (error) {
        console.error("WS: Error creating WebSocket connection:", error);
        setError('Failed to create WebSocket connection. Please refresh the page.');
      }
    };

    connectWebSocket();

    return () => {
      console.log("WS: Cleaning up WebSocket connection for", courseId);
      isMounted = false;

      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);

      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnection attempt
        wsRef.current.close();
      }

      setIsConnected(false);
    };
  }, [courseId, onMessage]);

  return { isConnected, error };
}