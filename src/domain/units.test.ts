import { describe, it, expect } from "vitest";
import {
  parseScaled,
  formatScaled,
  parseWeightToGrams,
  formatWeight,
  assertWeightG,
  parseYuanToFen,
  formatFen,
  divRound,
  divCeil,
  divFloor,
} from "./index.ts";

describe("整数工具", () => {
  it("T-INT-01 divFloor/divCeil/divRound 正负数", () => {
    expect(divFloor(7, 2)).toBe(3);
    expect(divFloor(-7, 2)).toBe(-4);
    expect(divCeil(7, 2)).toBe(4);
    expect(divCeil(-7, 2)).toBe(-3);
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
  });
  it("T-INT-02 除数为 0 / 非整数抛错", () => {
    expect(() => divFloor(1, 0)).toThrow();
    expect(() => divRound(1.5, 2)).toThrow();
  });
});

describe("单位换算 斤/kg（整数克）", () => {
  it("T-U-01 解析十进制字符串不经浮点", () => {
    expect(parseScaled("136.2", 1)).toBe(1362);
    expect(parseScaled("0.1", 2)).toBe(10);
    expect(parseScaled("12.345", 2)).toBe(1235);
    expect(parseScaled("-1.5", 1)).toBe(-15);
    expect(parseScaled(".5", 1)).toBe(5);
    expect(parseScaled("70，5", 1)).toBe(705);
  });
  it("T-U-02 非法输入抛错", () => {
    for (const s of ["", "abc", "1.2.3", "1e3", "--1"]) expect(() => parseScaled(s, 2)).toThrow();
  });
  it("T-U-03 140 斤 = 70000 g = 70 kg", () => {
    expect(parseWeightToGrams("140", "jin")).toBe(70000);
    expect(parseWeightToGrams("70", "kg")).toBe(70000);
  });
  it("T-U-04 136.2 斤 = 68100 g → 显示 136.2 斤 / 68.1 kg（US-16/US-17）", () => {
    const g = parseWeightToGrams("136.2", "jin");
    expect(g).toBe(68100);
    expect(formatWeight(g, "jin")).toBe("136.2");
    expect(formatWeight(g, "kg")).toBe("68.1");
  });
  it("T-U-05 斤↔kg 往返 0 误差（0.01 斤步长全量 0~400 斤）", () => {
    for (let c = 0; c <= 40000; c++) {
      const jin = formatScaled(c, 2);
      const g = parseWeightToGrams(jin, "jin");
      expect(g).toBe(c * 5);
      expect(parseWeightToGrams(formatWeight(g, "kg", 3), "kg")).toBe(g); // kg 文本往返
    }
  });
  it("T-U-06 显示四舍五入：68.15 kg → 68.2；68.149 → 68.1；斤 0.05 进位", () => {
    expect(formatWeight(68150, "kg")).toBe("68.2");
    expect(formatWeight(68149, "kg")).toBe("68.1");
    expect(formatWeight(25, "jin")).toBe("0.1"); // 0.05 斤 → 0.1
    expect(formatWeight(24, "jin")).toBe("0.0");
  });
  it("T-U-07 体重写库校验（Q-U1：整数克）：68100 通过；68.1 / 0 / 负数 抛错", () => {
    expect(() => assertWeightG(68100)).not.toThrow();
    expect(() => assertWeightG(68.1)).toThrow();
    expect(() => assertWeightG(0)).toThrow();
    expect(() => assertWeightG(-1)).toThrow();
  });
  it("T-U-08 显示斤默认保留 1 位：70000 g → 140.0 斤；68123 g → 136.2 斤", () => {
    expect(formatWeight(70000, "jin")).toBe("140.0");
    expect(formatWeight(68123, "jin")).toBe("136.2");
  });
});

describe("金额（整数分）", () => {
  it("T-M-01 元→分", () => {
    expect(parseYuanToFen("12.34")).toBe(1234);
    expect(parseYuanToFen("12.3")).toBe(1230);
    expect(parseYuanToFen("0.07")).toBe(7);
    expect(parseYuanToFen("20,000")).toBe(2000000);
    expect(parseYuanToFen("¥350")).toBe(35000);
  });
  it("T-M-02 超过 2 位小数拒绝", () => {
    expect(() => parseYuanToFen("1.005")).toThrow();
  });
  it("T-M-03 分→元显示", () => {
    expect(formatFen(1234)).toBe("12.34");
    expect(formatFen(5)).toBe("0.05");
    expect(formatFen(-15000)).toBe("-150.00");
    expect(formatFen(2000000, { thousands: true })).toBe("20,000.00");
    expect(formatFen(70000, { trimZeros: true })).toBe("700");
  });
  it("T-M-04 0.1+0.2 场景：10 分 + 20 分 = 30 分，显示 0.30", () => {
    expect(formatFen(parseYuanToFen("0.1") + parseYuanToFen("0.2"))).toBe("0.30");
  });
});
