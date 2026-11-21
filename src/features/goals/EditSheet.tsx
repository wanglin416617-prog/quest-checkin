import { useState } from "react";
import type { GoalCard } from "@/services/game";
import { parseWeightToGrams, parseYuanToFen, type WeightUnit } from "@/domain/units";

export function EditSheet({
  goal,
  unit,
  error,
  onClose,
  onSave,
}: {
  goal: GoalCard;
  unit: WeightUnit;
  error: string;
  onClose: () => void;
  onSave: (input: {
    name: string;
    deadline: string;
    targetG?: number;
    targetFen?: number;
    baseFen?: number;
  }) => void;
}) {
  const [name, setName] = useState(goal.name);
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [target, setTarget] = useState(() => {
    if (goal.type === "weightLoss") {
      const grams = goal.targetG ?? 0;
      return unit === "jin" ? String(grams / 500) : String(grams / 1000);
    }
    if (goal.saveKind === "week52") return String((goal.baseFen ?? 0) / 100);
    return String((goal.targetFen ?? 0) / 100);
  });
  const targetLabel =
    goal.type === "weightLoss" ? "目标体重" : goal.saveKind === "week52" ? "每周基数" : "目标金额";
  const suffix = goal.type === "weightLoss" ? (unit === "jin" ? "斤" : "kg") : "元";
  return (
    <div className="scrim" data-screen="edit" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="编辑目标"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <div className="t2">编辑目标</div>
        <div className="cap c2 mt4">改完之后，计划从今天重新画。已经记下的积分还在。</div>
        <label className="field mt16">
          <span className="f1">
            <span className="lab">名称</span>
            <input
              aria-label="名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </span>
        </label>
        <label className="field mt12">
          <span className="f1">
            <span className="lab">{targetLabel}</span>
            <input
              aria-label={targetLabel}
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </span>
          <span className="callout c2">{suffix}</span>
        </label>
        <label className="field mt12">
          <span className="f1">
            <span className="lab">截止日期</span>
            <input
              aria-label="截止日期"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </span>
        </label>
        {error ? <div className="note amber mt12">{error}</div> : null}
        <button
          className="btn btn-primary mt16"
          type="button"
          onClick={() => {
            const parsed =
              goal.type === "weightLoss"
                ? { targetG: parseWeightToGrams(target, unit) }
                : goal.saveKind === "week52"
                  ? { baseFen: parseYuanToFen(target) }
                  : { targetFen: parseYuanToFen(target) };
            onSave({ name, deadline, ...parsed });
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}
