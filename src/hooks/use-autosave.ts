import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type Options<T> = {
  /** Debounce delay in ms. Defaults to 1500. */
  delay?: number;
  /** Skip autosave (e.g., not in edit mode, missing id). Defaults to true. */
  enabled?: boolean;
  /** Compare fn — return true if two states are equal (no save needed). */
  equals?: (a: T, b: T) => boolean;
};

const defaultEquals = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Debounced autosave. Skips the initial hydration value so hydrating a record
 * into local state does not immediately trigger a redundant save.
 */
export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  { delay = 1500, enabled = true, equals = defaultEquals }: Options<T> = {},
) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSaved = useRef<T>(value);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Reset baseline whenever autosave is (re-)enabled.
  useEffect(() => {
    if (enabled) {
      lastSaved.current = value;
      hydrated.current = true;
    } else {
      hydrated.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!hydrated.current) {
      hydrated.current = true;
      lastSaved.current = value;
      return;
    }
    if (equals(value, lastSaved.current)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const snapshot = value;
      setStatus("saving");
      try {
        await saveRef.current(snapshot);
        lastSaved.current = snapshot;
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch (e) {
        console.error("[autosave]", e);
        setStatus("error");
      }
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, delay]);

  return { status, lastSavedAt };
}
