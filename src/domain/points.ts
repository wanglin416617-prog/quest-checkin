export type Difficulty = "easy" | "normal" | "hard" | "epic";

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 10,
  normal: 20,
  hard: 40,
  epic: 80,
};

/** Streak bonus: +5% per full 7 days, capped at 1.5x. */
export function streakMultiplier(streakDays: number): number {
  if (streakDays <= 0) {
    return 1;
  }
  return Math.min(1.5, 1 + Math.floor(streakDays / 7) * 0.05);
}

export function checkinPoints(difficulty: Difficulty, streakDays: number): number {
  return Math.round(DIFFICULTY_POINTS[difficulty] * streakMultiplier(streakDays));
}
