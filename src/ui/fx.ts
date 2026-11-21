import confetti from "canvas-confetti";

export type CelebrateTier = "normal" | "rare" | "epic" | "legendary";

/** 与 motion-spec 的撒花时长对齐：普通 400ms，稀有 700ms，史诗约 1s，传说 1.6s。 */
const LIFE_MS: Record<CelebrateTier, number> = {
  normal: 400,
  rare: 700,
  epic: 1000,
  legendary: 1600,
};

type Shooter = ((options: confetti.Options) => Promise<undefined> | null) & {
  reset: () => void;
};

let canvas: HTMLCanvasElement | null = null;
let shooter: Shooter | null = null;
let timer = 0;

export function clearCelebration(): void {
  if (timer) window.clearTimeout(timer);
  timer = 0;
  shooter?.reset();
  canvas?.remove();
  canvas = null;
  shooter = null;
}

export function celebrate(tier: CelebrateTier, reduced: boolean): void {
  clearCelebration();
  if (reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const host = document.querySelector(".app");
  if (!host) return;
  canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  shooter = confetti.create(canvas, { resize: true, useWorker: false }) as Shooter;
  const life = LIFE_MS[tier];
  const ticks = Math.max(16, Math.round(life / (1000 / 60)));
  const base = { origin: { y: 0.72 }, ticks, disableForReducedMotion: true } as const;
  if (tier === "normal") {
    void shooter({ ...base, particleCount: 12, spread: 60, startVelocity: 18, scalar: 0.7 });
  } else if (tier === "rare") {
    void shooter({
      ...base,
      particleCount: 34,
      spread: 70,
      startVelocity: 28,
      scalar: 0.85,
      colors: ["#3B82F6", "#F5B000", "#FF7A1A"],
    });
  } else if (tier === "epic") {
    void shooter({
      ...base,
      particleCount: 40,
      spread: 100,
      startVelocity: 32,
      scalar: 0.9,
      colors: ["#8B5CF6", "#C1A8FF", "#FF7A1A"],
    });
  } else {
    void shooter({
      ...base,
      particleCount: 56,
      spread: 120,
      startVelocity: 40,
      scalar: 1,
      colors: ["#F5B000", "#FFD36B", "#FF7A1A", "#FFFFFF"],
    });
  }
  timer = window.setTimeout(clearCelebration, life);
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
  return "normal";
}
