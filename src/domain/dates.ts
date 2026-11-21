/** DateKey = 'YYYY-MM-DD'（本地时区）。所有“按天”的规则都基于 DateKey，避免时区/DST 误差。 */
export type DateKey = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDays(k: DateKey): number {
  const m = RE.exec(k);
  if (!m) throw new RangeError(`非法 DateKey: ${k}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

function fromUtcDays(d: number): DateKey {
  const dt = new Date(d * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** b − a 的天数（b 晚于 a 为正） */
export function diffDays(a: DateKey, b: DateKey): number {
  return toUtcDays(b) - toUtcDays(a);
}

export function addDays(k: DateKey, n: number): DateKey {
  return fromUtcDays(toUtcDays(k) + n);
}

/** 本地时间戳 → DateKey（使用运行环境时区；测试可传入 tzOffsetMin 固定） */
export function dateKeyOf(ts: number, tzOffsetMin?: number): DateKey {
  if (tzOffsetMin === undefined) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return fromUtcDays(Math.floor((ts + tzOffsetMin * 60_000) / 86_400_000));
}

/** 自然周周一（Asia/Shanghai 本地 DateKey；Q-S3 已定 2026-11-21：周一起）所在日期 */
export function weekStart(k: DateKey): DateKey {
  const d = toUtcDays(k);
  const dow = (new Date(d * 86_400_000).getUTCDay() + 6) % 7; // 周一=0
  return fromUtcDays(d - dow);
}
