"use client";

import { useEffect, RefObject } from 'react';

/**
 * Hook that handles clicks outside of specified elements
 * 
 * @param refs - Array of refs to elements that should not trigger the outside click
 * @param callback - Function to call when a click outside occurs
 * @param enabled - Whether the hook is active (default: true)
 */
export function useClickOutside<T extends HTMLElement>(
  refs: RefObject<T | null>[],
  callback: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      // Check if click was outside all of the provided refs
      const isOutside = refs.every(ref => {
        return !ref.current || !ref.current.contains(target);
      });

      if (isOutside) {
        callback();
      }
    }

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [refs, callback, enabled]);
}