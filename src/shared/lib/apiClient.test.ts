import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  clearAuth,
  setAccessToken,
  setUnauthorizedHandler,
} from "./apiClient";
import { ApiError } from "@/api/errors";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("API client", () => {
  beforeEach(() => {
    setUnauthorizedHandler(undefined);
    clearAuth();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    setUnauthorizedHandler(undefined);
    vi.unstubAllGlobals();
  });

  it("attaches the in-memory bearer token", async () => {
    setAccessToken("memory-token");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
    await apiRequest("/courses", {}, "http://api.test");
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer memory-token",
    );
    expect(init?.credentials).toBe("include");
  });

  it("shares one refresh among parallel 401 responses and retries once", async () => {
    const fetchMock = vi.mocked(fetch);
    const perRoute = new Map<string, number>();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh"))
        return jsonResponse({ access_token: "refreshed-token" });
      const attempt = (perRoute.get(url) ?? 0) + 1;
      perRoute.set(url, attempt);
      if (attempt === 1) return new Response(null, { status: 401 });
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer refreshed-token",
      );
      return jsonResponse({ ok: true });
    });
    const results = await Promise.all([
      apiRequest<{ ok: boolean }>("/one", {}, "http://api.test"),
      apiRequest<{ ok: boolean }>("/two", {}, "http://api.test"),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(1);
    expect([...perRoute.values()]).toEqual([2, 2]);
  });

  it("clears auth and calls the unauthorized handler when refresh fails", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(
      apiRequest("/private", {}, "http://api.test"),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("logs out immediately when the server reports token reuse", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { error: { code: "token_reuse_detected", message: "Session revoked" } },
        409,
      ),
    );
    await expect(
      apiRequest("/private", {}, "http://api.test"),
    ).rejects.toMatchObject({ code: "token_reuse_detected" });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("exposes Retry-After seconds on a typed 429 error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { error: { code: "rate_limited", message: "Slow down" } },
        429,
        { "Retry-After": "17" },
      ),
    );
    await expect(
      apiRequest("/checkins", { method: "POST" }, "http://api.test"),
    ).rejects.toMatchObject({ code: "rate_limited", retryAfter: 17 });
  });

  it("returns CSV responses as blobs", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("student,attendance\nAmara,present\n", {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      }),
    );
    const blob = await apiRequest<Blob>(
      "/sessions/session-id/report?format=csv",
      {},
      "http://api.test",
    );
    // Realm-safe Blob check: response.blob() can come from a different realm
    // than the global Blob (undici vs jsdom, varies by Node version), so
    // instanceof is unreliable in CI. The internal tag is realm-independent.
    expect(Object.prototype.toString.call(blob)).toBe("[object Blob]");
    expect(blob.size).toBe("student,attendance\nAmara,present\n".length);
  });

  it("returns PDF responses as blobs and requests PDF media type", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("%PDF-1.4", {
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    const blob = await apiRequest<Blob>(
      "/sessions/session-id/report?format=pdf",
      { headers: { Accept: "application/pdf" } },
      "http://api.test",
    );
    expect(Object.prototype.toString.call(blob)).toBe("[object Blob]");
    expect(blob.type).toBe("application/pdf");
  });
});
