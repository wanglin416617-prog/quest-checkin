/**
 * 提示语模板渲染：
 *  - 已知占位符 {食物}{热量}{天数}{步数}{跳绳分钟}{金额}{目标名}{扣分}{任务}
 *  - 缺值（undefined/null/''/NaN）显示“—”
 *  - 未知占位符原样保留，并在 unknown 中返回（编辑器标红）
 *  - 数值：整数原样；非整数保留 1 位小数（四舍五入）
 */
export const KNOWN_PLACEHOLDERS = [
  "食物",
  "热量",
  "天数",
  "步数",
  "跳绳分钟",
  "金额",
  "目标名",
  "扣分",
  "任务",
] as const;
export type Placeholder = (typeof KNOWN_PLACEHOLDERS)[number];
export type PromptVars = Partial<Record<Placeholder, string | number | null | undefined>>;

export const MISSING = "—";

function fmt(v: string | number | null | undefined): string {
  if (v === undefined || v === null) return MISSING;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return MISSING;
    if (Number.isInteger(v)) return String(v);
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  return v === "" ? MISSING : v;
}

export function renderPrompt(
  template: string,
  vars: PromptVars,
): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const text = template.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
    if ((KNOWN_PLACEHOLDERS as readonly string[]).includes(key))
      return fmt(vars[key as Placeholder]);
    if (!unknown.includes(key)) unknown.push(key);
    return whole;
  });
  return { text, unknown };
}

export const BUILTIN_TEMPLATES = {
  gentle: "{食物}好吃吧～大约 {热量} kcal，相当于 {天数} 天的小努力。今天{任务}就补回来啦",
  strict: "{食物} 约 {热量} kcal，抵消了 {天数} 天的坚持。完成「{任务}」把它赢回来。",
  savage: "一杯{食物}，{天数} 天白干。{步数} 步，走起来，别找借口。",
  savings: "这笔 {金额} 元让「{目标名}」又远了 {天数} 天。48 小时内多存 {金额} 元追回来。",
} as const;
