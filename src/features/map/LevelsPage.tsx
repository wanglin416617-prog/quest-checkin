import { useState } from "react";
import { milestonesReached } from "@/domain/pace";
import { savingsMilestones } from "@/domain/savingsPlan";
import type { GoalCard, Snapshot } from "@/services/game";
import { weightLabel, yuanLabel } from "@/ui/format";
import { Flame } from "@/ui/icons";

const STEP_G = 1500;
const SAVE_MARKS = [25, 50, 75, 100];

export function LevelsPage({ snap, onCreate }: { snap: Snapshot; onCreate: () => void }) {
  const [goalId, setGoalId] = useState(snap.goals[0]?.id ?? "");
  const selected = snap.goals.find((goal) => goal.id === goalId) ?? snap.goals[0];
  const ratio = snap.needed > 0 ? snap.intoLevel / snap.needed : 0;

  return (
    <div data-screen="map" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 16px 0" }}>
        <div className="row between">
          <div className="t1">关卡</div>
          <div className="row g6">
            <div className="pill num">
              <Flame dim={snap.streak === 0} />
              {snap.streak}
            </div>
            <div className="pill num">Lv.{snap.level}</div>
          </div>
        </div>
        <div className="bar xp mt12">
          <i style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="cap c3 mt4">
          经验 {snap.intoLevel}/{snap.needed} · 还差 {snap.needed - snap.intoLevel}
        </div>
        {snap.goals.length > 0 ? (
          <div className="row g8 mt12 wrap">
            {snap.goals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                className={`chip ${selected?.id === goal.id ? "brand" : ""}`}
                style={{ height: 34 }}
                onClick={() => setGoalId(goal.id)}
              >
                {goal.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="scroll" style={{ paddingTop: 12 }}>
        {!selected ? (
          <div className="tc" style={{ padding: "48px 12px" }}>
            <div className="t2">地图还没解锁</div>
            <div className="body c2 mt4">定一个目标，就会生成你的关卡。</div>
            <button className="btn btn-primary mt24" type="button" style={{ width: 220, margin: "24px auto 0" }} onClick={onCreate}>
              定目标
            </button>
          </div>
        ) : selected.type === "weightLoss" ? (
          <WeightLevels goal={selected} unit={snap.unit} />
        ) : (
          <SavingsLevels goal={selected} />
        )}
      </div>
    </div>
  );
}

function WeightLevels({ goal, unit }: { goal: GoalCard; unit: Snapshot["unit"] }) {
  const start = goal.startG ?? 0;
  const current = goal.currentG ?? start;
  const target = goal.targetG ?? start;
  const { reached, total } = milestonesReached(start, current, target);
  const lost = Math.max(0, start - current);
  const into = reached >= total ? STEP_G : lost - reached * STEP_G;
  const remain = reached >= total ? 0 : STEP_G - into;
  const stage = reached >= total ? total : reached + 1;
  const unitName = unit === "jin" ? "斤" : "kg";
  return (
    <>
      <div className="card row g12" style={{ padding: "12px 14px" }}>
        <div
          className="num"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            background: "linear-gradient(180deg,var(--color-btn-primary-bg),var(--color-btn-primary-bg-2))",
            color: "var(--color-btn-primary-fg)",
          }}
        >
          {stage}
        </div>
        <div className="f1">
          <div className="row between">
            <span className="callout" style={{ fontWeight: 700 }}>
              {reached >= total ? "全部关卡完成" : `第 ${stage} 关 · 还差 ${weightLabel(remain, unit)} ${unitName}`}
            </span>
            <span className="cap c2 num">
              {weightLabel(into, unit)} / {weightLabel(STEP_G, unit)}
            </span>
          </div>
          <div className="bar weight mt8" style={{ height: 6 }}>
            <i style={{ width: `${Math.min(100, (into / STEP_G) * 100)}%` }} />
          </div>
          <div className="cap c3 mt4">
            已减 {weightLabel(lost, unit)} {unitName} · 每 3 斤一关 · 过关开盲盒
          </div>
        </div>
      </div>
      <div className="list mt12">
        {Array.from({ length: total }, (_, index) => {
          const level = index + 1;
          const state = level <= reached ? "done" : level === stage ? "current" : "locked";
          return (
            <div className="li" key={level}>
              <div className="f1">
                <div className="callout" style={{ fontWeight: 600 }}>
                  第 {level} 关
                </div>
                <div className="cap c2">{state === "done" ? "已过关" : state === "current" ? "当前" : "未解锁"}</div>
              </div>
              <span className={`chip ${state === "done" ? "ok" : state === "current" ? "brand" : ""}`}>
                {state === "done" ? "完成" : state === "current" ? "当前" : "锁定"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SavingsLevels({ goal }: { goal: GoalCard }) {
  const saved = goal.savedFen ?? 0;
  const target = goal.targetFen ?? 0;
  const reached = target > 0 ? savingsMilestones(saved, target) : [];
  const next = SAVE_MARKS.find((mark) => !reached.includes(mark));
  const remain = next && target > 0 ? Math.max(0, Math.ceil((target * next) / 100) - saved) : 0;
  return (
    <>
      <div className="card" style={{ padding: "12px 14px" }}>
        <div className="t3">{next ? `下一档 ${next}% · 还差 ¥${yuanLabel(remain)}` : "四个存钱关卡都完成了"}</div>
        <div className="cap c2 mt4">
          已存 ¥{yuanLabel(saved)} / {yuanLabel(target)}
        </div>
        <div className="bar savings mt8">
          <i style={{ width: `${Math.round((goal.ratio ?? 0) * 100)}%` }} />
        </div>
      </div>
      <div className="list mt12">
        {SAVE_MARKS.map((mark) => {
          const done = reached.includes(mark);
          return (
            <div className="li" key={mark}>
              <div className="f1">
                <div className="callout" style={{ fontWeight: 600 }}>
                  {mark}%
                </div>
                <div className="cap c2">{done ? "已达成，盲盒已发放" : "未达成"}</div>
              </div>
              <span className={`chip ${done ? "ok" : ""}`}>{done ? "完成" : "锁定"}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
