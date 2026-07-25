import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwbg_credits_v1";
const DEFAULT_CREDITS = 3;

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(n, 999);
  } catch {
    return null;
  }
}

export function usePersistedCredits() {
  // Server render and first client paint both use the default so hydration
  // matches; the real value loads from localStorage right after mount.
  const [credits, setCreditsState] = useState<number>(DEFAULT_CREDITS);

  useEffect(() => {
    const stored = readStored();
    if (stored !== null) {
      setCreditsState(stored);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, String(DEFAULT_CREDITS));
      } catch {
        // Private browsing — in-memory state still works for the session
      }
    }
  }, []);

  const setCredits = useCallback((updater: (prev: number) => number) => {
    setCreditsState((prev) => {
      const next = Math.max(0, updater(prev));
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore — state remains correct for this session
      }
      return next;
    });
  }, []);

  return { credits, setCredits };
}
