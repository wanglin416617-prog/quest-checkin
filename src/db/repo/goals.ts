import type { Goal, QuestDatabase } from "@/db/dexie";
import { db as defaultDb } from "@/db/dexie";

export function createGoalRepo(database: QuestDatabase = defaultDb) {
  return {
    async add(goal: Goal): Promise<string> {
      return database.goals.add(goal);
    },
    async getById(id: string): Promise<Goal | undefined> {
      return database.goals.get(id);
    },
    async listActive(): Promise<Goal[]> {
      return database.goals.where("status").equals("active").sortBy("order");
    },
    async update(id: string, changes: Partial<Omit<Goal, "id">>): Promise<number> {
      return database.goals.update(id, changes);
    },
  };
}
