import type { GoalType } from "@/db/dexie";

export const TYPE_ID = "savings" as const satisfies GoalType;

export function isSavingsType(type: GoalType): boolean {
  return type === TYPE_ID;
}
