// Core domain types for the betting-statistics app.

/** Full-time result from the home team's perspective. */
export type Result = "H" | "D" | "A";

/** A team's outcome in one of its matches (for form strings). */
export type FormResult = "W" | "D" | "L";

/** A single played match with results, match stats and (optional) odds. */
export interface Match {
  div: string;
  date: Date;
  homeTeam: string;
  awayTeam: string;
  fthg: number; // full-time home goals
  ftag: number; // full-time away goals
  ftr: Result;
  // half-time
  hthg?: number;
  htag?: number;
  // match stats (may be missing for some leagues/seasons)
  hs?: number; // home shots
  as?: number; // away shots
  hst?: number; // home shots on target
  ast?: number; // away shots on target
  hc?: number; // home corners
  ac?: number; // away corners
  hy?: number; // home yellow cards
  ay?: number; // away yellow cards
  hr?: number; // home red cards
  ar?: number; // away red cards
  referee?: string;
  // odds (market averages, decimal)
  oddsH?: number;
  oddsD?: number;
  oddsA?: number;
  over25?: number;
  under25?: number;
}

/** An upcoming fixture with pre-match odds (no result yet). */
export interface Fixture {
  div: string;
  date: Date;
  time?: string;
  homeTeam: string;
  awayTeam: string;
  oddsH?: number;
  oddsD?: number;
  oddsA?: number;
  over25?: number;
  under25?: number;
  ahLine?: number; // Asian handicap line (home)
}

/** Attacking / defensive strength ratings for one team. */
export interface TeamStrength {
  team: string;
  attack: number; // >1 scores more than league average
  defense: number; // >1 concedes more than league average (weaker)
  matches: number;
}

/** A row in a computed league table with betting-relevant splits. */
export interface TableRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  // rates used across markets
  scoredPerGame: number;
  concededPerGame: number;
  over25Pct: number; // share of this team's games with >2.5 goals
  bttsPct: number; // share where both teams scored
  cleanSheetPct: number;
  failedToScorePct: number;
  // recent form, most recent first, e.g. ["W","D","L",...]
  form: FormResult[];
  // home / away splits
  homePts: number;
  awayPts: number;
  homeGfPg: number;
  homeGaPg: number;
  awayGfPg: number;
  awayGaPg: number;
  // model strengths
  attack: number;
  defense: number;
  // shots-based xG proxy per game (undefined if no shot data)
  xgfPg?: number;
  xgaPg?: number;
  // optional external rating
  elo?: number;
}

/** Probabilities and derived betting signals for a single fixture. */
export interface Prediction {
  fixture: Fixture;
  // model probabilities (Dixon-Coles), already normalised
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
  // market (de-vigged) probabilities, when odds are present
  market?: {
    pHome: number;
    pDraw: number;
    pAway: number;
    overround: number;
  };
  marketOU?: {
    pOver25: number;
    pUnder25: number;
    overround: number;
  };
  // independent Elo-based second opinion (when both teams have ratings)
  elo?: {
    pHome: number;
    pDraw: number;
    pAway: number;
    homeElo: number;
    awayElo: number;
  };
  // true when the goal model and Elo agree on the favoured side
  consensus?: boolean;
  // best value edge found across 1X2 outcomes, if any
  value?: ValueSignal[];
}

/** A detected value opportunity on one selection. */
export interface ValueSignal {
  market: string; // e.g. "Home", "Over 2.5"
  odds: number; // decimal odds offered
  modelProb: number;
  marketProb: number; // de-vigged fair prob
  edge: number; // modelProb - marketProb
  ev: number; // expected value per unit stake: modelProb*odds - 1
}

export interface LeagueModel {
  code: string;
  name: string;
  country: string;
  season: string; // e.g. "2025/26"
  table: TableRow[];
  strengths: Map<string, TeamStrength>;
  baseline: { homeAvg: number; awayAvg: number };
  matches: Match[]; // matches used (current display season)
  updatedAt: string;
}
