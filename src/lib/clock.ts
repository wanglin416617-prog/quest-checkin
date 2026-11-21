import { addDays, dateKeyOf, type DateKey } from "@/domain/dates";

/** Asia/Shanghai 没有夏令时，固定 UTC+8。 */
export const SHANGHAI_OFFSET_MIN = 480;

export function todayKey(now = Date.now()): DateKey {
  return dateKeyOf(now, SHANGHAI_OFFSET_MIN);
}

/** 上海时段问候：5–11 早上好，12–17 下午好，其余晚上好。 */
export function greetingOf(now = Date.now()): string {
  const hour = new Date(now + SHANGHAI_OFFSET_MIN * 60_000).getUTCHours();
  if (hour >= 5 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  return "晚上好";
}

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

export function formatDayLabel(day: DateKey): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const dow = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `周${WEEKDAY[dow]} · ${month}月${date}日`;
}

export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}
