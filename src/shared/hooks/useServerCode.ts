import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/apiClient";
import type { SessionCodeResponse } from "@/api/contracts";
import { formatApiError } from "@/api/errors";
export function useServerCode(sessionId: string, enabled = true) {
  const [code, setCode] = useState("");
  const [session, setSession] =
    useState<SessionCodeResponse["session"] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const failures = useRef(0);
  const refreshScheduled = useRef(false);
  const refreshing = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (
      !enabled ||
      refreshing.current ||
      document.visibilityState === "hidden"
    )
      return;
    refreshing.current = true;
    try {
      const response = await apiRequest<SessionCodeResponse>(
        `/sessions/${encodeURIComponent(sessionId)}/code`,
      );
      if (refreshTimer.current !== undefined) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = undefined;
      }
      setCode(response.code);
      setSession(response.session);
      setSeconds(Math.max(0, response.seconds_remaining));
      failures.current = 0;
      refreshScheduled.current = false;
      setError("");
    } catch (caught) {
      failures.current += 1;
      refreshScheduled.current = false;
      setError(formatApiError(caught));
    } finally {
      refreshing.current = false;
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
      refreshTimer.current = undefined;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || seconds !== 0 || refreshScheduled.current) return;
    refreshScheduled.current = true;
    const delay = Math.min(30_000, 1_000 * 2 ** failures.current);
    refreshTimer.current = window.setTimeout(() => void refresh(), delay);
  }, [enabled, refresh, seconds]);

  return { code, seconds, error, refresh, session };
}
