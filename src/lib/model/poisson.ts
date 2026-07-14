// Dixon-Coles style goal model.
//
// Team attacking/defensive strengths are estimated from historical goals using
// recency weighting (recent games matter more) and shrinkage toward the league
// mean (so teams with few games are not over-fit). Expected goals feed two
// independent Poisson distributions, corrected for the known dependence between
// low scores (the Dixon-Coles tau term), giving a full scoreline matrix. All
// betting markets (1X2, Over/Under, BTTS) are read off that matrix.

import { Match, TeamStrength } from "@/lib/types";

const MAX_GOALS = 10;
const HALF_LIFE_DAYS = 210; // recency: a result ~7 months old counts ~half
const SHRINK_GAMES = 6; // prior strength of the league-average shrinkage
const RHO = -0.12; // Dixon-Coles low-score correction
const XG_BLEND = 0.6; // weight on the shots-based xG proxy vs actual goals

export interface FittedModel {
  strengths: Map<string, TeamStrength>;
  homeAvg: number; // league average home goals per game
  awayAvg: number; // league average away goals per game
  xgConversion: number | null; // goals per shot-on-target (null if no shot data)
}

/**
 * Shots-based expected-goals proxy: goals scored per shot-on-target across the
 * sample. Multiplying a team's shots-on-target by this gives an "expected goals"
 * estimate that is less noisy than actual goals. Null when no shot data exists.
 */
export function sotConversion(matches: Match[]): number | null {
  let goals = 0;
  let sot = 0;
  for (const m of matches) {
    if (m.hst === undefined || m.ast === undefined) continue;
    goals += m.fthg + m.ftag;
    sot += m.hst + m.ast;
  }
  return sot > 0 ? goals / sot : null;
}

/** Blend actual goals with the shots-on-target xG proxy for one side. */
function effectiveGoals(goals: number, sot: number | undefined, conv: number | null): number {
  if (conv === null || sot === undefined) return goals;
  return XG_BLEND * (sot * conv) + (1 - XG_BLEND) * goals;
}

function weightFor(matchDate: Date, ref: Date): number {
  const ageDays = (ref.getTime() - matchDate.getTime()) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Estimate strengths from matches, as of reference date `ref`. */
export function fitModel(matches: Match[], ref: Date): FittedModel {
  // Shots-based xG proxy conversion, blended into the goal figures below.
  const conv = sotConversion(matches);

  // Weighted league baselines (on the xG-blended goal figures).
  let whg = 0;
  let wag = 0;
  let wsum = 0;
  for (const m of matches) {
    const w = weightFor(m.date, ref);
    whg += w * effectiveGoals(m.fthg, m.hst, conv);
    wag += w * effectiveGoals(m.ftag, m.ast, conv);
    wsum += w;
  }
  const homeAvg = wsum > 0 ? whg / wsum : 1.45;
  const awayAvg = wsum > 0 ? wag / wsum : 1.15;

  // Per-team weighted scored/conceded, split by venue.
  interface Acc {
    scoredHome: number;
    concededHome: number;
    wHome: number;
    scoredAway: number;
    concededAway: number;
    wAway: number;
    games: number;
  }
  const acc = new Map<string, Acc>();
  const get = (t: string): Acc => {
    let a = acc.get(t);
    if (!a) {
      a = { scoredHome: 0, concededHome: 0, wHome: 0, scoredAway: 0, concededAway: 0, wAway: 0, games: 0 };
      acc.set(t, a);
    }
    return a;
  };

  for (const m of matches) {
    const w = weightFor(m.date, ref);
    const effH = effectiveGoals(m.fthg, m.hst, conv);
    const effA = effectiveGoals(m.ftag, m.ast, conv);
    const h = get(m.homeTeam);
    const a = get(m.awayTeam);
    h.scoredHome += w * effH;
    h.concededHome += w * effA;
    h.wHome += w;
    h.games += 1;
    a.scoredAway += w * effA;
    a.concededAway += w * effH;
    a.wAway += w;
    a.games += 1;
  }

  const strengths = new Map<string, TeamStrength>();
  for (const [team, a] of acc) {
    // Shrink venue rates toward the corresponding league average.
    const homeScored = shrink(a.scoredHome, a.wHome, homeAvg);
    const homeConceded = shrink(a.concededHome, a.wHome, awayAvg);
    const awayScored = shrink(a.scoredAway, a.wAway, awayAvg);
    const awayConceded = shrink(a.concededAway, a.wAway, homeAvg);

    // Attack: how much a team scores vs league norm (avg of both venues).
    const attack = (homeScored / homeAvg + awayScored / awayAvg) / 2;
    // Defense: how much it concedes vs norm (>1 == leaky).
    const defense = (homeConceded / awayAvg + awayConceded / homeAvg) / 2;

    strengths.set(team, { team, attack, defense, matches: a.games });
  }

  return { strengths, homeAvg, awayAvg, xgConversion: conv };
}

function shrink(weightedGoals: number, weight: number, prior: number): number {
  // Bayesian-ish: blend the observed weighted rate with the league prior.
  return (weightedGoals + SHRINK_GAMES * prior) / (weight + SHRINK_GAMES);
}

/** Expected goals for a fixture. Falls back to league average for unknowns. */
export function expectedGoals(
  model: FittedModel,
  home: string,
  away: string,
): { lambda: number; mu: number } {
  const dh = model.strengths.get(home);
  const da = model.strengths.get(away);
  const attH = dh?.attack ?? 1;
  const defH = dh?.defense ?? 1;
  const attA = da?.attack ?? 1;
  const defA = da?.defense ?? 1;
  const lambda = attH * defA * model.homeAvg;
  const mu = attA * defH * model.awayAvg;
  return { lambda: clamp(lambda), mu: clamp(mu) };
}

function clamp(x: number): number {
  return Math.min(6, Math.max(0.05, x));
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

const FACT: number[] = [1];
function factorial(n: number): number {
  for (let i = FACT.length; i <= n; i++) FACT[i] = FACT[i - 1] * i;
  return FACT[n];
}

/** Dixon-Coles low-score dependence correction. */
function tau(i: number, j: number, lambda: number, mu: number): number {
  if (i === 0 && j === 0) return 1 - lambda * mu * RHO;
  if (i === 0 && j === 1) return 1 + lambda * RHO;
  if (i === 1 && j === 0) return 1 + mu * RHO;
  if (i === 1 && j === 1) return 1 - RHO;
  return 1;
}

export interface MarketProbs {
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pUnder25: number;
  pBttsYes: number;
  pBttsNo: number;
  expHomeGoals: number;
  expAwayGoals: number;
  topScores: { score: string; p: number }[];
}

/** Build the full scoreline matrix and read every market off it. */
export function marketProbs(lambda: number, mu: number): MarketProbs {
  const matrix: number[][] = [];
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    matrix[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPmf(i, lambda) * poissonPmf(j, mu) * tau(i, j, lambda, mu);
      matrix[i][j] = p;
      total += p;
    }
  }

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver25 = 0;
  let pBttsYes = 0;
  const scores: { score: string; p: number }[] = [];

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = matrix[i][j] / total;
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
      if (i + j >= 3) pOver25 += p;
      if (i >= 1 && j >= 1) pBttsYes += p;
      scores.push({ score: `${i}-${j}`, p });
    }
  }

  scores.sort((a, b) => b.p - a.p);
  return {
    pHome,
    pDraw,
    pAway,
    pOver25,
    pUnder25: 1 - pOver25,
    pBttsYes,
    pBttsNo: 1 - pBttsYes,
    expHomeGoals: lambda,
    expAwayGoals: mu,
    topScores: scores.slice(0, 5),
  };
}
