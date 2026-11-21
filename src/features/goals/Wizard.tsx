import { useMemo, useState, type ReactNode } from "react";
import { addDays } from "@/domain/dates";
import { recommendedDays, targetBmiTooLow } from "@/domain/pace";
import { week52Cumulative } from "@/domain/savingsPlan";
import { requiredRates } from "@/domain/savingsPlan";
import { parseWeightToGrams, parseYuanToFen, type WeightUnit } from "@/domain/units";
import { scanBanned } from "@/lib/banned";
import { todayKey } from "@/lib/clock";
import { createSavingsGoal, createWeightGoal, type SaveCfg } from "@/services/game";
import { bmiOf, paceOf, weightLabel, yuanLabel } from "@/ui/format";
import { Icon } from "@/ui/icons";
import { paths } from "@/ui/paths";

export function Wizard({
  kind,
  unit,
  onBack,
  onCreated,
}: {
  kind: "weight" | "savings";
  unit: WeightUnit;
  onBack: () => void;
  onCreated: () => void;
}) {
  return kind === "weight" ? (
    <WeightWizard unit={unit} onBack={onBack} onCreated={onCreated} />
  ) : (
    <SavingsWizard onBack={onBack} onCreated={onCreated} />
  );
}

function Shell({
  title,
  step,
  total,
  onBack,
  children,
  footer,
}: {
  title: string;
  step: number;
  total: number;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div data-screen="create" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="nav" style={{ position: "relative" }}>
        <button className="icon-btn" type="button" onClick={onBack} aria-label="返回">
          <Icon d={paths.back} size={26} />
        </button>
        <div
          className="cap c2"
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}
        >
          {title} ·{" "}
          <span className="num">
            {step}/{total}
          </span>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        <div className="steps">
          {Array.from({ length: total }, (_, index) => (
            <i key={index} className={index < step ? "on" : ""} />
          ))}
        </div>
      </div>
      <div className="scroll" style={{ paddingTop: 16 }}>
        {children}
      </div>
      <div style={{ padding: "10px 16px 24px" }}>{footer}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  inputMode = "decimal",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <label className="field">
      <span className="f1">
        <span className="lab">{label}</span>
        <input
          aria-label={label}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {suffix ? <span className="callout c2">{suffix}</span> : null}
    </label>
  );
}

function WeightWizard({
  unit,
  onBack,
  onCreated,
}: {
  unit: WeightUnit;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [height, setHeight] = useState("165");
  const [weight, setWeight] = useState("140");
  const [localUnit, setLocalUnit] = useState<WeightUnit>(unit);
  const [days, setDays] = useState("90");
  const [lose, setLose] = useState("30");
  const [name, setName] = useState("90 天减重");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const grams = useMemo(() => {
    try {
      return parseWeightToGrams(weight, localUnit);
    } catch {
      return null;
    }
  }, [weight, localUnit]);
  const heightCm = Number(height);
  const dayCount = Number(days);
  const loseG = useMemo(() => {
    try {
      return parseWeightToGrams(lose, localUnit);
    } catch {
      return null;
    }
  }, [lose, localUnit]);
  const bmi = grams && heightCm > 0 ? bmiOf(grams, heightCm) : null;
  const pace =
    grams && loseG && dayCount > 0 && grams > loseG ? paceOf(grams, grams - loseG, dayCount) : null;
  const scan = scanBanned(name);

  async function save(force = false) {
    setError("");
    if (!grams || !loseG || !(heightCm > 0) || !(dayCount > 0)) {
      setError("请填有效的身高、体重和天数");
      return;
    }
    if (scan.blocks.length) return;
    if (scan.warns.length && !force && !ack) {
      setAck(true);
      return;
    }
    try {
      await createWeightGoal({
        name: name.trim() || `${days} 天减重`,
        heightCm,
        startG: grams,
        targetG: grams - loseG,
        days: dayCount,
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "没能保存");
    }
  }

  if (step === 1) {
    return (
      <Shell
        title="减重设置"
        step={1}
        total={3}
        onBack={onBack}
        footer={
          <button
            className="btn btn-primary"
            type="button"
            disabled={!bmi}
            onClick={() => setStep(2)}
          >
            下一步
          </button>
        }
      >
        <div className="t1">先建个身体档案</div>
        <div className="body c2 mt4">只存在本机，用来算 BMI 和节奏。</div>
        <div className="col g10 mt16">
          <Field label="身高" value={height} onChange={setHeight} suffix="cm" />
          <div className="field">
            <span className="f1">
              <span className="lab">当前体重</span>
              <input
                aria-label="当前体重"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </span>
            <div className="seg" style={{ width: 104 }}>
              <button
                type="button"
                className={localUnit === "jin" ? "on" : ""}
                onClick={() => setLocalUnit("jin")}
              >
                斤
              </button>
              <button
                type="button"
                className={localUnit === "kg" ? "on" : ""}
                onClick={() => setLocalUnit("kg")}
              >
                kg
              </button>
            </div>
          </div>
        </div>
        {bmi ? (
          <div className="card mt16">
            <div className="row between">
              <div className="callout c2">你的 BMI</div>
              <span className="chip amber">{bmi.category}</span>
            </div>
            <div className="num" style={{ font: "800 34px/40px var(--font-num)" }}>
              {bmi.text}
            </div>
            <div className="cap c3">中国成人标准</div>
          </div>
        ) : (
          <div className="note amber mt16">体重格式不对，斤最多两位小数，kg 最多三位。</div>
        )}
      </Shell>
    );
  }
  if (step === 2) {
    return (
      <Shell
        title="减重设置"
        step={2}
        total={3}
        onBack={() => setStep(1)}
        footer={
          <button
            className="btn btn-primary"
            type="button"
            disabled={!pace}
            onClick={() => setStep(3)}
          >
            下一步
          </button>
        }
      >
        <div className="t1">你想怎么定目标？</div>
        <div className="body c2 mt4">按天数和要减的重量来排。</div>
        <div className="row g10 mt16">
          <Field label="天数" value={days} onChange={setDays} suffix="天" inputMode="numeric" />
          <Field
            label="减多少"
            value={lose}
            onChange={setLose}
            suffix={localUnit === "jin" ? "斤" : "kg"}
          />
        </div>
        <div className="row g8 wrap mt12">
          {["30", "60", "90", "180"].map((item) => (
            <button
              key={item}
              type="button"
              className={`chip ${days === item ? "brand" : ""}`}
              style={{ height: 32 }}
              onClick={() => setDays(item)}
            >
              {item} 天
            </button>
          ))}
        </div>
        {grams && loseG && grams > loseG ? (
          <div className="card flat mt16">
            目标 {weightLabel(grams - loseG, localUnit)} {localUnit === "jin" ? "斤" : "kg"}
            {heightCm > 0 && targetBmiTooLow(grams - loseG, heightCm)
              ? " · 目标 BMI 偏低，可以再调高一点"
              : ""}
          </div>
        ) : (
          <div className="note amber mt16">减重量要小于当前体重。</div>
        )}
      </Shell>
    );
  }
  const recommend = pace && pace.level !== "ok" ? recommendedDays(pace.deltaG) : 0;
  return (
    <Shell
      title="减重设置"
      step={3}
      total={3}
      onBack={() => setStep(2)}
      footer={
        <button
          className="btn btn-primary"
          type="button"
          disabled={scan.blocks.length > 0}
          onClick={() => void save(ack)}
        >
          {ack && scan.warns.length ? "仍然保存" : "开始减重"}
        </button>
      }
    >
      <div className="t1">看看这个节奏</div>
      <Field
        label="目标名称"
        value={name}
        onChange={(value) => {
          setName(value);
          setAck(false);
        }}
        inputMode="text"
      />
      {pace ? (
        <div className="card mt16">
          <div className="cap c2">每周约</div>
          <div className="num" style={{ font: "800 34px/40px var(--font-num)" }}>
            {weightLabel(pace.weeklyG, "jin")}
          </div>
          <div className="cap c3">斤 · {weightLabel(pace.weeklyG, "kg")} kg</div>
        </div>
      ) : null}
      {pace && pace.level !== "ok" ? (
        <div className="note info mt12" style={{ flexDirection: "column" }}>
          <div>
            {pace.level === "gentle"
              ? "这个速度偏快，建议放慢到每周 0.5–1 kg，更容易坚持。"
              : "这个速度比较快，长期很难坚持。推荐按每周 0.75 kg 来安排。"}
          </div>
          <button
            className="btn btn-secondary xs"
            type="button"
            onClick={() => {
              setDays(String(recommend));
              setName(`${recommend} 天减重`);
            }}
          >
            改为推荐期限 · {recommend} 天
          </button>
        </div>
      ) : null}
      {scan.blocks.length ? (
        <div className="note amber mt12">这类词容易让人不舒服，换个说法才能保存哦</div>
      ) : null}
      {scan.warns.length && !scan.blocks.length ? (
        <div className="note amber mt12">这个词可能让人有压力，确定要用吗？</div>
      ) : null}
      {error ? <div className="note amber mt12">{error}</div> : null}
      <div className="disclaimer">本 App 不提供医疗建议，如有健康问题请咨询医生。</div>
      {grams && heightCm > 0 ? (
        <span className="cap c3">记录时 BMI {bmiOf(grams, heightCm).text}</span>
      ) : null}
    </Shell>
  );
}

function SavingsWizard({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("旅行基金");
  const [target, setTarget] = useState("20000");
  const [days, setDays] = useState("180");
  const [start, setStart] = useState("0");
  const [kind, setKind] = useState<SaveCfg["kind"]>("fixed");
  const [period, setPeriod] = useState<SaveCfg["period"]>("week");
  const [amount, setAmount] = useState("");
  const [base, setBase] = useState("10");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const scan = scanBanned(name);
  const targetFen = useMemo(() => {
    try {
      return parseYuanToFen(target);
    } catch {
      return null;
    }
  }, [target]);
  const startFen = useMemo(() => {
    try {
      return parseYuanToFen(start || "0");
    } catch {
      return null;
    }
  }, [start]);
  const dayCount = Number(days);
  const rates =
    targetFen !== null && startFen !== null && dayCount > 0
      ? requiredRates(Math.max(0, targetFen - startFen), dayCount)
      : null;
  const suggested = rates
    ? period === "day"
      ? rates.dailyFen
      : period === "month"
        ? rates.monthlyFen
        : rates.weeklyFen
    : 0;

  async function save(force = false) {
    setError("");
    if (scan.blocks.length) return;
    if (scan.warns.length && !force && !ack) {
      setAck(true);
      return;
    }
    if (targetFen === null || startFen === null || !(dayCount > 0)) {
      setError("请填写有效的金额和天数");
      return;
    }
    try {
      const deadline = addDays(todayKey(), dayCount);
      if (kind === "week52") {
        const baseFen = parseYuanToFen(base);
        await createSavingsGoal({
          name,
          targetFen: week52Cumulative(52, baseFen),
          startFen,
          kind: "week52",
          period: "week",
          amountFen: 0,
          baseFen,
          deadline: addDays(todayKey(), 364),
        });
      } else {
        const amountFen = amount.trim() ? parseYuanToFen(amount) : suggested;
        await createSavingsGoal({
          name,
          targetFen,
          startFen,
          kind: "fixed",
          period,
          amountFen,
          baseFen: 0,
          deadline,
        });
      }
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "没能保存");
    }
  }

  if (step === 1) {
    return (
      <Shell
        title="存钱设置"
        step={1}
        total={3}
        onBack={onBack}
        footer={
          <button
            className="btn btn-primary"
            type="button"
            disabled={scan.blocks.length > 0 || targetFen === null}
            onClick={() => setStep(2)}
          >
            下一步
          </button>
        }
      >
        <div className="t1">存钱为了什么？</div>
        <div className="body c2 mt4">完全手动记账，不连接银行。</div>
        <div className="col g10 mt16">
          <Field
            label="名目"
            value={name}
            onChange={(value) => {
              setName(value);
              setAck(false);
            }}
            inputMode="text"
          />
          <Field label="目标金额" value={target} onChange={setTarget} suffix="元" />
          <Field label="期限" value={days} onChange={setDays} suffix="天" inputMode="numeric" />
        </div>
        {scan.blocks.length ? (
          <div className="note amber mt12">这类词容易让人不舒服，换个说法才能保存哦</div>
        ) : null}
        {scan.warns.length && !scan.blocks.length ? (
          <div className="note amber mt12">
            这个词可能让人有压力，确定要用吗？
            <button className="btn btn-secondary xs" type="button" onClick={() => setAck(true)}>
              {ack ? "已确认，可以继续" : "仍然保存"}
            </button>
          </div>
        ) : null}
      </Shell>
    );
  }
  if (step === 2) {
    return (
      <Shell
        title="存钱设置"
        step={2}
        total={3}
        onBack={() => setStep(1)}
        footer={
          <button
            className="btn btn-primary"
            type="button"
            disabled={startFen === null}
            onClick={() => setStep(3)}
          >
            下一步
          </button>
        }
      >
        <div className="t1">已经存了多少？</div>
        <div className="body c2 mt4">没有就填 0。</div>
        <div className="card tc mt16">
          <div className="cap c2">起始余额</div>
          <Field label="起始余额" value={start} onChange={setStart} suffix="元" />
          {targetFen !== null && startFen !== null ? (
            <div className="cap c2 mt8">
              还需存 <b className="num">¥{yuanLabel(Math.max(0, targetFen - startFen))}</b>
              {rates ? ` · 约每天 ¥${yuanLabel(rates.dailyFen)}` : ""}
            </div>
          ) : null}
        </div>
      </Shell>
    );
  }
  return (
    <Shell
      title="存钱设置"
      step={3}
      total={3}
      onBack={() => setStep(2)}
      footer={
        <button className="btn btn-primary" type="button" onClick={() => void save(ack)}>
          完成，开始存钱
        </button>
      }
    >
      <div className="t1">选一种存法</div>
      <div className="col g10 mt16">
        <button
          type="button"
          className={`opt ${kind === "fixed" ? "on" : ""}`}
          onClick={() => setKind("fixed")}
        >
          <div className="f1">
            <div className="t3">固定金额</div>
            <div className="cap c2">每期存一笔固定的数</div>
          </div>
        </button>
        <button
          type="button"
          className={`opt ${kind === "week52" ? "on" : ""}`}
          onClick={() => setKind("week52")}
        >
          <div className="f1">
            <div className="t3">52 周挑战</div>
            <div className="cap c2">
              第 n 周存 n × 基数，52 周共 {yuanLabel(week52Cumulative(52, 1000))} 元（基数 10 元）
            </div>
          </div>
        </button>
      </div>
      {kind === "fixed" ? (
        <div className="mt16">
          <div className="seg">
            {(["day", "week", "month"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={period === item ? "on" : ""}
                onClick={() => setPeriod(item)}
              >
                {item === "day" ? "每天" : item === "week" ? "每周" : "每月"}
              </button>
            ))}
          </div>
          <div className="cap c2 mt12">
            按剩余金额建议 ¥{yuanLabel(suggested)}，也可以改成自己的数。
          </div>
          <div className="mt12">
            <Field label="每期金额" value={amount} onChange={setAmount} suffix="元" />
          </div>
        </div>
      ) : (
        <div className="mt16">
          <Field label="每周基数" value={base} onChange={setBase} suffix="元" />
          <div className="cap c2 mt8">
            第 1 周 {base || "0"} 元，第 52 周 {(Number(base) || 0) * 52} 元。
          </div>
        </div>
      )}
      {error ? <div className="note amber mt12">{error}</div> : null}
    </Shell>
  );
}
