import { registerSW } from "virtual:pwa-register";

type Refresh = () => Promise<void>;

let listener: ((refresh: Refresh) => void) | null = null;
let pending: Refresh | null = null;

export function onPwaRefresh(cb: (refresh: Refresh) => void): () => void {
  listener = cb;
  if (pending) cb(pending);
  return () => {
    if (listener === cb) listener = null;
  };
}

export function registerPwa(): void {
  if (import.meta.env.MODE === "test") {
    return;
  }
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const refresh = () => updateSW(true);
      pending = refresh;
      listener?.(refresh);
    },
  });
}
