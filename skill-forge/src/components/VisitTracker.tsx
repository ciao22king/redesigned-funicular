'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/track';

/**
 * Records the visit once per page load.
 *
 * It renders nothing. It is a separate component so the tracking stays in one
 * place and the layout does not become a client component: this one is, and it
 * is the only thing that needs to be.
 */
export function VisitTracker() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}
