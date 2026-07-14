// API-Football (api-sports.io) — OPTIONAL injuries / suspensions feed.
// Requires a free key in API_FOOTBALL_KEY (free tier ~100 requests/day). The app
// works fully without it; when a key is present, team pages show who is
// unavailable. https://www.api-football.com/
//
// A team a bit off form is one thing; a team missing 2–3 key players is a
// different team — this surfaces that context. Name-matching between
// API-Football and Football-Data is best-effort (see normaliseClub).

import { fetchTextCached } from "@/lib/cache";
import { normaliseClub } from "@/lib/sources/clubElo";
import { Fixture } from "@/lib/types";

const BASE = "https://v3.football.api-sports.io";
const TTL = 6 * 60 * 60 * 1000; // 6h

// Football-Data code -> API-Football league id.
const LEAGUE_ID: Record<string, number> = {
  E0: 39, // Premier League
  SP1: 140, // La Liga
  D1: 78, // Bundesliga
  I1: 135, // Serie A
  F1: 61, // Ligue 1
  E1: 40, // Championship
  N1: 88, // Eredivisie
  P1: 94, // Primeira Liga
  B1: 144, // Jupiler Pro League
  SP2: 141, // Segunda División
  ROU: 283, // Liga I (Superliga)
};

export interface Injury {
  team: string;
  teamKey: string; // normalised for matching
  player: string;
  type: string; // e.g. "Missing Fixture", "Questionable"
  reason: string; // e.g. "Injury / Knee"
}

export function hasApiFootballKey(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

function apiFootballSeason(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Current injuries/suspensions for a league. Returns [] when no key is set, the
 * league is unmapped, or on any error — so callers never break.
 */
export async function loadInjuries(code: string, now = new Date()): Promise<Injury[]> {
  const key = process.env.API_FOOTBALL_KEY;
  const leagueId = LEAGUE_ID[code];
  if (!key || !leagueId) return [];

  const season = apiFootballSeason(now);
  const url = `${BASE}/injuries?league=${leagueId}&season=${season}`;
  let text: string;
  try {
    text = await fetchWithKey(url, key);
  } catch {
    return [];
  }

  let data: ApiFootballResponse;
  try {
    data = JSON.parse(text) as ApiFootballResponse;
  } catch {
    return [];
  }
  if (!Array.isArray(data.response)) return [];

  const seen = new Set<string>();
  const out: Injury[] = [];
  for (const item of data.response) {
    const team = item.team?.name;
    const player = item.player?.name;
    if (!team || !player) continue;
    const dedup = `${team}|${player}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push({
      team,
      teamKey: normaliseClub(team),
      player,
      type: item.player?.type ?? "",
      reason: item.player?.reason ?? "",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Upcoming fixtures WITH odds. This is what unlocks value bets for leagues
 * the free Football-Data feed omits (Romania, etc.). Key-gated; returns [] with
 * no key so the app is unaffected. Cached to respect the ~100 req/day free tier.
 * ------------------------------------------------------------------ */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface AFFixturesResponse {
  response?: {
    fixture?: { id?: number; date?: string };
    teams?: { home?: { name?: string }; away?: { name?: string } };
  }[];
}

interface AFOddsResponse {
  response?: {
    fixture?: { id?: number };
    bookmakers?: {
      bets?: { name?: string; values?: { value?: string; odd?: string }[] }[];
    }[];
  }[];
}

/**
 * Fixtures in the next `daysAhead` days for a league, each with averaged 1X2 and
 * Over/Under 2.5 odds where a bookmaker priced them. Team names are as
 * API-Football spells them (the caller matches them to our model).
 */
export async function loadApiFootballFixtures(code: string, now = new Date(), daysAhead = 12): Promise<Fixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  const leagueId = LEAGUE_ID[code];
  if (!key || !leagueId) return [];
  const season = apiFootballSeason(now);
  const from = isoDate(now);
  const to = isoDate(new Date(now.getTime() + daysAhead * 86_400_000));

  // 1) fixtures
  let fxJson: AFFixturesResponse;
  try {
    const t = await fetchWithKey(`${BASE}/fixtures?league=${leagueId}&season=${season}&from=${from}&to=${to}`, key);
    fxJson = JSON.parse(t) as AFFixturesResponse;
  } catch {
    return [];
  }
  const fixtures = new Map<number, { home: string; away: string; date: Date }>();
  for (const it of fxJson.response ?? []) {
    const id = it.fixture?.id;
    const home = it.teams?.home?.name;
    const away = it.teams?.away?.name;
    const date = it.fixture?.date ? new Date(it.fixture.date) : undefined;
    if (id && home && away && date) fixtures.set(id, { home, away, date });
  }
  if (fixtures.size === 0) return [];

  // 2) odds (paged; bounded to keep request count sane)
  const oddsByFixture = new Map<number, { h: number[]; d: number[]; a: number[]; o: number[]; u: number[] }>();
  for (let page = 1; page <= 5; page++) {
    let odJson: AFOddsResponse;
    try {
      const t = await fetchWithKey(`${BASE}/odds?league=${leagueId}&season=${season}&page=${page}`, key);
      odJson = JSON.parse(t) as AFOddsResponse;
    } catch {
      break;
    }
    const rows = odJson.response ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const fid = row.fixture?.id;
      if (!fid || !fixtures.has(fid)) continue;
      const acc = oddsByFixture.get(fid) ?? { h: [], d: [], a: [], o: [], u: [] };
      for (const bk of row.bookmakers ?? []) {
        for (const bet of bk.bets ?? []) {
          if (bet.name === "Match Winner") {
            for (const v of bet.values ?? []) {
              const odd = Number(v.odd);
              if (!Number.isFinite(odd)) continue;
              if (v.value === "Home") acc.h.push(odd);
              else if (v.value === "Draw") acc.d.push(odd);
              else if (v.value === "Away") acc.a.push(odd);
            }
          } else if (bet.name === "Goals Over/Under") {
            for (const v of bet.values ?? []) {
              const odd = Number(v.odd);
              if (!Number.isFinite(odd)) continue;
              if (v.value === "Over 2.5") acc.o.push(odd);
              else if (v.value === "Under 2.5") acc.u.push(odd);
            }
          }
        }
      }
      oddsByFixture.set(fid, acc);
    }
    if (rows.length < 10) break; // last page
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
  const out: Fixture[] = [];
  for (const [id, fx] of fixtures) {
    const o = oddsByFixture.get(id);
    out.push({
      div: code,
      date: fx.date,
      homeTeam: fx.home,
      awayTeam: fx.away,
      oddsH: o ? avg(o.h) : undefined,
      oddsD: o ? avg(o.d) : undefined,
      oddsA: o ? avg(o.a) : undefined,
      over25: o ? avg(o.o) : undefined,
      under25: o ? avg(o.u) : undefined,
    });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

/** Injuries for one team, matched by normalised name. */
export async function loadTeamInjuries(code: string, team: string, now = new Date()): Promise<Injury[]> {
  const all = await loadInjuries(code, now);
  const key = normaliseClub(team);
  return all.filter((i) => i.teamKey === key);
}

// api-sports.io wants the key in a header, so we cache by URL but fetch manually.
async function fetchWithKey(url: string, key: string): Promise<string> {
  // Encode the key into the cache identity without exposing it in the returned
  // text; fetchTextCached keys on the URL, so append a private query marker.
  return fetchTextCached(url, { ttlMs: TTL, headers: { "x-apisports-key": key } });
}

interface ApiFootballResponse {
  response?: {
    team?: { name?: string };
    player?: { name?: string; type?: string; reason?: string };
  }[];
}
