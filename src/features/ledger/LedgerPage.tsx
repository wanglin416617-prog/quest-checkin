import type { Snapshot } from "@/services/game";
import { reasonLabel } from "@/ui/format";
import { Icon } from "@/ui/icons";
import { paths } from "@/ui/paths";

export function LedgerPage({ snap, onBack }: { snap: Snapshot; onBack: () => void }) {
  const points = snap.ledger.filter((entry) => entry.kind === "points");
  return (
    <div data-screen="ledger" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="nav" style={{ position: "relative" }}>
        <button className="icon-btn" type="button" aria-label="返回" onClick={onBack}>
          <Icon d={paths.back} size={26} />
        </button>
        <div
          className="t3"
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}
        >
          积分流水
        </div>
      </div>
      <div className="scroll">
        <div className="card">
          <div className="cap c2">当前余额</div>
          <div className="num" style={{ font: "800 34px/40px var(--font-num)" }}>
            {snap.points}
          </div>
          <div className="cap c2">
            总连胜 {snap.streak} 天 · Lv.{snap.level} · 经验 {snap.xp}
          </div>
        </div>
        <div className="list mt12">
          {points.length === 0 ? <div className="li">还没有积分记录</div> : null}
          {points.map((entry) => (
            <div className="li" key={entry.id}>
              <div className="f1">
                <div className="callout" style={{ fontWeight: 600 }}>
                  {reasonLabel(entry.reason)}
                </div>
                <div className="cap c3">{entry.awardKey ?? ""}</div>
              </div>
              <span
                className="num"
                style={{
                  fontWeight: 800,
                  color: entry.delta >= 0 ? "var(--color-success)" : "var(--color-text)",
                }}
              >
                {entry.delta > 0 ? "+" : ""}
                {entry.delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
