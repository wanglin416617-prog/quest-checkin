import confetti from "canvas-confetti";

export type CelebrateTier = "normal" | "rare" | "epic" | "legendary";

export function celebrate(tier: CelebrateTier, reduced: boolean): void {
  if (reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const base = { origin: { y: 0.72 }, disableForReducedMotion: true } as const;
  if (tier === "normal") {
    void confetti({ ...base, particleCount: 12, spread: 60, startVelocity: 18, scalar: 0.7 });
    return;
  }
  if (tier === "rare") {
    void confetti({
      ...base,
      particleCount: 34,
      spread: 70,
      startVelocity: 28,
      scalar: 0.85,
      colors: ["#3B82F6", "#F5B000", "#FF7A1A"],
    });
    return;
  }
  if (tier === "epic") {
    void confetti({
      ...base,
      particleCount: 40,
      spread: 100,
      startVelocity: 32,
      scalar: 0.9,
      colors: ["#8B5CF6", "#C1A8FF", "#FF7A1A"],
    });
    return;
  }
  void confetti({
    ...base,
    particleCount: 56,
    spread: 120,
    startVelocity: 40,
    scalar: 1,
    colors: ["#F5B000", "#FFD36B", "#FF7A1A", "#FFFFFF"],
  });
}

export function tierOf(result: {
  allClear: number;
  streak: number;
  leveled: boolean;
  box: boolean;
  points: number;
}): CelebrateTier {
  if (result.box) return "legendary";
  if (result.leveled || result.allClear > 0) return "epic";
  if (result.streak === 3 || result.streak === 7 || result.streak === 21) return "rare";
  if (result.points <= 0) return "normal";
  return "normal";
}
