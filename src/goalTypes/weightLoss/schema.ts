import type { GoalType } from "@/db/dexie";

export const TYPE_ID = "weightLoss" as const satisfies GoalType;

export function isWeightLossType(type: GoalType): boolean {
  return type === TYPE_ID;
}
