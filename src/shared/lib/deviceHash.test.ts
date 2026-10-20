import { afterEach, describe, expect, it } from "vitest";
import { getDeviceHash } from "./deviceHash";

describe("browser device identity", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("creates a stable UUID and keeps it in local storage", () => {
    const value = getDeviceHash();
    expect(value).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getDeviceHash()).toBe(value);
    expect(localStorage.getItem("campuscheck-device")).toBe(value);
  });
});
