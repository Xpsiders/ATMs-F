import { describe, expect, it } from "vitest";
import { API_ERRORS, presentApiError } from "./errors";

describe("API error presentation", () => {
  it("has a friendly presentation for every known error code", () => {
    expect(Object.keys(API_ERRORS)).toEqual(expect.arrayContaining([
      "wrong_code", "code_expired", "session_closed", "outside_radius", "not_on_roster",
      "already_checked_in", "accuracy_too_poor", "too_many_attempts", "device_not_bound",
      "code_locked", "account_temporarily_locked", "token_reuse_detected", "lecturer_has_open_session",
      "venue_has_open_session", "no_active_session", "device_key_revoked", "rate_limited",
    ]));
    for (const code of Object.keys(API_ERRORS)) {
      expect(presentApiError(code).message.length).toBeGreaterThan(0);
    }
  });

  it("uses the server message for unknown codes, then a generic message", () => {
    expect(presentApiError("new_backend_code", "Please wait").message).toBe("Please wait");
    expect(presentApiError("new_backend_code", " ").message).toContain("Please try again");
  });
});
