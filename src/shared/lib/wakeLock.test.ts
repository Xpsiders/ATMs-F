import { afterEach, describe, expect, it, vi } from "vitest";
import { requestScreenWakeLock } from "./wakeLock";

describe("screen wake lock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  it("returns null when Wake Lock is unavailable", async () => {
    await expect(requestScreenWakeLock({} as Navigator)).resolves.toBeNull();
  });

  it("requests a screen sentinel when supported", async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });

    await expect(requestScreenWakeLock()).resolves.toBe(sentinel);
    expect(request).toHaveBeenCalledWith("screen");
  });
});
