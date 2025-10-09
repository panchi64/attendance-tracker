'use client';

import { useEffect } from 'react';
import { fetchCsrfToken } from '../services/csrfService';

/**
 * Component that initializes the CSRF token on app load
 * This should be included in the root layout to ensure tokens are fetched early
 */
export function CsrfTokenInitializer() {
  useEffect(() => {
    // Fetch CSRF token on app initialization
    fetchCsrfToken().catch((error) => {
      console.error('Failed to initialize CSRF token:', error);
    });
  }, []);

  // This component doesn't render anything
  return null;
}
