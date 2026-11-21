import { useState } from "react";
import { PITY_AT, type Rarity } from "@/domain/loot";
import { addPoolItem, openBox, type Snapshot } from "@/services/game";
import { scanBanned } from "@/lib/banned";
import { RARITY_LABEL } from "@/ui/format";
import { Coin } from "@/ui/icons";
import { celebrate } from "@/ui/fx";

const ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

export function RewardsPage({ snap, onChanged }: { snap: Snapshot; onChanged: () => void }) {
  const base = import.meta.env.BASE_URL;
  const [name, setName] = useState("");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<{
    name: string;
    rarity: string;
    guaranteed: boolean;
  } | null>(null);
  const pendingCount = snap.pendingBoxes;
  const nextBox = snap.boxes.find((box) => !box.opened);
  const scan = scanBanned(name);
  const counts = Object.fromEntries(
    ORDER.map((item) => [
      item,
      snap.pool.filter((pool) => pool.active && pool.rarity === item).length,
    ]),
  ) as Record<Rarity, number>;
  const weightSum = ORDER.reduce(
    (sum, item) =>
      sum + (counts[item] > 0 ? { common: 60, rare: 25, epic: 12, legendary: 3 }[item] : 0),
    0,
  );

  async function openNext() {
    const box = nextBox;
    if (!box || pendingCount <= 0) return;
    setError("");
    const result = await openBox(box.id);
    const rarity = result.resultRarity ?? "common";
    setOpening({
      name: result.resultName ?? "盲盒",
      rarity,
      guaranteed: Boolean(result.guaranteed),
    });
    celebrate(
      result.guaranteed || rarity === "legendary"
        ? "legendary"
        : rarity === "epic"
          ? "epic"
          : rarity === "rare"
            ? "rare"
            : "normal",
      snap.reduceMotion,
    );
    onChanged();
  }

  async function addItem() {
    setError("");
    if (scan.blocks.length) return;
    try {
      await addPoolItem(name, rarity);
      setName("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "没能加入");
    }
  }

  return (
    <div data-screen="rewards" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 16px 0" }}>
        <div className="row between">
          <div className="t1">奖励</div>
          <div className="pill num">
            <Coin />
            {snap.points.toLocaleString("zh-CN")}
          </div>
        </div>
      </div>
      <div className="scroll" style={{ paddingTop: 12 }}>
        <div className="card tc" style={{ padding: "20px 16px 16px" }}>
          <img
            src={`${base}icons/chests/chest-3-epic.svg`}
            alt=""
            width={120}
            height={120}
            style={{ margin: "0 auto" }}
          />
          <div className="t2 mt8">
            {pendingCount > 0 ? `还有 ${pendingCount} 个盲盒待开` : "还没有待开的盲盒"}
          </div>
          <div className="cap c2">
            {pendingCount > 0
              ? `从你自己填的奖池里抽。再抽 ${Math.max(0, PITY_AT - snap.pity)} 次必出史诗。`
              : "过关会得到盲盒：减重每 3 斤一关，存钱到 25%、50%、75% 和 100%。"}
          </div>
          <button
            className="btn btn-primary mt16"
            type="button"
            disabled={pendingCount <= 0}
            onClick={() => void openNext()}
          >
            开启盲盒
          </button>
          {opening ? (
            <div className="card mt12" data-testid="loot-result">
              <span className={`chip ${opening.rarity}`}>
                {RARITY_LABEL[opening.rarity] ?? opening.rarity}
              </span>
              <div className="t2 mt8">{opening.name}</div>
              <div className="cap c2 mt4">{opening.guaranteed ? "保底史诗" : "刷新后结果不变"}</div>
            </div>
          ) : null}
        </div>
        <div className="sec-h">
          <div className="t3">我的奖池</div>
        </div>
        <div className="list">
          {ORDER.map((item) => {
            const weight =
              counts[item] > 0 ? { common: 60, rare: 25, epic: 12, legendary: 3 }[item] : 0;
            const pct = weightSum ? Math.round((weight / weightSum) * 100) : 0;
            return (
              <div className="li" key={item}>
                <img
                  src={`${base}icons/chests/chest-${item === "common" ? "1-common" : item === "rare" ? "2-rare" : item === "epic" ? "3-epic" : "4-legendary"}.svg`}
                  alt=""
                  width={36}
                  height={36}
                />
                <div className="f1">
                  <div className="callout" style={{ fontWeight: 600 }}>
                    {RARITY_LABEL[item]} <span className="cap c3">· {counts[item]} 个奖励</span>
                  </div>
                  <div className="bar mt4" style={{ height: 6 }}>
                    <i style={{ width: `${pct}%`, background: `var(--color-rarity-${item})` }} />
                  </div>
                </div>
                <span className="num" style={{ fontWeight: 800, width: 48, textAlign: "right" }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="cap c3 mt8">
          某档为空时概率分给其他档。连续 9 次没出史诗或传说，第 10 抽必出史诗。
        </div>
        <div className="card mt12">
          <div className="t3">加一个奖励</div>
          <label className="field mt12">
            <span className="f1">
              <span className="lab">名称</span>
              <input
                aria-label="奖池名称"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </span>
          </label>
          <div className="seg mt12">
            {ORDER.map((item) => (
              <button
                key={item}
                type="button"
                className={rarity === item ? "on" : ""}
                onClick={() => setRarity(item)}
              >
                {RARITY_LABEL[item]}
              </button>
            ))}
          </div>
          {scan.blocks.length ? (
            <div className="note amber mt12">这类词容易让人不舒服，换个说法才能保存哦</div>
          ) : null}
          {error ? <div className="note amber mt12">{error}</div> : null}
          <button
            className="btn btn-secondary mt12"
            type="button"
            disabled={!name.trim() || scan.blocks.length > 0}
            onClick={() => void addItem()}
          >
            放进奖池
          </button>
        </div>
        {snap.boxes.some((box) => box.opened) ? (
          <div className="list mt12">
            {snap.boxes
              .filter((box) => box.opened)
              .map((box) => (
                <div className="li" key={box.id}>
                  <div className="f1">
                    <div className="callout" style={{ fontWeight: 600 }}>
                      {box.resultName}
                    </div>
                    <div className="cap c2">
                      {RARITY_LABEL[box.resultRarity ?? "common"]}
                      {box.guaranteed ? " · 保底" : ""}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : null}
        <div className="cap c3 mt8">兑换商店不在这一版。盲盒从里程碑来，比如减重每 3 斤一关。</div>
      </div>
    </div>
  );
}
