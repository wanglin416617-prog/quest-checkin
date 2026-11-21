import { describe, expect, it } from "vitest";
import { ledgerTitle } from "./format";

const names = { "goal-1": "旅行基金" };

describe("积分流水文案", () => {
  it("不显示内部键", () => {
    expect(ledgerTitle("deposit", "deposit:goal-1:w:2026-11-16", names)).toBe("旅行基金 · 打卡");
    expect(ledgerTitle("allclear", "allclear:2026-11-21", names)).toBe("今日全清奖励");
    expect(ledgerTitle("undo", "weighIn:goal-1:2026-11-21", names)).toBe("撤销收回");
    expect(ledgerTitle("weighIn", "weighIn:goal-1:2026-11-21", names)).not.toContain("goal-1");
  });
});
