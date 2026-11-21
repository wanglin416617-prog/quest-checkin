import { TYPE_ID as count } from "@/goalTypes/count/schema";
import { TYPE_ID as habit } from "@/goalTypes/habit/schema";
import { TYPE_ID as savings } from "@/goalTypes/savings/schema";
import { TYPE_ID as weightLoss } from "@/goalTypes/weightLoss/schema";
import type { GoalType } from "@/db/dexie";

export const GOAL_TYPES: readonly GoalType[] = [habit, count, weightLoss, savings];

export function isGoalType(value: string): value is GoalType {
  return (GOAL_TYPES as readonly string[]).includes(value);
}
