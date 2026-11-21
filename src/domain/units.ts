/** Convert yuan (yuan, may be fractional) to integer fen. */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

/** Convert integer fen to yuan. */
export function fenToYuan(fen: number): number {
  return fen / 100;
}

/** Format a weight stored in kilograms. */
export function formatKg(kg: number, digits = 1): string {
  return kg.toFixed(digits);
}
