import { useState, useEffect, useCallback } from 'react';

const MASTER_HIGHLIGHT_KEY = 'highlight-recent-movements-master';
const MATTER_HIGHLIGHT_KEY_PREFIX = 'highlight-recent-movements-matter-';

export function useHighlightMovements() {
  // Master table highlight state
  const [masterHighlightEnabled, setMasterHighlightEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MASTER_HIGHLIGHT_KEY) === 'true';
  });

  // Toggle master highlight
  const toggleMasterHighlight = useCallback((enabled: boolean) => {
    setMasterHighlightEnabled(enabled);
    localStorage.setItem(MASTER_HIGHLIGHT_KEY, enabled ? 'true' : 'false');
  }, []);

  return {
    masterHighlightEnabled,
    toggleMasterHighlight,
  };
}

export function useMatterHighlightMovements(matterId: string) {
  const storageKey = `${MATTER_HIGHLIGHT_KEY_PREFIX}${matterId}`;
  
  const [highlightEnabled, setHighlightEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(storageKey) === 'true';
  });

  // Toggle matter-specific highlight
  const toggleHighlight = useCallback((enabled: boolean) => {
    setHighlightEnabled(enabled);
    localStorage.setItem(storageKey, enabled ? 'true' : 'false');
  }, [storageKey]);

  return {
    highlightEnabled,
    toggleHighlight,
  };
}
