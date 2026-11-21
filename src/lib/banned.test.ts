import { describe, expect, it } from "vitest";
import { scanBanned } from "@/lib/banned";

describe("禁用词", () => {
  it("身材外貌类阻止保存", () => {
    expect(scanBanned("今天好胖").blocks).toContain("胖");
  });

  it("允许上下文不误伤", () => {
    expect(scanBanned("肥牛饭").blocks).not.toContain("肥");
    expect(scanBanned("减肥餐").blocks).not.toContain("肥");
  });

  it("其余类别只提醒", () => {
    const scan = scanBanned("必须早睡");
    expect(scan.blocks).toHaveLength(0);
    expect(scan.warns).toContain("必须");
  });
});
