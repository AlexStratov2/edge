// Betting-odds math: format conversion, margin removal (de-vig) and value/EV.
// These are the primitives the "opportunity engine" is built on.

/** Decimal odds -> raw implied probability (includes the bookmaker margin). */
export function impliedProb(decimal: number): number {
  return decimal > 0 ? 1 / decimal : 0;
}

/** Fractional odds "a/b" -> decimal. */
export function fractionalToDecimal(a: number, b: number): number {
  return a / b + 1;
}

/** American (moneyline) odds -> decimal. */
export function americanToDecimal(american: number): number {
  return american > 0 ? american / 100 + 1 : 100 / -american + 1;
}

/** Decimal -> American, for display. */
export function decimalToAmerican(decimal: number): number {
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export interface DeVig {
  probs: number[];
  overround: number; // e.g. 1.05 == 5% margin
  margin: number; // overround - 1
}

/**
 * Remove the bookmaker margin from a set of decimal odds by proportional
 * normalisation, recovering "fair" probabilities that sum to 1. This is the
 * simplest de-vig method and is transparent; more elaborate methods (Shin,
 * power) exist but proportional is a sound default.
 */
export function deVig(decimalOdds: number[]): DeVig {
  const raw = decimalOdds.map(impliedProb);
  const overround = raw.reduce((s, p) => s + p, 0);
  const probs = overround > 0 ? raw.map((p) => p / overround) : raw;
  return { probs, overround, margin: overround - 1 };
}

/** Expected value per unit stake for a bet at `decimal` odds with true prob p. */
export function expectedValue(p: number, decimal: number): number {
  return p * decimal - 1;
}

/** Model edge over the fair market price (positive == value in your favour). */
export function edge(modelProb: number, fairMarketProb: number): number {
  return modelProb - fairMarketProb;
}

/**
 * Kelly-criterion stake fraction (fraction of bankroll). Returns 0 when there
 * is no edge. Callers typically apply a fractional-Kelly multiplier (e.g. 0.25)
 * because full Kelly is famously volatile.
 */
export function kellyFraction(p: number, decimal: number): number {
  const b = decimal - 1;
  if (b <= 0) return 0;
  const f = (p * b - (1 - p)) / b;
  return Math.max(0, f);
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
