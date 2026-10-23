import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMockSession,
  requestDemoPasswordReset,
  resetDemoPassword,
  resetDemoPasswordState,
  startMockSessionWithCredentials,
} from "./auth";

describe("mock password reset", () => {
  afterEach(() => {
    clearMockSession();
    resetDemoPasswordState();
    vi.unstubAllEnvs();
  });

  it("accepts a reset code once and updates demo credentials", () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    requestDemoPasswordReset("amara.student@campus.example");

    expect(
      resetDemoPassword(
        "amara.student@campus.example",
        "123456",
        "A-new-demo-password-2026",
      ),
    ).toBe(true);
    expect(
      startMockSessionWithCredentials(
        "amara.student@campus.example",
        "A-new-demo-password-2026",
      )?.role,
    ).toBe("student");
    expect(
      resetDemoPassword(
        "amara.student@campus.example",
        "123456",
        "Another-password-2026",
      ),
    ).toBe(false);
  });
});
