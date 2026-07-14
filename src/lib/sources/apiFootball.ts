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
