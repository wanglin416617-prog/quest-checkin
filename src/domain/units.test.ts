import { describe, expect, it } from "vitest";
import { fenToYuan, formatKg, yuanToFen } from "@/domain/units";

describe("money units", () => {
  it("stores amounts as integer fen", () => {
    expect(yuanToFen(12.34)).toBe(1234);
    expect(yuanToFen(0.1)).toBe(10);
    expect(fenToYuan(199)).toBe(1.99);
  });
});

describe("formatKg", () => {
  it("formats kilograms without converting units", () => {
    expect(formatKg(62.54)).toBe("62.5");
    expect(formatKg(62.54, 2)).toBe("62.54");
  });
});
