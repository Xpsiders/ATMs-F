import { describe, expect, it } from "vitest";
import { contrastRatio, meetsBodyContrast } from "./contrast";

describe("theme contrast", () => {
  it("meets WCAG AA for documented light and dark body pairs", () => {
    expect(meetsBodyContrast("#0F172A", "#FFFFFF")).toBe(true);
    expect(meetsBodyContrast("#526079", "#FFFFFF")).toBe(true);
    expect(meetsBodyContrast("#F5F7FB", "#0D1F4A")).toBe(true);
    expect(meetsBodyContrast("#B8C5E8", "#0D1F4A")).toBe(true);
    expect(meetsBodyContrast("#FFFFFF", "#1B3F9B")).toBe(true);
    expect(meetsBodyContrast("#0A1734", "#E8B923")).toBe(true);
    expect(meetsBodyContrast("#FFFFFF", "#2452C4")).toBe(true);
    expect(meetsBodyContrast("#0B5F34", "#E3F4EA")).toBe(true);
    expect(meetsBodyContrast("#A4161A", "#FDE9E8")).toBe(true);
    expect(meetsBodyContrast("#1B3F9B", "#EAF0FF")).toBe(true);
    expect(meetsBodyContrast("#475569", "#ECEFF4")).toBe(true);
    expect(meetsBodyContrast("#7EDBA6", "#163B2A")).toBe(true);
    expect(meetsBodyContrast("#FF9A94", "#48232B")).toBe(true);
    expect(meetsBodyContrast("#9DB8FF", "#1B3158")).toBe(true);
    expect(meetsBodyContrast("#C3CBDA", "#27344A")).toBe(true);
  });

  it("rejects low-contrast pairs and malformed tokens", () => {
    expect(contrastRatio("#FFFFFF", "#F5F7FB")).toBeLessThan(4.5);
    expect(() => contrastRatio("blue", "#FFFFFF")).toThrow(/six-digit hex/);
  });
});
