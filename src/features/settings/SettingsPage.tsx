import type { SettingsRow } from "@/db/dexie";
import { patchSettings, type Snapshot } from "@/services/game";

export function SettingsPage({ snap, onChanged }: { snap: Snapshot; onChanged: () => void }) {
  async function patch(next: Partial<SettingsRow>) {
    await patchSettings(next);
    onChanged();
  }
  return (
    <div
      data-screen="settings"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div style={{ padding: "4px 16px 8px" }}>
        <div className="t1">设置</div>
      </div>
      <div className="scroll">
        <div className="card">
          <div className="callout" style={{ fontWeight: 700 }}>
            数据只在这台设备
          </div>
          <div className="cap c2">刷新和升级不会清掉本地记录。</div>
        </div>
        <div className="cap c3 mt16">显示</div>
        <div className="list mt8">
          <div className="li">
            <div className="f1">
              <div className="callout" style={{ fontWeight: 600 }}>
                外观
              </div>
            </div>
            <div className="seg" style={{ width: 210 }}>
              {(["system", "light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={snap.theme === theme ? "on" : ""}
                  onClick={() => void patch({ theme })}
                >
                  {theme === "system" ? "系统" : theme === "light" ? "浅色" : "深色"}
                </button>
              ))}
            </div>
          </div>
          <div className="li">
            <div className="f1">
              <div className="callout" style={{ fontWeight: 600 }}>
                体重单位
              </div>
            </div>
            <div className="seg" style={{ width: 112 }}>
              <button
                type="button"
                className={snap.unit === "jin" ? "on" : ""}
                onClick={() => void patch({ weightUnit: "jin" })}
              >
                斤
              </button>
              <button
                type="button"
                className={snap.unit === "kg" ? "on" : ""}
                onClick={() => void patch({ weightUnit: "kg" })}
              >
                kg
              </button>
            </div>
          </div>
          <div className="li">
            <div className="f1">
              <div className="callout" style={{ fontWeight: 600 }}>
                减少动效
              </div>
            </div>
            <button
              type="button"
              className={`tog ${snap.reduceMotion ? "on" : ""}`}
              aria-pressed={snap.reduceMotion}
              onClick={() => void patch({ reduceMotion: !snap.reduceMotion })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
