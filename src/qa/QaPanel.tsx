import { useState } from "react";
import { setPity } from "@/services/game";

/** 只在 DEV 或 VITE_QA_TOOLS=1 且地址带 ?qa=1 时加载。公开构建不会打进包。 */
export function QaPanel({ pity, onChanged }: { pity: number; onChanged: () => void }) {
  const [value, setValue] = useState(String(pity));
  return (
    <form
      data-qa="pity"
      className="card"
      style={{ position: "absolute", left: 12, right: 12, bottom: 96, zIndex: 50 }}
      onSubmit={(event) => {
        event.preventDefault();
        const next = Number(value);
        if (!Number.isInteger(next) || next < 0 || next > 9) return;
        void setPity(next).then(onChanged);
      }}
    >
      <div className="cap c2">QA · 保底计数 Wallet.pity（0–9）</div>
      <div className="row g8 mt8">
        <input
          aria-label="保底计数"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ width: 72 }}
        />
        <button className="btn btn-secondary xs" type="submit">
          写入
        </button>
        <span className="cap c3">当前 {pity}，9 表示下一抽必出史诗</span>
      </div>
    </form>
  );
}
