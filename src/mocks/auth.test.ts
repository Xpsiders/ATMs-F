import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMockSession,
  getMockSession,
  isMockMode,
  mockRefreshResponse,
  startMockSession,
} from "./auth";
import { restoreSession } from "@/shared/lib/apiClient";

describe("mock session", () => {
  afterEach(() => {
    clearMockSession();
    vi.unstubAllEnvs();
  });

  it("uses the mock flag only in development and test modes", () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    expect(isMockMode()).toBe(true);
  });

  it("returns unauthorized before login and restores only the selected demo role", () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    clearMockSession();
    expect(mockRefreshResponse().status).toBe(401);

    startMockSession("lecturer");
    expect(mockRefreshResponse().status).toBe(204);
    expect(getMockSession()?.role).toBe("lecturer");
    expect(sessionStorage.getItem("campuscheck-mock-role")).toBe("lecturer");
  });

  it("restores only after a mock login and rejects refresh after reset", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    clearMockSession();

    await expect(restoreSession()).resolves.toBe(false);
    expect(mockRefreshResponse().status).toBe(401);

    startMockSession("institution-admin");
    await expect(restoreSession()).resolves.toBe(true);
    expect(mockRefreshResponse().status).toBe(204);

    clearMockSession();
    await expect(restoreSession()).resolves.toBe(false);
    expect(mockRefreshResponse().status).toBe(401);
  });

});
