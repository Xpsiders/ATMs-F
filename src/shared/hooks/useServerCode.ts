import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/apiClient";
import type { SessionCodeResponse } from "@/api/contracts";

const INITIAL_MOCK_CODE = "381204";
const MOCK_CODES = ["381204", "726519", "942630", "158407", "605218"] as const;
export function useServerCode(sessionId: string, enabled = true) {
  const [code, setCode] = useState(INITIAL_MOCK_CODE);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState("");
  const mockIndex = useRef(-1);
  const failures = useRef(0);
  const refreshScheduled = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (!enabled || document.visibilityState === "hidden") return;
    try {
      if (
        import.meta.env.DEV &&
        (import.meta.env.MODE === "mock" ||
          import.meta.env.VITE_USE_MOCKS === "true")
      ) {
        mockIndex.current = (mockIndex.current + 1) % MOCK_CODES.length;
        setCode(MOCK_CODES[mockIndex.current] ?? INITIAL_MOCK_CODE);
        setSeconds(30);
      } else {
        const response = await apiRequest<SessionCodeResponse>(
          `/sessions/${encodeURIComponent(sessionId)}/code`,
        );
        setCode(response.code);
        setSeconds(Math.max(0, response.seconds_remaining));
      }
      failures.current = 0;
      refreshScheduled.current = false;
      setError("");
    } catch {
      failures.current += 1;
      refreshScheduled.current = false;
      setError("Unable to refresh the session code. Check your connection.");
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setSeconds((remaining) => {
        return Math.max(0, remaining - 1);
      });
    }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      if (refreshTimer.current !== undefined)
        window.clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || seconds !== 0 || refreshScheduled.current) return;
    refreshScheduled.current = true;
    const delay = Math.min(30_000, 1_000 * 2 ** failures.current);
    refreshTimer.current = window.setTimeout(() => void refresh(), delay);
  }, [enabled, refresh, seconds]);

  return { code, seconds, error, refresh };
}
