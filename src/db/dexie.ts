import Dexie, { type Table } from "dexie";
import type { Difficulty } from "@/domain/points";
import type { DateKey } from "@/domain/dateKey";

export type GoalType = "habit" | "count" | "weightLoss" | "savings";
export type GoalStatus = "active" | "paused" | "done" | "archived";

export interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: GoalType;
  typeConfig: unknown;
  typeConfigVersion: number;
  difficulty: Difficulty;
  status: GoalStatus;
  startDate: DateKey;
  deadline?: DateKey;
  createdAt: number;
  order: number;
}

export class QuestDatabase extends Dexie {
  goals!: Table<Goal, string>;

  constructor(name = "quest-checkin") {
    super(name);
    this.version(1).stores({
      goals: "id, type, status, startDate, createdAt, order",
    });
  }
}

export const db = new QuestDatabase();
