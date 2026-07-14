// Orchestration layer the UI calls: load data, fit the model, build tables and
// produce value-ranked predictions. Results are memoised per process so a page
// render does not refit every league on each request.

import { loadExtraMatches, loadFixtures, loadMatches } from "@/lib/sources/footballData";
import { EloRating, loadEloFixtures, loadEloRatings, normaliseClub } from "@/lib/sources/clubElo";
import { hasApiFootballKey, loadApiFootballFixtures } from "@/lib/sources/apiFootball";
import { LEAGUES, LEAGUE_BY_CODE, seasonCodes, seasonLabel } from "@/lib/leagues";
import { expectedGoals, fitModel, FittedModel, marketProbs, sotConversion } from "@/lib/model/poisson";
import { eloProbs, isConsensus } from "@/lib/model/elo";
import { deVig, expectedValue } from "@/lib/model/odds";
import { Fixture, FormResult, LeagueModel, Match, Prediction, Result, TableRow, ValueSignal } from "@/lib/types";

const MIN_EV = 0.02; // flag a selection as value at +2% expected value or better
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Cached<T> {
  at: number;
  value: T;
}
const modelCache = new Map<string, Cached<LeagueModel>>();
let fittedCache = new Map<string, Cached<FittedModel>>();
let eloCache: Cached<Map<string, EloRating>> | null = null;

function now(): Date {
  return new Date();
}

async function getElo(): Promise<Map<string, EloRating>> {
  if (eloCache && Date.now() - eloCache.at < CACHE_TTL_MS) return eloCache.value;
  const value = await loadEloRatings(now());
  eloCache = { at: Date.now(), value };
  return value;
}

/** Load per-season matches, choosing a display season and a training set. */
async function loadLeagueMatches(code: string): Promise<{
  training: Match[];
  display: Match[];
  seasonCode: string;
}> {
  // Extra-league single-file format (e.g. Romania): all seasons in one file.
  const cfg = LEAGUE_BY_CODE.get(code);
  if (cfg?.extra) {
    const all = await loadExtraMatches(cfg.extra);
    const seasons = [...new Set(all.map((m) => m.season).filter(Boolean))].sort() as string[];
    if (seasons.length === 0) return { training: [], display: [], seasonCode: "" };
    const latest = seasons[seasons.length - 1];
    const trainSeasons = seasons.slice(-3);
    const training = all.filter((m) => m.season && trainSeasons.includes(m.season));
    const display = all.filter((m) => m.season === latest);
    return { training, display, seasonCode: latest };
  }

  const seasons = seasonCodes(now());
  const perSeason = await Promise.all(seasons.map((s) => loadMatches(code, [s])));
  const training = perSeason.flat();
  let idx = perSeason.findIndex((ms) => ms.length >= 30);
  if (idx === -1) idx = perSeason.findIndex((ms) => ms.length > 0);
  const display = idx >= 0 ? perSeason[idx] : [];
  const seasonCode = seasons[idx >= 0 ? idx : 0];
  return { training, display, seasonCode };
}

export async function getFittedModel(code: string): Promise<FittedModel | null> {
  const hit = fittedCache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const { training } = await loadLeagueMatches(code);
  if (training.length === 0) return null;
  const value = fitModel(training, now());
  fittedCache.set(code, { at: Date.now(), value });
  return value;
}

export async function getLeagueModel(code: string): Promise<LeagueModel | null> {
  const hit = modelCache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const cfg = LEAGUE_BY_CODE.get(code);
  if (!cfg) return null;

  const { training, display, seasonCode } = await loadLeagueMatches(code);
  if (training.length === 0) return null;

  const fitted = fitModel(training, now());
  fittedCache.set(code, { at: Date.now(), value: fitted });

  const elo = await getElo().catch(() => new Map<string, EloRating>());
  const table = buildTable(display, fitted, elo);

  const value: LeagueModel = {
    code,
    name: cfg.name,
    country: cfg.country,
    season: seasonLabel(seasonCode),
    table,
    strengths: fitted.strengths,
    baseline: { homeAvg: fitted.homeAvg, awayAvg: fitted.awayAvg },
    matches: display,
    updatedAt: new Date().toISOString(),
  };
  modelCache.set(code, { at: Date.now(), value });
  return value;
}

/** Compute a betting-oriented league table from one season's matches. */
export function buildTable(
  matches: Match[],
  model: FittedModel,
  elo?: Map<string, EloRating>,
): TableRow[] {
  interface Agg {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    over25: number;
    btts: number;
    cleanSheets: number;
    failedToScore: number;
    homePts: number;
    awayPts: number;
    homeGf: number;
    homeGa: number;
    homeGames: number;
    awayGf: number;
    awayGa: number;
    awayGames: number;
    sotFor: number;
    sotAgainst: number;
    results: { date: Date; r: FormResult }[];
  }
  const conv = sotConversion(matches);
  const map = new Map<string, Agg>();
  const get = (t: string): Agg => {
    let a = map.get(t);
    if (!a) {
      a = {
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, over25: 0, btts: 0,
        cleanSheets: 0, failedToScore: 0, homePts: 0, awayPts: 0, homeGf: 0,
        homeGa: 0, homeGames: 0, awayGf: 0, awayGa: 0, awayGames: 0,
        sotFor: 0, sotAgainst: 0, results: [],
      };
      map.set(t, a);
    }
    return a;
  };

  for (const m of matches) {
    const h = get(m.homeTeam);
    const a = get(m.awayTeam);
    const totalGoals = m.fthg + m.ftag;
    const btts = m.fthg > 0 && m.ftag > 0;

    h.played++; a.played++;
    h.gf += m.fthg; h.ga += m.ftag;
    a.gf += m.ftag; a.ga += m.fthg;
    h.homeGf += m.fthg; h.homeGa += m.ftag; h.homeGames++;
    a.awayGf += m.ftag; a.awayGa += m.fthg; a.awayGames++;
    if (m.hst !== undefined && m.ast !== undefined) {
      h.sotFor += m.hst; h.sotAgainst += m.ast;
      a.sotFor += m.ast; a.sotAgainst += m.hst;
    }

    if (totalGoals > 2.5) { h.over25++; a.over25++; }
    if (btts) { h.btts++; a.btts++; }
    if (m.ftag === 0) h.cleanSheets++;
    if (m.fthg === 0) a.cleanSheets++;
    if (m.fthg === 0) h.failedToScore++;
    if (m.ftag === 0) a.failedToScore++;

    if (m.ftr === "H") {
      h.won++; a.lost++; h.homePts += 3;
      h.results.push({ date: m.date, r: "W" });
      a.results.push({ date: m.date, r: "L" });
    } else if (m.ftr === "A") {
      a.won++; h.lost++; a.awayPts += 3;
      h.results.push({ date: m.date, r: "L" });
      a.results.push({ date: m.date, r: "W" });
    } else {
      h.drawn++; a.drawn++; h.homePts += 1; a.awayPts += 1;
      h.results.push({ date: m.date, r: "D" });
      a.results.push({ date: m.date, r: "D" });
    }
  }

  const rows: TableRow[] = [];
  for (const [team, a] of map) {
    const points = a.won * 3 + a.drawn;
    const strength = model.strengths.get(team);
    const form = a.results
      .sort((x, y) => y.date.getTime() - x.date.getTime())
      .slice(0, 6)
      .map((r) => r.r);
    rows.push({
      team,
      played: a.played,
      won: a.won,
      drawn: a.drawn,
      lost: a.lost,
      gf: a.gf,
      ga: a.ga,
      gd: a.gf - a.ga,
      points,
      scoredPerGame: safeDiv(a.gf, a.played),
      concededPerGame: safeDiv(a.ga, a.played),
      over25Pct: safeDiv(a.over25, a.played),
      bttsPct: safeDiv(a.btts, a.played),
      cleanSheetPct: safeDiv(a.cleanSheets, a.played),
      failedToScorePct: safeDiv(a.failedToScore, a.played),
      form,
      homePts: a.homePts,
      awayPts: a.awayPts,
      homeGfPg: safeDiv(a.homeGf, a.homeGames),
      homeGaPg: safeDiv(a.homeGa, a.homeGames),
      awayGfPg: safeDiv(a.awayGf, a.awayGames),
      awayGaPg: safeDiv(a.awayGa, a.awayGames),
      attack: strength?.attack ?? 1,
      defense: strength?.defense ?? 1,
      xgfPg: conv !== null && a.played > 0 ? (a.sotFor * conv) / a.played : undefined,
      xgaPg: conv !== null && a.played > 0 ? (a.sotAgainst * conv) / a.played : undefined,
      elo: elo?.get(normaliseClub(team))?.elo,
    });
  }

  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  return rows;
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/** Predict a single fixture and detect value against its market odds. */
export function predictFixture(
  model: FittedModel,
  fixture: Fixture,
  elo?: Map<string, EloRating>,
): Prediction {
  const { lambda, mu } = expectedGoals(model, fixture.homeTeam, fixture.awayTeam);
  const mp = marketProbs(lambda, mu);

  const pred: Prediction = {
    fixture,
    pHome: mp.pHome,
    pDraw: mp.pDraw,
    pAway: mp.pAway,
    pOver25: mp.pOver25,
    pUnder25: mp.pUnder25,
    pBttsYes: mp.pBttsYes,
    pBttsNo: mp.pBttsNo,
    expHomeGoals: mp.expHomeGoals,
    expAwayGoals: mp.expAwayGoals,
    topScores: mp.topScores,
  };

  // Elo second opinion.
  if (elo) {
    const eh = elo.get(normaliseClub(fixture.homeTeam))?.elo;
    const ea = elo.get(normaliseClub(fixture.awayTeam))?.elo;
    if (eh !== undefined && ea !== undefined) {
      const ep = eloProbs(eh, ea);
      pred.elo = { ...ep, homeElo: eh, awayElo: ea };
      pred.consensus = isConsensus(mp, ep);
    }
  }

  const signals: ValueSignal[] = [];

  if (fixture.oddsH && fixture.oddsD && fixture.oddsA) {
    const dv = deVig([fixture.oddsH, fixture.oddsD, fixture.oddsA]);
    pred.market = { pHome: dv.probs[0], pDraw: dv.probs[1], pAway: dv.probs[2], overround: dv.overround };
    addSignal(signals, "Home", fixture.oddsH, mp.pHome, dv.probs[0]);
    addSignal(signals, "Draw", fixture.oddsD, mp.pDraw, dv.probs[1]);
    addSignal(signals, "Away", fixture.oddsA, mp.pAway, dv.probs[2]);
  }

  if (fixture.over25 && fixture.under25) {
    const dv = deVig([fixture.over25, fixture.under25]);
    pred.marketOU = { pOver25: dv.probs[0], pUnder25: dv.probs[1], overround: dv.overround };
    addSignal(signals, "Over 2.5", fixture.over25, mp.pOver25, dv.probs[0]);
    addSignal(signals, "Under 2.5", fixture.under25, mp.pUnder25, dv.probs[1]);
  }

  signals.sort((a, b) => b.ev - a.ev);
  if (signals.length) pred.value = signals;
  return pred;
}

function addSignal(
  out: ValueSignal[],
  market: string,
  odds: number,
  modelProb: number,
  marketProb: number,
) {
  const ev = expectedValue(modelProb, odds);
  if (ev >= MIN_EV) {
    out.push({ market, odds, modelProb, marketProb, edge: modelProb - marketProb, ev });
  }
}

export interface LeaguePredictions {
  code: string;
  name: string;
  predictions: Prediction[];
}

/**
 * Load upcoming fixtures and predict every one for which we have a fitted model.
 * Fixtures in leagues we do not model are skipped (no reliable probabilities).
 */
export async function getUpcomingPredictions(daysAhead = 10): Promise<LeaguePredictions[]> {
  const fixtures = await loadFixtures();
  const cutoff = now().getTime() + daysAhead * 86_400_000;
  const start = now().getTime() - 12 * 3600 * 1000; // include today
  const byLeague = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    if (!LEAGUE_BY_CODE.has(f.div)) continue;
    const t = f.date.getTime();
    if (t < start || t > cutoff) continue;
    const arr = byLeague.get(f.div) ?? [];
    arr.push(f);
    byLeague.set(f.div, arr);
  }

  const elo = await getElo().catch(() => new Map<string, EloRating>());
  const useApiFootball = hasApiFootballKey();

  const out: LeaguePredictions[] = [];
  for (const cfg of LEAGUES) {
    const model = await getFittedModel(cfg.code);
    if (!model) continue;

    let fx = byLeague.get(cfg.code) ?? [];

    // With an API-Football key, add its fixtures+odds (covers leagues the free
    // feed omits, e.g. Romania). Team names are matched to our model's names.
    if (useApiFootball) {
      const afNames = [...model.strengths.keys()];
      const af = await loadApiFootballFixtures(cfg.code, now(), daysAhead).catch(() => [] as Fixture[]);
      const matched: Fixture[] = [];
      for (const f of af) {
        const t = f.date.getTime();
        if (t < start || t > cutoff) continue;
        const home = matchTeamName(f.homeTeam, afNames);
        const away = matchTeamName(f.awayTeam, afNames);
        if (!home || !away) continue;
        matched.push({ ...f, homeTeam: home, awayTeam: away });
      }
      fx = dedupeFixtures([...fx, ...matched]);
    }

    if (fx.length === 0) continue;
    const predictions = fx.map((f) => predictFixture(model, f, elo));
    out.push({ code: cfg.code, name: cfg.name, predictions });
  }
  return out;
}

/** Best-effort match of an external team name to one of our model's names. */
function matchTeamName(external: string, ours: string[]): string | null {
  const n = normaliseClub(external);
  if (!n) return null;
  let hit = ours.find((o) => normaliseClub(o) === n);
  if (hit) return hit;
  hit = ours.find((o) => {
    const on = normaliseClub(o);
    return on.length >= 4 && n.length >= 4 && (on.includes(n) || n.includes(on));
  });
  return hit ?? null;
}

function dedupeFixtures(fx: Fixture[]): Fixture[] {
  const seen = new Set<string>();
  const out: Fixture[] = [];
  for (const f of fx) {
    const day = f.date.toISOString().slice(0, 10);
    const key = `${day}|${f.homeTeam}|${f.awayTeam}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Upcoming predictions WITHOUT odds, from ClubElo's fixtures feed. Covers
 * in-season leagues (e.g. Romania) that Football-Data's odds feed omits, so
 * they show a prediction — but no value flag (we have no price to compare).
 * ------------------------------------------------------------------ */

export interface EloUpcoming {
  date: string;
  home: string;
  away: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pBttsYes: number;
}

export interface EloUpcomingLeague {
  code: string;
  name: string;
  fixtures: EloUpcoming[];
}

// ClubElo's fixtures feed uses some country codes that differ from its ratings.
const ELO_COUNTRY_ALIAS: Record<string, string> = { ROM: "ROU" };

export async function getEloUpcoming(daysAhead = 12): Promise<EloUpcomingLeague[]> {
  // Map ClubElo country -> our (top) league for that country.
  const countryToLeague = new Map<string, string>();
  for (const l of LEAGUES) {
    if (l.eloCountry && !countryToLeague.has(l.eloCountry)) countryToLeague.set(l.eloCountry, l.code);
  }

  const fixtures = await loadEloFixtures().catch(() => []);
  const start = now().getTime() - 12 * 3600 * 1000;
  const cutoff = now().getTime() + daysAhead * 86_400_000;

  const byLeague = new Map<string, EloUpcoming[]>();
  for (const f of fixtures) {
    const code = countryToLeague.get(ELO_COUNTRY_ALIAS[f.country] ?? f.country);
    if (!code) continue; // not one of our leagues (also excludes European cups)
    const t = Date.parse(`${f.date}T12:00:00Z`);
    if (Number.isNaN(t) || t < start || t > cutoff) continue;
    const arr = byLeague.get(code) ?? [];
    arr.push({
      date: f.date, home: f.home, away: f.away,
      pHome: f.pHome, pDraw: f.pDraw, pAway: f.pAway,
      pOver25: f.pOver25, pBttsYes: f.pBttsYes,
    });
    byLeague.set(code, arr);
  }

  const out: EloUpcomingLeague[] = [];
  for (const cfg of LEAGUES) {
    const fx = byLeague.get(cfg.code);
    if (!fx || fx.length === 0) continue;
    fx.sort((a, b) => a.date.localeCompare(b.date));
    out.push({ code: cfg.code, name: cfg.name, fixtures: fx });
  }
  return out;
}

/**
 * Confident picks from the prediction-only fixtures (no odds needed). Surfaces
 * the model's strongest calls — the "Over 1.5 = 80%" style signal a human can
 * act on even before odds exist. Ranked by confidence.
 */
export interface SuggestedPick {
  code: string;
  league: string;
  date: string;
  home: string;
  away: string;
  market: string;
  prob: number;
}

export async function getSuggestedPicks(): Promise<SuggestedPick[]> {
  const leagues = await getEloUpcoming(12);
  const picks: SuggestedPick[] = [];
  for (const lg of leagues) {
    for (const f of lg.fixtures) {
      const base = { code: lg.code, league: lg.name, date: f.date, home: f.home, away: f.away };
      // strongest 1X2 side
      const sides: [string, number][] = [
        [`${f.home} win`, f.pHome],
        ["Draw", f.pDraw],
        [`${f.away} win`, f.pAway],
      ];
      sides.sort((a, b) => b[1] - a[1]);
      if (sides[0][1] >= 0.55) picks.push({ ...base, market: sides[0][0], prob: sides[0][1] });
      // goals
      if (f.pOver25 >= 0.58) picks.push({ ...base, market: "Over 2.5 goals", prob: f.pOver25 });
      else if (1 - f.pOver25 >= 0.6) picks.push({ ...base, market: "Under 2.5 goals", prob: 1 - f.pOver25 });
      // btts
      if (f.pBttsYes >= 0.6) picks.push({ ...base, market: "Both teams score", prob: f.pBttsYes });
      else if (1 - f.pBttsYes >= 0.6) picks.push({ ...base, market: "No — a team fails to score", prob: 1 - f.pBttsYes });
    }
  }
  picks.sort((a, b) => b.prob - a.prob);
  return picks;
}

/** Flatten all detected value signals across leagues, ranked by EV. */
export interface RankedValue {
  league: string;
  code: string;
  prediction: Prediction;
  signal: ValueSignal;
}

export async function getTopValueBets(daysAhead = 10): Promise<RankedValue[]> {
  const leagues = await getUpcomingPredictions(daysAhead);
  const all: RankedValue[] = [];
  for (const lg of leagues) {
    for (const p of lg.predictions) {
      if (!p.value) continue;
      for (const s of p.value) {
        all.push({ league: lg.name, code: lg.code, prediction: p, signal: s });
      }
    }
  }
  all.sort((a, b) => b.signal.ev - a.signal.ev);
  return all;
}

/* ------------------------------------------------------------------ *
 * Team profile: recent results and last-10 home / away / overall splits
 * (the analyst's "last 10 home, last 10 away, last 10 overall") view.
 * ------------------------------------------------------------------ */

export interface TeamMatch {
  date: Date;
  opponent: string;
  venue: "H" | "A";
  gf: number;
  ga: number;
  result: FormResult;
  sotFor?: number;
  sotAgainst?: number;
}

export interface SplitStat {
  games: number;
  w: number;
  d: number;
  l: number;
  ppg: number;
  gfPg: number;
  gaPg: number;
  over25Pct: number;
  bttsPct: number;
  csPct: number;
  xgfPg?: number;
  xgaPg?: number;
}

export interface TeamProfile {
  team: string;
  code: string;
  leagueName: string;
  season: string;
  elo?: number;
  attack: number;
  defense: number;
  recent: TeamMatch[]; // most recent first
  overall: SplitStat;
  home: SplitStat;
  away: SplitStat;
}

function splitFrom(matches: TeamMatch[], conv: number | null): SplitStat {
  const n = matches.length;
  if (n === 0) {
    return { games: 0, w: 0, d: 0, l: 0, ppg: 0, gfPg: 0, gaPg: 0, over25Pct: 0, bttsPct: 0, csPct: 0 };
  }
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, over = 0, btts = 0, cs = 0, sf = 0, sa = 0, sotGames = 0;
  for (const m of matches) {
    if (m.result === "W") w++;
    else if (m.result === "D") d++;
    else l++;
    gf += m.gf;
    ga += m.ga;
    if (m.gf + m.ga > 2.5) over++;
    if (m.gf > 0 && m.ga > 0) btts++;
    if (m.ga === 0) cs++;
    if (m.sotFor !== undefined && m.sotAgainst !== undefined) {
      sf += m.sotFor;
      sa += m.sotAgainst;
      sotGames++;
    }
  }
  return {
    games: n,
    w, d, l,
    ppg: (w * 3 + d) / n,
    gfPg: gf / n,
    gaPg: ga / n,
    over25Pct: over / n,
    bttsPct: btts / n,
    csPct: cs / n,
    xgfPg: conv !== null && sotGames > 0 ? (sf * conv) / sotGames : undefined,
    xgaPg: conv !== null && sotGames > 0 ? (sa * conv) / sotGames : undefined,
  };
}

export async function getTeamProfile(code: string, team: string): Promise<TeamProfile | null> {
  const cfg = LEAGUE_BY_CODE.get(code);
  if (!cfg) return null;
  const { display, seasonCode } = await loadLeagueMatches(code);
  const conv = sotConversion(display);

  const tms: TeamMatch[] = [];
  for (const m of display) {
    if (m.homeTeam === team) {
      tms.push({
        date: m.date, opponent: m.awayTeam, venue: "H", gf: m.fthg, ga: m.ftag,
        result: m.ftr === "H" ? "W" : m.ftr === "A" ? "L" : "D",
        sotFor: m.hst, sotAgainst: m.ast,
      });
    } else if (m.awayTeam === team) {
      tms.push({
        date: m.date, opponent: m.homeTeam, venue: "A", gf: m.ftag, ga: m.fthg,
        result: m.ftr === "A" ? "W" : m.ftr === "H" ? "L" : "D",
        sotFor: m.ast, sotAgainst: m.hst,
      });
    }
  }
  if (tms.length === 0) return null;
  tms.sort((a, b) => b.date.getTime() - a.date.getTime());

  const fitted = await getFittedModel(code);
  const strength = fitted?.strengths.get(team);
  const elo = (await getElo().catch(() => new Map<string, EloRating>())).get(normaliseClub(team))?.elo;

  const last = (n: number, arr: TeamMatch[]) => arr.slice(0, n);
  const homeMatches = tms.filter((m) => m.venue === "H");
  const awayMatches = tms.filter((m) => m.venue === "A");

  return {
    team,
    code,
    leagueName: cfg.name,
    season: seasonLabel(seasonCode),
    elo,
    attack: strength?.attack ?? 1,
    defense: strength?.defense ?? 1,
    recent: last(10, tms),
    overall: splitFrom(last(10, tms), conv),
    home: splitFrom(last(10, homeMatches), conv),
    away: splitFrom(last(10, awayMatches), conv),
  };
}

/* ------------------------------------------------------------------ *
 * Backtest: grade the model's value flags on recent finished matches,
 * against the closing odds actually offered — a lookahead-free holdout.
 * ------------------------------------------------------------------ */

export interface GradedBet {
  date: Date;
  home: string;
  away: string;
  market: string;
  odds: number;
  modelProb: number;
  ev: number;
  won: boolean;
  profit: number; // per 1 unit staked
}

export interface Backtest {
  code: string;
  name: string;
  season: string;
  testedMatches: number;
  bets: GradedBet[];
  staked: number;
  profit: number;
  roi: number;
  hitRate: number;
  brierModel: number; // 1X2 calibration (lower is better)
  brierMarket: number;
}

function outcomeHit(market: string, m: Match): boolean {
  const total = m.fthg + m.ftag;
  switch (market) {
    case "Home": return m.ftr === "H";
    case "Draw": return m.ftr === "D";
    case "Away": return m.ftr === "A";
    case "Over 2.5": return total > 2.5;
    case "Under 2.5": return total < 2.5;
    default: return false;
  }
}

export async function getBacktest(code: string, testFraction = 0.3): Promise<Backtest | null> {
  const cfg = LEAGUE_BY_CODE.get(code);
  if (!cfg) return null;
  const { display, seasonCode } = await loadLeagueMatches(code);
  const withOdds = display.filter((m) => m.oddsH && m.oddsD && m.oddsA);
  if (withOdds.length < 60) return null; // not enough to hold out meaningfully

  const sorted = [...withOdds].sort((a, b) => a.date.getTime() - b.date.getTime());
  const splitIdx = Math.floor(sorted.length * (1 - testFraction));
  const train = sorted.slice(0, splitIdx);
  const test = sorted.slice(splitIdx);
  if (train.length < 40 || test.length < 10) return null;

  // Fit strengths on the training slice only (ref = first test date -> no lookahead).
  const refDate = test[0].date;
  const model = fitModel(train, refDate);

  const bets: GradedBet[] = [];
  let staked = 0;
  let profit = 0;
  let brierModel = 0;
  let brierMarket = 0;

  for (const m of test) {
    const pred = predictFixture(model, matchToFixture(m));
    // 1X2 calibration (model vs de-vigged market).
    const actual = { H: m.ftr === "H" ? 1 : 0, D: m.ftr === "D" ? 1 : 0, A: m.ftr === "A" ? 1 : 0 };
    brierModel += sq(pred.pHome - actual.H) + sq(pred.pDraw - actual.D) + sq(pred.pAway - actual.A);
    if (pred.market) {
      brierMarket +=
        sq(pred.market.pHome - actual.H) + sq(pred.market.pDraw - actual.D) + sq(pred.market.pAway - actual.A);
    }
    // Grade every value flag at the closing odds.
    for (const s of pred.value ?? []) {
      const won = outcomeHit(s.market, m);
      const p = won ? s.odds - 1 : -1;
      staked += 1;
      profit += p;
      bets.push({
        date: m.date, home: m.homeTeam, away: m.awayTeam, market: s.market,
        odds: s.odds, modelProb: s.modelProb, ev: s.ev, won, profit: p,
      });
    }
  }

  bets.sort((a, b) => b.date.getTime() - a.date.getTime());
  return {
    code,
    name: cfg.name,
    season: seasonLabel(seasonCode),
    testedMatches: test.length,
    bets,
    staked,
    profit,
    roi: staked > 0 ? profit / staked : 0,
    hitRate: bets.length > 0 ? bets.filter((b) => b.won).length / bets.length : 0,
    brierModel: brierModel / test.length,
    brierMarket: brierMarket / test.length,
  };
}

function matchToFixture(m: Match): Fixture {
  return {
    div: m.div,
    date: m.date,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    oddsH: m.oddsH,
    oddsD: m.oddsD,
    oddsA: m.oddsA,
    over25: m.over25,
    under25: m.under25,
  };
}

function sq(x: number): number {
  return x * x;
}

export async function getAllBacktests(): Promise<Backtest[]> {
  const results = await Promise.all(LEAGUES.map((l) => getBacktest(l.code).catch(() => null)));
  return results.filter((b): b is Backtest => b !== null);
}

/* ------------------------------------------------------------------ *
 * Replay / Paper-Bet mode: past fixtures shown with the result hidden.
 * A human reads the pre-match picture, places a paper bet, then reveals
 * what actually happened. Everything is precomputed for the static site.
 * ------------------------------------------------------------------ */

function buildTeamMatches(matches: Match[], team: string): TeamMatch[] {
  const tms: TeamMatch[] = [];
  for (const m of matches) {
    if (m.homeTeam === team) {
      tms.push({
        date: m.date, opponent: m.awayTeam, venue: "H", gf: m.fthg, ga: m.ftag,
        result: m.ftr === "H" ? "W" : m.ftr === "A" ? "L" : "D",
        sotFor: m.hst, sotAgainst: m.ast,
      });
    } else if (m.awayTeam === team) {
      tms.push({
        date: m.date, opponent: m.homeTeam, venue: "A", gf: m.ftag, ga: m.fthg,
        result: m.ftr === "A" ? "W" : m.ftr === "H" ? "L" : "D",
        sotFor: m.ast, sotAgainst: m.hst,
      });
    }
  }
  tms.sort((a, b) => b.date.getTime() - a.date.getTime());
  return tms;
}

export interface ReplayFixture {
  id: string;
  code: string;
  league: string;
  date: string; // ISO
  home: string;
  away: string;
  homeOverall: SplitStat;
  homeHome: SplitStat;
  awayOverall: SplitStat;
  awayAway: SplitStat;
  model: { pHome: number; pDraw: number; pAway: number; pOver25: number; pBttsYes: number };
  odds: { h?: number; d?: number; a?: number; over25?: number; under25?: number };
  result: { fthg: number; ftag: number; ftr: Result; over25: boolean; btts: boolean };
}

/**
 * Precompute a pool of recent past fixtures for the Replay game. For each league
 * we hold out the last `perLeague` priced matches, fit the model on the earlier
 * games only, and capture each match's pre-match splits, model probs, the odds
 * offered, and the (hidden) result.
 */
export async function getReplayFixtures(perLeague = 12): Promise<ReplayFixture[]> {
  const out: ReplayFixture[] = [];
  for (const cfg of LEAGUES) {
    const { display } = await loadLeagueMatches(cfg.code);
    const conv = sotConversion(display);
    const priced = display
      .filter((m) => m.oddsH && m.oddsD && m.oddsA)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (priced.length < 60) continue;

    const windowStart = priced.length - perLeague;
    const train = priced.slice(0, windowStart);
    const model = fitModel(train, priced[windowStart].date);

    for (const m of priced.slice(windowStart)) {
      const before = display.filter((x) => x.date.getTime() < m.date.getTime());
      const homeTMs = buildTeamMatches(before, m.homeTeam);
      const awayTMs = buildTeamMatches(before, m.awayTeam);
      if (homeTMs.length < 4 || awayTMs.length < 4) continue;

      const pred = predictFixture(model, matchToFixture(m));
      out.push({
        id: `${cfg.code}-${m.date.getTime()}-${m.homeTeam}`.replace(/\s+/g, "_"),
        code: cfg.code,
        league: cfg.name,
        date: m.date.toISOString(),
        home: m.homeTeam,
        away: m.awayTeam,
        homeOverall: splitFrom(homeTMs.slice(0, 10), conv),
        homeHome: splitFrom(homeTMs.filter((t) => t.venue === "H").slice(0, 10), conv),
        awayOverall: splitFrom(awayTMs.slice(0, 10), conv),
        awayAway: splitFrom(awayTMs.filter((t) => t.venue === "A").slice(0, 10), conv),
        model: {
          pHome: pred.pHome, pDraw: pred.pDraw, pAway: pred.pAway,
          pOver25: pred.pOver25, pBttsYes: pred.pBttsYes,
        },
        odds: {
          h: m.oddsH, d: m.oddsD, a: m.oddsA, over25: m.over25, under25: m.under25,
        },
        result: {
          fthg: m.fthg, ftag: m.ftag, ftr: m.ftr,
          over25: m.fthg + m.ftag > 2.5, btts: m.fthg > 0 && m.ftag > 0,
        },
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Match Analysis: per-team goals / corners / cards rates baked for the
 * client so the browser can compute every market for any chosen pairing.
 * ------------------------------------------------------------------ */

export interface AnalysisTeam {
  name: string;
  slug: string;
  attack: number; // goal strength (fitted)
  defense: number;
  cfH: number; caH: number; cfA: number; caA: number; // corners for/against, home/away per game
  kfH: number; kaH: number; kfA: number; kaA: number; // cards for/against, home/away per game
}

export interface AnalysisLeague {
  code: string;
  name: string;
  season: string;
  homeAvg: number; // goals
  awayAvg: number;
  cornerHomeAvg: number;
  cornerAwayAvg: number;
  cardHomeAvg: number;
  cardAwayAvg: number;
  halfGoalShare: number; // fraction of goals scored in the 1st half
  hasCorners: boolean;
  hasCards: boolean;
  teams: AnalysisTeam[];
}

export async function getAnalysisData(): Promise<AnalysisLeague[]> {
  const out: AnalysisLeague[] = [];
  for (const cfg of LEAGUES) {
    const { display, seasonCode } = await loadLeagueMatches(cfg.code);
    if (display.length < 30) continue;
    const fitted = await getFittedModel(cfg.code);
    if (!fitted) continue;

    interface Acc {
      cfH: number; caH: number; gH: number;
      cfA: number; caA: number; gA: number;
      kfH: number; kaH: number; kfA: number; kaA: number;
    }
    const acc = new Map<string, Acc>();
    const get = (t: string): Acc => {
      let a = acc.get(t);
      if (!a) { a = { cfH: 0, caH: 0, gH: 0, cfA: 0, caA: 0, gA: 0, kfH: 0, kaH: 0, kfA: 0, kaA: 0 }; acc.set(t, a); }
      return a;
    };

    let cornerHome = 0, cornerAway = 0, cornerGames = 0;
    let cardHome = 0, cardAway = 0, cardGames = 0;
    let htGoals = 0, ftGoals = 0, htGames = 0;

    for (const m of display) {
      const h = get(m.homeTeam);
      const a = get(m.awayTeam);
      if (m.hc !== undefined && m.ac !== undefined) {
        h.cfH += m.hc; h.caH += m.ac; h.gH += 1;
        a.cfA += m.ac; a.caA += m.hc; a.gA += 1;
        cornerHome += m.hc; cornerAway += m.ac; cornerGames += 1;
      }
      const hCards = (m.hy ?? 0) + (m.hr ?? 0);
      const aCards = (m.ay ?? 0) + (m.ar ?? 0);
      if (m.hy !== undefined && m.ay !== undefined) {
        h.kfH += hCards; h.kaH += aCards;
        a.kfA += aCards; a.kaA += hCards;
        cardHome += hCards; cardAway += aCards; cardGames += 1;
      }
      if (m.hthg !== undefined && m.htag !== undefined) {
        htGoals += m.hthg + m.htag;
        ftGoals += m.fthg + m.ftag;
        htGames += 1;
      }
    }

    // per-team venue game counts for averaging (home games = times team was home)
    const homeGames = new Map<string, number>();
    const awayGames = new Map<string, number>();
    for (const m of display) {
      homeGames.set(m.homeTeam, (homeGames.get(m.homeTeam) ?? 0) + 1);
      awayGames.set(m.awayTeam, (awayGames.get(m.awayTeam) ?? 0) + 1);
    }

    const teams: AnalysisTeam[] = [];
    for (const [name, a] of acc) {
      const st = fitted.strengths.get(name);
      const hg = a.gH || 1;
      const ag = a.gA || 1;
      const hgc = homeGames.get(name) || 1;
      const agc = awayGames.get(name) || 1;
      teams.push({
        name,
        slug: slugifyName(name),
        attack: st?.attack ?? 1,
        defense: st?.defense ?? 1,
        cfH: a.cfH / hg, caH: a.caH / hg, cfA: a.cfA / ag, caA: a.caA / ag,
        kfH: a.kfH / hgc, kaH: a.kaH / hgc, kfA: a.kfA / agc, kaA: a.kaA / agc,
      });
    }
    teams.sort((x, y) => x.name.localeCompare(y.name));

    out.push({
      code: cfg.code,
      name: cfg.name,
      season: seasonLabel(seasonCode),
      homeAvg: fitted.homeAvg,
      awayAvg: fitted.awayAvg,
      cornerHomeAvg: cornerGames ? cornerHome / cornerGames : 0,
      cornerAwayAvg: cornerGames ? cornerAway / cornerGames : 0,
      cardHomeAvg: cardGames ? cardHome / cardGames : 0,
      cardAwayAvg: cardGames ? cardAway / cardGames : 0,
      halfGoalShare: ftGoals > 0 ? htGoals / ftGoals : 0.45,
      hasCorners: cornerGames > 20,
      hasCards: cardGames > 20,
      teams,
    });
  }
  return out;
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** All team names in a league's current display season (for static params). */
export async function getLeagueTeams(code: string): Promise<string[]> {
  const model = await getLeagueModel(code);
  return model ? model.table.map((r) => r.team) : [];
}

export function resetCaches() {
  modelCache.clear();
  fittedCache = new Map();
  eloCache = null;
}
