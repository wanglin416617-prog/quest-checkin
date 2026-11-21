import { useState } from "react";
import { addDays, weekStart } from "@/domain/dates";
import { divRound } from "@/domain/int";
import { monthlyWeightChange } from "@/domain/stats";
import type { Snapshot } from "@/services/game";
import { weightLabel, reasonLabel } from "@/ui/format";

type Range = "week" | "month" | "all";

export function StatsPage({ snap }: { snap: Snapshot }) {
  const [range, setRange] = useState<Range>("month");
  const summary = range === "month" ? snap.month : rangeSummary(snap, range);
  const title = range === "week" ? "本周" : range === "all" ? "全部" : "本月 · 截至今天";
  const weight = monthlyWeightChange(
    snap.goals.flatMap((goal) => goal.weighs.map((point) => ({ date: point.date, g: point.g }))),
    snap.today,
  );
  return (
    <div data-screen="stats" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 16px 0" }}>
        <div className="row between">
          <div className="t1">统计</div>
          <div className="seg" style={{ width: 168 }}>
            {(["week", "month", "all"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={range === item ? "on" : ""}
                onClick={() => setRange(item)}
              >
                {item === "week" ? "周" : item === "month" ? "月" : "全部"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="scroll" style={{ paddingTop: 12 }}>
        <div className="row g8">
          <div className="card f1" style={{ padding: 12 }}>
            <div className="cap c2">打卡次数</div>
            <div className="num" style={{ font: "800 24px/30px var(--font-num)" }}>
              {summary.checkIns}
            </div>
            <div className="cap c3">{title}</div>
          </div>
          <div className="card f1" style={{ padding: 12 }}>
            <div className="cap c2">完成率</div>
            <div className="num" style={{ font: "800 24px/30px var(--font-num)" }}>
              {summary.completionPct ?? "—"}
            </div>
            <div className="cap c3">
              {summary.deltaPct === null
                ? title
                : `较上月 ${summary.deltaPct > 0 ? "+" : ""}${summary.deltaPct}%`}
            </div>
          </div>
          <div className="card f1" style={{ padding: 12 }}>
            <div className="cap c2">最长连胜</div>
            <div className="num" style={{ font: "800 24px/30px var(--font-num)" }}>
              {summary.longestStreak}
            </div>
            <div className="cap c3">{title}</div>
          </div>
        </div>
        <div className="card mt12" style={{ padding: 14 }}>
          <div className="row between">
            <div className="t3" style={{ fontSize: 16 }}>
              打卡热力图
            </div>
            <span className="cap c3">近 16 周</span>
          </div>
          <div
            className="mt12"
            style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 3 }}
          >
            {snap.heat[0]?.map((_, row) =>
              snap.heat.map((col, column) => {
                const cell = col[row];
                if (!cell) return null;
                const background =
                  cell.future || cell.neutral
                    ? "transparent"
                    : cell.level === 0
                      ? "var(--color-surface-3)"
                      : cell.level === 4
                        ? "var(--color-brand)"
                        : `color-mix(in srgb, var(--color-brand) ${cell.level * 25}%, var(--color-surface-3))`;
                return (
                  <i
                    key={`${column}-${row}`}
                    title={cell.date}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 4,
                      background,
                      border: cell.future ? "1px dashed var(--color-border)" : undefined,
                      outline: cell.date === snap.today ? "2px solid var(--color-text)" : undefined,
                    }}
                  />
                );
              }),
            )}
          </div>
          <div className="cap c2 mt12">
            本周 {snap.weekLine.achieved}/{snap.weekLine.dueDays} 天达成
          </div>
        </div>
        <div className="sec-h">
          <div className="t3">各目标完成率</div>
          <span className="cap c3">本月 · 截至今天</span>
        </div>
        <div className="list">
          {snap.goalRates.map((goal) => (
            <div className="li" key={goal.id}>
              <div className="f1">
                <div className="row between">
                  <span className="callout" style={{ fontWeight: 600 }}>
                    {goal.name}
                  </span>
                  <span className="num" style={{ fontWeight: 800 }}>
                    {goal.pct ?? "—"}
                    {goal.pct === null ? "" : "%"}
                  </span>
                </div>
                <div className="cap c3">
                  {goal.done}/{goal.due} {goal.type === "savings" ? "期" : "天"}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="card mt12">
          <div className="row between">
            <div className="t3" style={{ fontSize: 16 }}>
              积分收支
            </div>
            <span className="cap c3">{snap.today.slice(0, 7)}</span>
          </div>
          <div className="row g8 mt12">
            <div className="f1">
              <div className="cap c2">获得</div>
              <div className="num" style={{ color: "var(--color-success)", fontWeight: 800 }}>
                +{snap.flow.earned}
              </div>
            </div>
            <div className="f1">
              <div className="cap c2">兑换</div>
              <div className="num" style={{ fontWeight: 800 }}>
                −{snap.flow.redeemed}
              </div>
            </div>
            <div className="f1">
              <div className="cap c2">扣分</div>
              <div className="num" style={{ fontWeight: 800, color: "var(--color-amber)" }}>
                −{snap.flow.deducted}
              </div>
              <div className="cap c3">已退还 {snap.flow.refunded}</div>
            </div>
          </div>
          <div className="cap c2 mt12">获得来源</div>
          {snap.flow.sources.length === 0 ? (
            <div className="cap c3 mt8">这个月还没有获得积分</div>
          ) : (
            snap.flow.sources.map((source) => (
              <div className="row between mt8" key={source.reason}>
                <span className="callout">{reasonLabel(source.reason)}</span>
                <b className="num">
                  {source.pct}% · {source.points}
                </b>
              </div>
            ))
          )}
          {weight ? (
            <div className="cap c2 mt12">
              本月体重 {weight.deltaG > 0 ? "+" : ""}
              {weightLabel(Math.abs(weight.deltaG), snap.unit)} {snap.unit === "jin" ? "斤" : "kg"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function rangeSummary(snap: Snapshot, range: Range) {
  const from = range === "week" ? weekStart(snap.today) : addDays(weekStart(snap.today), -7 * 15);
  let done = 0;
  let due = 0;
  let checkIns = 0;
  let longest = 0;
  let run = 0;
  for (const cell of snap.heat.flat()) {
    if (cell.date < from || cell.future || cell.neutral) continue;
    if (cell.level > 0) {
      checkIns += 1;
      done += 1;
      due += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else if (cell.date !== snap.today) {
      due += 1;
      run = 0;
    }
  }
  return {
    checkIns,
    completionPct: due ? divRound(done * 100, due) : null,
    deltaPct: null,
    longestStreak: longest,
  };
}
