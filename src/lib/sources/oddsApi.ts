// The Odds API — OPTIONAL live multi-bookmaker odds (JSON). Requires a free key
// in THE_ODDS_API_KEY. The app works fully without it (Football-Data's
// fixtures.csv already supplies pre-match odds); this is for live/in-play or
// wider bookmaker coverage. Free tier is capped (~500 credits/month) so results
// are cached. https://the-odds-api.com/
//
// NOTE: wiring these odds into the value engine requires matching The Odds API
// team names to Football-Data names — tracked in docs/BACKLOG.md.

import { fetchTextCached } from "@/lib/cache";
import { deVig } from "@/lib/model/odds";

const BASE = "https://api.the-odds-api.com/v4";

// Sport keys for the leagues we model.
export const ODDS_SPORT_KEYS: Record<string, string> = {
  E0: "soccer_epl",
  SP1: "soccer_spain_la_liga",
  D1: "soccer_germany_bundesliga",
  I1: "soccer_italy_serie_a",
  F1: "soccer_france_ligue_one",
  E1: "soccer_england_efl_champ",
  N1: "soccer_netherlands_eredivisie",
  P1: "soccer_portugal_primeira_liga",
  B1: "soccer_belgium_first_div",
};

export interface LiveOdds {
  home: string;
  away: string;
  commence: string;
  bookmakerCount: number;
  oddsH: number;
  oddsD: number;
  oddsA: number;
  fairH: number;
  fairD: number;
  fairA: number;
}

export function hasOddsApiKey(): boolean {
  return Boolean(process.env.THE_ODDS_API_KEY);
}

/**
 * Fetch head-to-head (1X2) odds for a league. Averages each outcome across
 * bookmakers, then de-vigs. Returns [] if no key is configured or on error.
 */
export async function loadLiveOdds(leagueCode: string): Promise<LiveOdds[]> {
  const key = process.env.THE_ODDS_API_KEY;
  const sport = ODDS_SPORT_KEYS[leagueCode];
  if (!key || !sport) return [];

  const url =
    `${BASE}/sports/${sport}/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${key}`;
  let text: string;
  try {
    text = await fetchTextCached(url, { ttlMs: 30 * 60 * 1000 });
  } catch {
    return [];
  }

  let events: unknown;
  try {
    events = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(events)) return [];

  const out: LiveOdds[] = [];
  for (const ev of events as OddsEvent[]) {
    const parsed = parseEvent(ev);
    if (parsed) out.push(parsed);
  }
  return out;
}

interface OddsEvent {
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: {
    markets?: { key?: string; outcomes?: { name?: string; price?: number }[] }[];
  }[];
}

function parseEvent(ev: OddsEvent): LiveOdds | null {
  const home = ev.home_team;
  const away = ev.away_team;
  if (!home || !away || !Array.isArray(ev.bookmakers)) return null;

  const acc = { H: [] as number[], D: [] as number[], A: [] as number[] };
  for (const bk of ev.bookmakers) {
    const h2h = bk.markets?.find((m) => m.key === "h2h");
    if (!h2h?.outcomes) continue;
    for (const o of h2h.outcomes) {
      if (!o.name || !o.price) continue;
      if (o.name === home) acc.H.push(o.price);
      else if (o.name === away) acc.A.push(o.price);
      else acc.D.push(o.price);
    }
  }
  if (!acc.H.length || !acc.D.length || !acc.A.length) return null;

  const oddsH = avg(acc.H);
  const oddsD = avg(acc.D);
  const oddsA = avg(acc.A);
  const dv = deVig([oddsH, oddsD, oddsA]);
  return {
    home,
    away,
    commence: ev.commence_time ?? "",
    bookmakerCount: ev.bookmakers.length,
    oddsH, oddsD, oddsA,
    fairH: dv.probs[0], fairD: dv.probs[1], fairA: dv.probs[2],
  };
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
