import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/shared/lib/apiClient";
import { useServerCode } from "./useServerCode";

vi.mock("@/shared/lib/apiClient", () => ({
  apiRequest: vi.fn(),
}));

describe("server code countdown", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("uses the mock server countdown and changes code on server rotation", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_USE_MOCKS", "false");
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        code: "381204",
        seconds_remaining: 30,
        server_time: "2026-10-20T12:00:00Z",
      })
      .mockResolvedValueOnce({
        code: "726519",
        seconds_remaining: 30,
        server_time: "2026-10-20T12:00:30Z",
      });
    const { result } = renderHook(() => useServerCode("session-1"));
    await act(async () => {});
    expect(result.current.code).toBe("381204");
    expect(result.current.seconds).toBe(30);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.code).toBe("726519");
    expect(result.current.seconds).toBe(30);
  });

  it("pauses its countdown while the document is hidden", async () => {
    vi.useFakeTimers();
    vi.mocked(apiRequest).mockResolvedValue({
      code: "381204",
      seconds_remaining: 30,
      server_time: "2026-10-20T12:00:00Z",
    });
    const previous = document.visibilityState;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { result, unmount } = renderHook(() => useServerCode("session-1"));
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(result.current.seconds).toBe(30);
    unmount();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: previous,
    });
  });
});
