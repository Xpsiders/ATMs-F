import { describe, expect, it } from "vitest";
import { formatDate, formatInitials, formatPercent, formatTime } from "./format";

describe("format helpers", () => {
  it("formats timestamps in Africa/Lagos", () => {
    expect(formatTime("2025-02-17T09:00:00.000Z")).toBe("10:00");
    expect(formatDate("2025-02-17T09:00:00.000Z")).toContain("Feb");
  });
  it("formats percentages and initials", () => {
    expect(formatPercent(74.6)).toBe("75%");
    expect(formatInitials("Amara Okafor")).toBe("AO");
  });
});
