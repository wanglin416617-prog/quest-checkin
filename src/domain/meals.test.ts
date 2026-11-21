import { describe, it, expect } from "vitest";
import {
  evaluateMealRecord,
  windowLabel,
  mealAwardKey,
  mealPoints,
  netAwarded,
  recheckAward,
  isValidWindow,
  DEFAULT_MEAL_WINDOW_MIN,
  type LedgerEntry,
} from "./index.ts";

const D = "2026-12-10";
const at = (hhmm: string, date = D) => ({ date, hhmm });
const base = { mealDate: D, planned: "12:00", windowMin: 30, alreadyLogged: false };

describe("餐次按时与补记（±15/±30/±60，默认 ±30）", () => {
  it("T-ML-01 默认按时范围 30；只接受 15/30/60", () => {
    expect(DEFAULT_MEAL_WINDOW_MIN).toBe(30);
    expect([15, 30, 60, 45, 0].map(isValidWindow)).toEqual([true, true, true, false, false]);
    expect(evaluateMealRecord({ ...base, windowMin: 45, now: at("12:00") })).toEqual({
      ok: false,
      reason: "invalid_window",
    });
  });
  it("T-ML-02 正常打卡（不补记）：恰好 +30 / −30 按时；+31 不按时", () => {
    expect(evaluateMealRecord({ ...base, now: at("12:30") })).toMatchObject({
      ok: true,
      onTime: true,
      isBackfill: false,
      diffMin: 30,
    });
    expect(evaluateMealRecord({ ...base, now: at("11:30") })).toMatchObject({
      ok: true,
      onTime: true,
      diffMin: -30,
    });
    expect(evaluateMealRecord({ ...base, now: at("12:31") })).toMatchObject({
      ok: true,
      onTime: false,
    });
  });
  it("T-ML-03 06b/US-20：12:40 补记实际 12:10 → 按时（范围 11:30–12:30），清淡 → 8 分", () => {
    const r = evaluateMealRecord({ ...base, now: at("12:40"), actual: at("12:10") });
    expect(r).toMatchObject({ ok: true, onTime: true, isBackfill: true, diffMin: 10 });
    expect(windowLabel("12:00", 30)).toBe("11:30–12:30");
    expect(mealPoints({ onTime: true, tags: ["清淡"], violationTags: [] })).toBe(8);
  });
  it("T-ML-04 补记边界恰好 ±N：±15/±30/±60 各自 N 按时、N+1 不按时", () => {
    for (const w of [15, 30, 60] as const) {
      const now = at("14:00");
      const mk = (m: number) => {
        const t = 12 * 60 + m;
        return at(
          `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
        );
      };
      expect(evaluateMealRecord({ ...base, windowMin: w, now, actual: mk(w) })).toMatchObject({
        ok: true,
        onTime: true,
      });
      expect(evaluateMealRecord({ ...base, windowMin: w, now, actual: mk(-w) })).toMatchObject({
        ok: true,
        onTime: true,
      });
      expect(evaluateMealRecord({ ...base, windowMin: w, now, actual: mk(w + 1) })).toMatchObject({
        ok: true,
        onTime: false,
      });
      expect(evaluateMealRecord({ ...base, windowMin: w, now, actual: mk(-w - 1) })).toMatchObject({
        ok: true,
        onTime: false,
      });
    }
  });
  it("T-ML-05 补弹超过 30 分钟才允许补记：12:30 补记被拒，12:31 允许", () => {
    expect(evaluateMealRecord({ ...base, now: at("12:30"), actual: at("12:05") })).toEqual({
      ok: false,
      reason: "backfill_too_early",
    });
    expect(evaluateMealRecord({ ...base, now: at("12:31"), actual: at("12:05") })).toMatchObject({
      ok: true,
      onTime: true,
    });
  });
  it("T-ML-06 实际时间晚于当前时间 → 拒绝（future）；等于当前时间允许", () => {
    expect(evaluateMealRecord({ ...base, now: at("12:40"), actual: at("12:41") })).toEqual({
      ok: false,
      reason: "future",
    });
    expect(evaluateMealRecord({ ...base, now: at("12:40"), actual: at("12:40") })).toMatchObject({
      ok: true,
      onTime: false,
    });
  });
  it("T-ML-07 跨午夜：计划 23:45 夜宵，次日 00:10 吃（补记于 00:50）→ 相差 25 分钟按时", () => {
    const r = evaluateMealRecord({
      mealDate: D,
      planned: "23:45",
      windowMin: 30,
      alreadyLogged: false,
      now: at("00:50", "2026-12-11"),
      actual: at("00:10", "2026-12-11"),
    });
    expect(r).toMatchObject({ ok: true, onTime: true, diffMin: 25 });
    expect(windowLabel("23:45", 30)).toBe("23:15–00:15");
  });
  it("T-ML-08 跨午夜反向：计划 00:15，前一天 23:50 吃 → −25 分钟按时；范围 15 时不按时", () => {
    const inp = {
      mealDate: D,
      planned: "00:15",
      alreadyLogged: false,
      now: at("01:00"),
      actual: at("23:50", "2026-12-09"),
    };
    expect(evaluateMealRecord({ ...inp, windowMin: 30 })).toMatchObject({
      ok: true,
      onTime: true,
      diffMin: -25,
    });
    expect(evaluateMealRecord({ ...inp, windowMin: 15 })).toMatchObject({
      ok: true,
      onTime: false,
    });
  });
  it("T-ML-09 重复补记：同一餐已有记录 → duplicate；积分按 awardKey 去重只发一次", () => {
    expect(
      evaluateMealRecord({ ...base, alreadyLogged: true, now: at("12:40"), actual: at("12:10") }),
    ).toEqual({ ok: false, reason: "duplicate" });
    const key = mealAwardKey("g1", D, "lunch");
    const ledger: LedgerEntry[] = [
      { id: "1", at: 1, kind: "points", delta: 8, reason: "meal", awardKey: key },
    ];
    expect(recheckAward(8, netAwarded(ledger, key))).toBe(0); // 编辑后再次计算仍是 8 → 不再发
    expect(recheckAward(5, netAwarded(ledger, key))).toBe(0);
  });
  it("T-ML-10 只能记今天或昨天的餐；与计划相差 > 12 小时视为填错", () => {
    expect(evaluateMealRecord({ ...base, mealDate: "2026-12-08", now: at("09:00") })).toEqual({
      ok: false,
      reason: "meal_date_out_of_range",
    });
    expect(evaluateMealRecord({ ...base, mealDate: "2026-12-11", now: at("09:00") })).toEqual({
      ok: false,
      reason: "meal_date_out_of_range",
    });
    expect(evaluateMealRecord({ ...base, now: at("23:59"), actual: at("23:59") }).ok).toBe(true); // 相差 11:59
    expect(
      evaluateMealRecord({ ...base, planned: "07:30", now: at("20:00"), actual: at("19:31") }),
    ).toEqual({ ok: false, reason: "too_far_from_plan" });
  });
  it("T-ML-11 补记时间不得早于上一餐已记录时间（design v1.2）；相等允许", () => {
    const inp = { ...base, now: at("13:00"), prevMealActual: at("11:50") };
    expect(evaluateMealRecord({ ...inp, actual: at("11:49") })).toEqual({
      ok: false,
      reason: "before_previous_meal",
    });
    expect(evaluateMealRecord({ ...inp, actual: at("11:50") })).toMatchObject({
      ok: true,
      onTime: true,
    });
  });
  it("T-ML-12 撤销后可重记：撤销 8 后重记补发 8；若重记先得 3，再次计算为 8 时只补 5（同一餐净发放 ≤ 一次额度）", () => {
    const key = mealAwardKey("g1", D, "lunch");
    const L: LedgerEntry[] = [
      { id: "1", at: 1, kind: "points", delta: 8, reason: "meal", awardKey: key },
      { id: "2", at: 2, kind: "points", delta: -8, reason: "undo", awardKey: key },
    ];
    expect(recheckAward(8, netAwarded(L, key))).toBe(8);
    L.push({ id: "3", at: 3, kind: "points", delta: 3, reason: "meal", awardKey: key });
    expect(recheckAward(8, netAwarded(L, key))).toBe(5);
  });
});
