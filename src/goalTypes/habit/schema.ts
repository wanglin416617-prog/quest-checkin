import type { GoalType } from "@/db/dexie";

export const TYPE_ID = "habit" as const satisfies GoalType;

export function isHabitType(type: GoalType): boolean {
  return type === TYPE_ID;
}
