import type { GoalType } from "@/db/dexie";

export const TYPE_ID = "count" as const satisfies GoalType;

export function isCountType(type: GoalType): boolean {
  return type === TYPE_ID;
}
