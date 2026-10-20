import { ApiError } from "@/api/errors";
import { isMockMode, mockRefreshResponse } from "@/mocks/auth";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | undefined;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(
  handler: (() => void) | undefined,
): void {
  onUnauthorized = handler;
}

export async function restoreSession(baseUrl?: string): Promise<boolean> {
  const apiBaseUrl =
    baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
  return refreshAccessToken(apiBaseUrl);
}

export function clearAuth(): void {
  accessToken = null;
  onUnauthorized?.();
}

async function refreshAccessToken(baseUrl: string): Promise<boolean> {
  if (isMockMode()) return mockRefreshResponse().ok;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) return false;
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("access_token" in body) ||
        typeof body.access_token !== "string"
      )
        return false;
      accessToken = body.access_token;
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise.then((refreshed) => refreshed === true);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const envelope =
    typeof payload === "object" && payload !== null && "error" in payload
      ? payload.error
      : null;
  const error =
    typeof envelope === "object" && envelope !== null ? envelope : {};
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "unknown";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "Something went wrong. Please try again.";
  return new ApiError(
    response.status,
    code,
    message,
    "details" in error ? error.details : undefined,
    parseRetryAfter(response.headers.get("Retry-After")),
  );
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080",
): Promise<T> {
  const execute = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    )
      headers.set("Content-Type", "application/json");
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  };

  let response = await execute();
  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await refreshAccessToken(baseUrl);
    if (refreshed) response = await execute();
    else {
      clearAuth();
      throw await toApiError(response);
    }
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === "token_reuse_detected") clearAuth();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    return undefined as T;
  if (response.headers.get("Content-Type")?.includes("text/csv"))
    return response.blob() as Promise<T>;
  return response.json() as Promise<T>;
}

export async function downloadApiFile(
  path: string,
  filename: string,
  baseUrl?: string,
): Promise<void> {
  const blob = await apiRequest<Blob>(
    path,
    { headers: { Accept: "text/csv" } },
    baseUrl,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
