import { useEffect, useState, type ComponentType } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { parseWeightToGrams, parseYuanToFen, type WeightUnit } from "@/domain/units";
import { HomePage } from "@/features/home/HomePage";
import { LevelsPage } from "@/features/map/LevelsPage";
import { EditSheet } from "@/features/goals/EditSheet";
import { Wizard } from "@/features/goals/Wizard";
import { LedgerPage } from "@/features/ledger/LedgerPage";
import { RewardsPage } from "@/features/rewards/RewardsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { StatsPage } from "@/features/stats/StatsPage";
import {
  deposit,
  archiveGoal,
  ensureBasics,
  readSnapshot,
  undoGoalToday,
  updateGoal,
  weighIn,
  type CheckResult,
  type Snapshot,
} from "@/services/game";
import { celebrate, clearCelebration, tierOf } from "@/ui/fx";
import { onPwaRefresh } from "@/pwa/registerSW";
import { Icon } from "@/ui/icons";
import { paths } from "@/ui/paths";

type Tab = "home" | "map" | "rewards" | "stats" | "settings";
type Screen =
  | { name: "tab"; tab: Tab }
  | { name: "create" }
  | { name: "wizard"; kind: "weight" | "savings" }
  | { name: "ledger" }
  | { name: "sheet"; kind: "weigh" | "deposit"; goalId: string };

const qaBuild = import.meta.env.DEV || import.meta.env.VITE_QA_TOOLS === "1";
const TOAST_STAY_MS = 4000;
const TOAST_EXIT_MS = 160;

export function App() {
  const [seeded, setSeeded] = useState(false);
  const snap = useLiveQuery(() => (seeded ? readSnapshot() : undefined), [seeded]);
  const [screen, setScreen] = useState<Screen>({ name: "tab", tab: "home" });
  const [splash, setSplash] = useState(true);
  const [toast, setToast] = useState<{ text: string; goalId: string } | null>(null);
  const [toastOut, setToastOut] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [refresh, setRefresh] = useState<(() => Promise<void>) | null>(null);
  const [Qa, setQa] = useState<ComponentType<{ pity: number; onChanged: () => void }> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    void ensureBasics().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (!toast || toastOut) return;
    const stay = window.setTimeout(() => setToastOut(true), TOAST_STAY_MS);
    return () => window.clearTimeout(stay);
  }, [toast, toastOut]);

  useEffect(() => {
    if (!toastOut || !toast) return;
    const exit = window.setTimeout(() => {
      setToast(null);
      setToastOut(false);
    }, TOAST_EXIT_MS);
    return () => window.clearTimeout(exit);
  }, [toast, toastOut]);

  useEffect(() => {
    if (!snap) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(snap.theme, snap.reduceMotion);
    apply();
    try {
      localStorage.setItem("qc-theme", snap.theme);
    } catch {
      /* 隐私模式忽略 */
    }
    if (snap.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [snap]);

  useEffect(() => onPwaRefresh((next) => setRefresh(() => next)), []);

  useEffect(() => {
    const mark = () => setOffline(!navigator.onLine);
    window.addEventListener("online", mark);
    window.addEventListener("offline", mark);
    return () => {
      window.removeEventListener("online", mark);
      window.removeEventListener("offline", mark);
    };
  }, []);

  useEffect(() => {
    if (!qaBuild) return;
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;
    void import("@/qa/QaPanel").then((mod) => setQa(() => mod.QaPanel));
  }, []);

  const tab = screen.name === "tab" ? screen.tab : screen.name === "ledger" ? "home" : "home";

  function move(next: Screen) {
    clearCelebration();
    setToast(null);
    setToastOut(false);
    setScreen(next);
  }

  function showCheck(result: CheckResult, snapNow: Snapshot) {
    const parts = [];
    if (result.points) parts.push(`+${result.points}`);
    if (result.allClear) parts.push(`今日全清 +${result.allClear}`);
    setToastOut(false);
    setToast({ text: parts.join(" · ") || "已记录", goalId: result.goalId });
    celebrate(tierOf(result), snapNow.reduceMotion);
    setScreen({ name: "tab", tab: "home" });
  }

  return (
    <div className="app">
      {splash ? (
        <button
          className="splash"
          type="button"
          data-screen="splash"
          onClick={() => setSplash(false)}
        >
          <img
            src={`${import.meta.env.BASE_URL}app-icon/app-icon-192.png`}
            alt=""
            width={96}
            height={96}
          />
          <img
            className="mt24"
            src={`${import.meta.env.BASE_URL}brand/wordmark.svg`}
            alt="共同的努力"
            style={{ height: 40 }}
          />
          <div className="body c2 mt12">每天一点，一起坚持</div>
        </button>
      ) : null}
      {!splash && offline ? (
        <div className="notice-bar" role="status">
          现在离线，记录会留在这台设备上
        </div>
      ) : null}
      {!splash && refresh ? (
        <div className="notice-bar" role="status">
          <span>有新版本可用</span>
          <button type="button" onClick={() => void refresh()}>
            立即更新
          </button>
        </div>
      ) : null}
      {!splash && toast ? (
        <div className={`toast${toastOut ? " out" : ""}`} role="status">
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              void undoGoalToday(toast.goalId);
              setToast(null);
            }}
          >
            撤销
          </button>
        </div>
      ) : null}
      {!splash && snap ? (
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {screen.name === "tab" && screen.tab === "home" ? (
            <HomePage
              snap={snap}
              onCreate={() => move({ name: "create" })}
              onWeigh={(goalId) => move({ name: "sheet", kind: "weigh", goalId })}
              onDeposit={(goalId) => move({ name: "sheet", kind: "deposit", goalId })}
              onUndo={(goalId) => void undoGoalToday(goalId)}
              onEdit={(goalId) => {
                setError("");
                setEditingId(goalId);
              }}
              onDelete={(goalId) => setDeletingId(goalId)}
              onLedger={() => move({ name: "ledger" })}
              onRewards={() => move({ name: "tab", tab: "rewards" })}
            />
          ) : null}
          {screen.name === "tab" && screen.tab === "rewards" ? (
            <RewardsPage snap={snap} onChanged={() => undefined} />
          ) : null}
          {screen.name === "tab" && screen.tab === "stats" ? <StatsPage snap={snap} /> : null}
          {screen.name === "tab" && screen.tab === "settings" ? (
            <SettingsPage snap={snap} onChanged={() => undefined} />
          ) : null}
          {screen.name === "tab" && screen.tab === "map" ? (
            <LevelsPage snap={snap} onCreate={() => move({ name: "create" })} />
          ) : null}
          {screen.name === "create" ? (
            <TypePick
              onBack={() => move({ name: "tab", tab: "home" })}
              onPick={(kind) => move({ name: "wizard", kind })}
            />
          ) : null}
          {screen.name === "wizard" ? (
            <Wizard
              kind={screen.kind}
              unit={snap.unit}
              onBack={() => move({ name: "create" })}
              onCreated={() => move({ name: "tab", tab: "home" })}
            />
          ) : null}
          {screen.name === "ledger" ? (
            <LedgerPage snap={snap} onBack={() => move({ name: "tab", tab: "home" })} />
          ) : null}
          {editingId && snap.goals.some((goal) => goal.id === editingId) ? (
            <EditSheet
              goal={snap.goals.find((goal) => goal.id === editingId)!}
              unit={snap.unit}
              error={error}
              onClose={() => {
                setError("");
                setEditingId(null);
              }}
              onSave={(input) => {
                setError("");
                void updateGoal(editingId, input)
                  .then(() => setEditingId(null))
                  .catch((caught: unknown) =>
                    setError(caught instanceof Error ? caught.message : "没能保存"),
                  );
              }}
            />
          ) : null}
          {deletingId ? (
            <div className="scrim" onClick={() => setDeletingId(null)}>
              <div
                className="sheet"
                role="dialog"
                aria-label="删除目标"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="t2">删除这个目标？</div>
                <div className="body c2 mt8">
                  {snap.goalNames[deletingId] ?? "这个目标"}{" "}
                  会从今天的列表里拿走。已经记下的积分流水会留着。
                </div>
                <div className="row g8 mt16">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setDeletingId(null)}
                  >
                    取消
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      const id = deletingId;
                      setDeletingId(null);
                      void archiveGoal(id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {screen.name === "sheet" ? (
            <CheckSheet
              kind={screen.kind}
              unit={snap.unit}
              goal={snap.goals.find((item) => item.id === screen.goalId)}
              error={error}
              onClose={() => {
                setError("");
                move({ name: "tab", tab: "home" });
              }}
              onSubmit={async (raw) => {
                setError("");
                try {
                  const result =
                    screen.kind === "weigh"
                      ? await weighIn(screen.goalId, parseWeightToGrams(raw, snap.unit))
                      : await deposit(screen.goalId, parseYuanToFen(raw));
                  showCheck(result, snap);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "没能记下");
                }
              }}
            />
          ) : null}
        </main>
      ) : null}
      {!splash && !snap ? <div className="scroll">正在打开本地数据…</div> : null}
      {Qa && snap ? <Qa pity={snap.pity} onChanged={() => undefined} /> : null}
      {!splash && screen.name === "tab" ? (
        <TabBar
          tab={tab}
          dot={Boolean(snap?.pendingBoxes)}
          onChange={(next) => move({ name: "tab", tab: next })}
        />
      ) : null}
    </div>
  );
}

function TypePick({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (kind: "weight" | "savings") => void;
}) {
  return (
    <div data-screen="create" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="nav">
        <button className="icon-btn" type="button" aria-label="返回" onClick={onBack}>
          <Icon d={paths.back} size={26} />
        </button>
      </div>
      <div className="scroll">
        <div className="t1">定一个目标</div>
        <div className="body c2 mt4">这一版可以减重，也可以存钱。</div>
        <div className="col g10 mt16">
          <button className="opt" type="button" onClick={() => onPick("weight")}>
            <div className="tile sm g-teal" />
            <div className="f1">
              <div className="t3">减重</div>
              <div className="cap c2">记下每天的体重，按自己的节奏走</div>
            </div>
          </button>
          <button className="opt" type="button" onClick={() => onPick("savings")}>
            <div className="tile sm g-gold" />
            <div className="f1">
              <div className="t3">存钱</div>
              <div className="cap c2">固定金额，或者 52 周挑战</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckSheet({
  kind,
  unit,
  goal,
  error,
  onClose,
  onSubmit,
}: {
  kind: "weigh" | "deposit";
  unit: WeightUnit;
  goal: Snapshot["goals"][number] | undefined;
  error: string;
  onClose: () => void;
  onSubmit: (raw: string) => Promise<void>;
}) {
  const [value, setValue] = useState(kind === "weigh" ? "" : "");
  return (
    <div className="scrim" data-screen="checkin" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label={kind === "weigh" ? "记录体重" : "存入一笔"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <div className="t2">{kind === "weigh" ? "今天的体重" : "存入一笔"}</div>
        <div className="cap c2 mt4">{goal?.name}</div>
        <label className="field mt16">
          <span className="f1">
            <span className="lab">{kind === "weigh" ? "体重" : "金额"}</span>
            <input
              aria-label={kind === "weigh" ? "体重" : "金额"}
              inputMode="decimal"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
            />
          </span>
          <span className="callout c2">
            {kind === "weigh" ? (unit === "jin" ? "斤" : "kg") : "元"}
          </span>
        </label>
        <div className="cap c2 mt8">
          {kind === "weigh"
            ? "当天第一次称重 +5。撤销会收回这次积分，经验留下。"
            : goal?.periodLabel}
        </div>
        {error ? <div className="note amber mt12">{error}</div> : null}
        <button className="btn btn-primary mt16" type="button" onClick={() => void onSubmit(value)}>
          记下
        </button>
      </div>
    </div>
  );
}

function TabBar({ tab, dot, onChange }: { tab: Tab; dot: boolean; onChange: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: string | readonly string[] }[] = [
    { id: "home", label: "今日", icon: paths.home },
    { id: "map", label: "关卡", icon: paths.map },
    { id: "rewards", label: "奖励", icon: paths.gift },
    { id: "stats", label: "统计", icon: paths.chart },
    { id: "settings", label: "设置", icon: paths.gear },
  ];
  return (
    <nav className="tabbar">
      {items.map((item) => (
        <button
          key={item.id}
          className={`tab ${tab === item.id ? "on" : ""}`}
          type="button"
          onClick={() => onChange(item.id)}
        >
          <Icon d={item.icon} />
          {item.id === "rewards" && dot ? <span className="dot" /> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function applyTheme(theme: Snapshot["theme"], reduceMotion: boolean) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.reduce = reduceMotion ? "1" : "0";
  const color = dark ? "#0E1014" : "#F7F4EF";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((node) => node.setAttribute("content", color));
}
