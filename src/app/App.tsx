import { checkinPoints } from "@/domain/points";
import { toDateKey } from "@/domain/dateKey";

export function App() {
  const today = toDateKey();
  const samplePoints = checkinPoints("normal", 14);

  return (
    <main className="app-shell">
      <style>{`
        .app-shell { max-width: 28rem; margin: 0 auto; padding: 2.5rem 1.25rem 3rem; }
        .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: 0.08em; font-size: 0.75rem; text-transform: uppercase; }
        h1 { font-size: 2rem; margin: 0.35rem 0 0.75rem; }
        p { color: var(--muted); margin: 0 0 1rem; }
        .card { background: var(--card); border-radius: 1rem; padding: 1.1rem 1.2rem; box-shadow: 0 8px 24px rgb(28 25 23 / 0.06); }
        .card strong { color: var(--ink); }
      `}</style>
      <div className="eyebrow">QUEST CHECK-IN</div>
      <h1>小目标闯关</h1>
      <p>每天打卡小目标，攒积分换你自己定的奖励。数据只存在这台设备，无需注册。</p>
      <div className="card">
        <p>
          今天是 <strong>{today}</strong>。连续打卡 14 天、普通难度的示例积分为{" "}
          <strong>{samplePoints}</strong> 分。
        </p>
        <p>应用骨架已就绪：离线 PWA、本地数据库、日历导出与安卓通知适配层将在后续里程碑完善。</p>
      </div>
    </main>
  );
}
