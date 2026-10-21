import { useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/api/errors";
import { apiRequest } from "@/shared/lib/apiClient";

export function useApiResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setLoading(path !== null);
    if (path === null) return;

    void apiRequest<T>(path)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(formatApiError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { data, loading, error, reload };
}
