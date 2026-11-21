import { greetingOf } from "@/lib/clock";
import type { GoalCard, Snapshot } from "@/services/game";
import { weightLabel, yuanLabel } from "@/ui/format";
import { Coin, Flame, Icon } from "@/ui/icons";
import { paths } from "@/ui/paths";

export function HomePage({
  snap,
  onCreate,
  onWeigh,
  onDeposit,
  onUndo,
  onLedger,
  onRewards,
}: {
  snap: Snapshot;
  onCreate: () => void;
  onWeigh: (id: string) => void;
  onDeposit: (id: string) => void;
  onUndo: (id: string) => void;
  onLedger: () => void;
  onRewards: () => void;
}) {
  const base = import.meta.env.BASE_URL;
  const ratio = snap.needed > 0 ? snap.intoLevel / snap.needed : 0;
  const ring = 2 * Math.PI * 20.75;
  if (snap.goals.length === 0) {
    return (
      <div
        className="scroll"
        data-screen="home"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Header snap={snap} ratio={ratio} ring={ring} onLedger={onLedger} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 12px",
          }}
        >
          <img
            src={`${base}app-icon/app-icon-192.png`}
            alt=""
            width={96}
            height={96}
            style={{ borderRadius: 28 }}
          />
          <div className="t2 mt16">还没有目标</div>
          <div className="body c2 mt4">
            从一个小目标开始，打卡就有积分，攒够了换你自己定的奖励。
          </div>
          <button
            className="btn btn-primary mt24"
            style={{ width: 220 }}
            type="button"
            onClick={onCreate}
          >
            <Icon d={paths.plus} size={20} />
            定第一个目标
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="scroll home-s" data-screen="home" style={{ paddingBottom: 12 }}>
      <Header snap={snap} ratio={ratio} ring={ring} onLedger={onLedger} />
      {snap.allClear ? (
        <div className="card sm mt10" data-testid="all-clear">
          <div className="t3">今日全清</div>
          <div className="cap c2">
            今天的目标都完成了 · <b className="num">+20</b>
          </div>
        </div>
      ) : null}
      <div className="sec-h" style={{ margin: "14px 2px 8px" }}>
        <div className="t3">
          今日目标{" "}
          <span className="c3 num" style={{ fontWeight: 500 }}>
            {snap.dueToday - snap.remain}/{snap.dueToday || snap.goals.length}
          </span>
        </div>
        <button className="link" type="button" onClick={onCreate}>
          <Icon d={paths.plus} size={16} />
          新目标
        </button>
      </div>
      <div className="col g10">
        {snap.goals.map((goal) =>
          goal.type === "weightLoss" ? (
            <WeightCard
              key={goal.id}
              goal={goal}
              unit={snap.unit}
              onWeigh={() => onWeigh(goal.id)}
              onUndo={() => onUndo(goal.id)}
            />
          ) : (
            <SavingsCard
              key={goal.id}
              goal={goal}
              onDeposit={() => onDeposit(goal.id)}
              onUndo={() => onUndo(goal.id)}
            />
          ),
        )}
      </div>
      <button
        className="card sm row g12 mt10"
        data-must-see="最近奖励"
        type="button"
        onClick={onRewards}
        style={{ width: "100%", textAlign: "left" }}
      >
        <img src={`${base}icons/chests/chest-2-rare.svg`} alt="" width={40} height={40} />
        <div className="f1">
          <div className="cap c3">最近奖励</div>
          <div className="callout" style={{ fontWeight: 600 }}>
            {snap.recent ? snap.recent.name : "还没有开过盲盒"}
          </div>
        </div>
        {snap.pendingBoxes > 0 ? (
          <span className="chip brand">{snap.pendingBoxes} 个盲盒待开</span>
        ) : null}
      </button>
    </div>
  );
}

function Header({
  snap,
  ratio,
  ring,
  onLedger,
}: {
  snap: Snapshot;
  ratio: number;
  ring: number;
  onLedger: () => void;
}) {
  return (
    <div className="row between g8" style={{ padding: "2px 0 0" }}>
      <div className="row g10 f1">
        <div style={{ position: "relative", width: 46, height: 46, flex: "none" }}>
          <svg width="46" height="46" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
            <circle
              cx="23"
              cy="23"
              r="20.75"
              fill="none"
              stroke="var(--color-surface-3)"
              strokeWidth="4.5"
            />
            <circle
              cx="23"
              cy="23"
              r="20.75"
              fill="none"
              stroke="#7C4DEA"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0.01, ratio) * ring} ${ring}`}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="t3 num" style={{ fontSize: 15, lineHeight: 1, fontWeight: 800 }}>
              {snap.level}
            </div>
          </div>
        </div>
        <div className="f1">
          <div className="cap c3">{snap.todayLabel}</div>
          <div className="t3 ell">
            {greetingOf()} · Lv.{snap.level}
          </div>
          <div className="cap c3">
            升级还差 <span className="num">{snap.needed - snap.intoLevel}</span>
          </div>
        </div>
      </div>
      <div className="row g6">
        <button
          className="pill num"
          type="button"
          onClick={onLedger}
          aria-label={`积分流水 ${snap.points}`}
        >
          <Coin />
          {snap.points.toLocaleString("zh-CN")}
        </button>
        <div className="pill num" aria-label="总连胜">
          <Flame dim={snap.streak === 0} />
          {snap.streak}
        </div>
      </div>
    </div>
  );
}

function WeightCard({
  goal,
  unit,
  onWeigh,
  onUndo,
}: {
  goal: GoalCard;
  unit: Snapshot["unit"];
  onWeigh: () => void;
  onUndo: () => void;
}) {
  const base = import.meta.env.BASE_URL;
  const lost = Math.max(0, (goal.startG ?? 0) - (goal.currentG ?? 0));
  const target = Math.max(0, (goal.startG ?? 0) - (goal.targetG ?? 0));
  const lead = goal.leadG ?? 0;
  return (
    <div className="card" style={{ padding: "12px 14px 10px" }}>
      <div className="row g10">
        <div className="tile sm g-teal">
          <img src={`${base}icons/goals/glyph/weight.svg`} alt="" width={18} height={18} />
        </div>
        <div className="f1">
          <div className="t3 ell" style={{ fontSize: 16 }}>
            {goal.name}
          </div>
          <div className="cap c2">连胜 {goal.streak} 天</div>
        </div>
        {goal.doneToday ? (
          <button className="btn btn-secondary xs" type="button" onClick={onUndo}>
            撤销
          </button>
        ) : (
          <button className="btn btn-primary xs" type="button" onClick={onWeigh}>
            <Icon d={paths.plus} size={15} />
            称重
          </button>
        )}
      </div>
      <div className="row g4 mt8 wrap" style={{ alignItems: "baseline" }}>
        <span className="callout c2">已减</span>
        <span className="num" style={{ font: "800 28px/32px var(--font-num)" }}>
          {weightLabel(lost, unit)}
        </span>
        <span className="callout c2">{unit === "jin" ? "斤" : "kg"}</span>
        <span className="callout c2">
          / 目标 {weightLabel(target, unit)} {unit === "jin" ? "斤" : "kg"}
        </span>
      </div>
      <div className={`chip mt4 ${lead >= 0 ? "ok" : "amber"}`}>
        {lead >= 0 ? "领先" : "落后"}计划 {weightLabel(Math.abs(lead), unit)}{" "}
        {unit === "jin" ? "斤" : "kg"}
      </div>
    </div>
  );
}

function SavingsCard({
  goal,
  onDeposit,
  onUndo,
}: {
  goal: GoalCard;
  onDeposit: () => void;
  onUndo: () => void;
}) {
  const base = import.meta.env.BASE_URL;
  const pct = Math.round((goal.ratio ?? 0) * 100);
  const jar =
    pct >= 100
      ? "jar-4-100"
      : pct >= 75
        ? "jar-3-75"
        : pct >= 50
          ? "jar-2-50"
          : pct >= 25
            ? "jar-1-25"
            : "jar-0-0";
  const lead = goal.leadFen ?? 0;
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="row g12">
        <img src={`${base}icons/jars/${jar}.svg`} alt="" width={56} height={56} />
        <div className="f1">
          <div className="row between g8">
            <div className="t3 ell" style={{ fontSize: 16 }}>
              {goal.name}
            </div>
            <span className="chip savings">{pct}%</span>
          </div>
          <div className="row g4 mt4" style={{ alignItems: "baseline" }}>
            <span className="num" style={{ font: "800 20px/24px var(--font-num)" }}>
              ¥{yuanLabel(goal.savedFen ?? 0)}
            </span>
            <span className="cap c2">/ {yuanLabel(goal.targetFen ?? 0)}</span>
          </div>
          <div className="bar savings mt8">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="row between g8 mt8">
        <div className="cap c2 f1">
          {goal.periodLabel} <b className="num">¥{yuanLabel(goal.periodFen ?? 0)}</b>
          {" · "}
          <span
            style={{
              color: lead >= 0 ? "var(--color-success)" : "var(--color-amber)",
              fontWeight: 600,
            }}
          >
            {lead >= 0 ? "领先" : "落后"} ¥{yuanLabel(Math.abs(lead))}
          </span>
        </div>
        {goal.doneToday ? (
          <button className="btn btn-secondary xs" type="button" onClick={onUndo}>
            撤销
          </button>
        ) : (
          <button className="btn btn-secondary xs" type="button" onClick={onDeposit}>
            <Icon d={paths.plus} size={15} />
            存入
          </button>
        )}
      </div>
    </div>
  );
}
