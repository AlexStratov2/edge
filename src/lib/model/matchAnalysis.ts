// Pure, client-safe market math for the Match Analysis page. Given a league's
// baselines and two teams' rates (baked at build time), compute every market —
// goals ladder, halves, BTTS, corners, cards — as probabilities. No I/O here.

import type { AnalysisLeague, AnalysisTeam } from "@/lib/model/build";

const FACT: number[] = [1];
function factorial(n: number): number {
  for (let i = FACT.length; i <= n; i++) FACT[i] = FACT[i - 1] * i;
  return FACT[n];
}
function pmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
/** P(total > line) for a Poisson(lambda); line is an x.5 value. */
export function poissonOver(lambda: number, line: number): number {
  const floor = Math.floor(line);
  let cum = 0;
  for (let k = 0; k <= floor; k++) cum += pmf(k, lambda);
  return 1 - cum;
}

export interface OverLine {
  line: number;
  over: number;
  under: number;
}

export interface GoalAnalysis {
  expHome: number;
  expAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  ou: OverLine[];
  bttsYes: number;
  firstHalfOver05: number;
  firstHalfOver15: number;
  secondHalfOver15: number;
  topScores: { score: string; p: number }[];
}

const MAX = 8;

export function goalAnalysis(lg: AnalysisLeague, home: AnalysisTeam, away: AnalysisTeam): GoalAnalysis {
  const lambda = clamp(home.attack * away.defense * lg.homeAvg);
  const mu = clamp(away.attack * home.defense * lg.awayAvg);

  let pHome = 0, pDraw = 0, pAway = 0, bttsYes = 0;
  const scores: { score: string; p: number }[] = [];
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = pmf(i, lambda) * pmf(j, mu);
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
      if (i >= 1 && j >= 1) bttsYes += p;
      scores.push({ score: `${i}-${j}`, p });
    }
  }
  scores.sort((a, b) => b.p - a.p);

  const total = lambda + mu;
  const ou = [1.5, 2.5, 3.5, 4.5].map((line) => {
    const over = poissonOver(total, line);
    return { line, over, under: 1 - over };
  });

  const firstHalf = total * lg.halfGoalShare;
  const secondHalf = total * (1 - lg.halfGoalShare);

  return {
    expHome: lambda,
    expAway: mu,
    pHome, pDraw, pAway,
    ou,
    bttsYes,
    firstHalfOver05: poissonOver(firstHalf, 0.5),
    firstHalfOver15: poissonOver(firstHalf, 1.5),
    secondHalfOver15: poissonOver(secondHalf, 1.5),
    topScores: scores.slice(0, 5),
  };
}

export interface CornerAnalysis {
  expHome: number;
  expAway: number;
  expTotal: number;
  ou: OverLine[];
  homeTeam: { line: number; over: number }[];
  awayTeam: { line: number; over: number }[];
}

export function cornerAnalysis(home: AnalysisTeam, away: AnalysisTeam): CornerAnalysis {
  const expHome = avg(home.cfH, away.caA);
  const expAway = avg(away.cfA, home.caH);
  const total = expHome + expAway;
  const ou = [8.5, 9.5, 10.5, 11.5].map((line) => {
    const over = poissonOver(total, line);
    return { line, over, under: 1 - over };
  });
  return {
    expHome, expAway, expTotal: total,
    ou,
    homeTeam: [3.5, 4.5, 5.5].map((line) => ({ line, over: poissonOver(expHome, line) })),
    awayTeam: [3.5, 4.5, 5.5].map((line) => ({ line, over: poissonOver(expAway, line) })),
  };
}

export interface CardAnalysis {
  expHome: number;
  expAway: number;
  expTotal: number;
  ou: OverLine[];
}

export function cardAnalysis(home: AnalysisTeam, away: AnalysisTeam): CardAnalysis {
  const expHome = avg(home.kfH, away.kaA);
  const expAway = avg(away.kfA, home.kaH);
  const total = expHome + expAway;
  const ou = [2.5, 3.5, 4.5, 5.5].map((line) => {
    const over = poissonOver(total, line);
    return { line, over, under: 1 - over };
  });
  return { expHome, expAway, expTotal: total, ou };
}

function avg(a: number, b: number): number {
  return (a + b) / 2;
}
function clamp(x: number): number {
  return Math.min(6, Math.max(0.05, x));
}
