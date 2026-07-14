import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueTeams, getTeamProfile, SplitStat, TeamMatch } from "@/lib/model/build";
import { hasApiFootballKey, Injury, loadTeamInjuries } from "@/lib/sources/apiFootball";
import { LEAGUES, LEAGUE_BY_CODE } from "@/lib/leagues";
import { Card, SectionTitle } from "@/components/ui";
import { LeagueBadge } from "@/components/LeagueBadge";
import { StrengthBar } from "@/components/viz";
import { fmtDate, one } from "@/lib/format";
import { pct } from "@/lib/model/odds";
import { slugify } from "@/lib/slug";

export async function generateStaticParams() {
  const out: { code: string; team: string }[] = [];
  for (const l of LEAGUES) {
    const teams = await getLeagueTeams(l.code);
    for (const t of teams) out.push({ code: l.code, team: slugify(t) });
  }
  return out;
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string; team: string }>;
}) {
  const { code, team: slug } = await params;
  const cfg = LEAGUE_BY_CODE.get(code);
  if (!cfg) notFound();
  const teams = await getLeagueTeams(code);
  const team = teams.find((t) => slugify(t) === slug) ?? decodeURIComponent(slug);

  const profile = await getTeamProfile(code, team);
  const injuries = await loadTeamInjuries(code, team).catch(() => [] as Injury[]);
  if (!profile) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium">No data for {team}</p>
        <Link href={`/leagues/${code}`} className="mt-2 inline-block text-xs text-brand hover:underline">
          ← Back to {cfg.name}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <LeagueBadge code={code} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold leading-none">{profile.team}</h1>
          <p className="mt-1 text-sm text-muted">
            {profile.leagueName} · {profile.season}
            {profile.elo ? ` · Elo ${Math.round(profile.elo)}` : ""}
          </p>
        </div>
        <Link href={`/leagues/${code}`} className="ml-auto text-xs text-brand hover:underline">
          ← {cfg.name}
        </Link>
      </div>

      {/* strengths */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="tracked text-muted">Attack strength</span>
            <span className="tabnum text-ink-2">{profile.attack.toFixed(2)}</span>
          </div>
          <StrengthBar value={profile.attack} kind="attack" />
          <p className="mt-2 text-xs text-muted">Model scoring strength vs the league average (1.00).</p>
        </Card>
        <Card className="p-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="tracked text-muted">Defence (leakiness)</span>
            <span className="tabnum text-ink-2">{profile.defense.toFixed(2)}</span>
          </div>
          <StrengthBar value={profile.defense} kind="defense" />
          <p className="mt-2 text-xs text-muted">Above 1.00 concedes more than average; below is tighter.</p>
        </Card>
      </div>

      {/* last-10 splits */}
      <section>
        <SectionTitle
          title="LAST 10 · OVERALL / HOME / AWAY"
          hint="The analyst's split: recent form broken down by venue. Older games barely matter, so this is the sharpest read on current level."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <SplitCard title="Overall" stat={profile.overall} />
          <SplitCard title="Home" stat={profile.home} />
          <SplitCard title="Away" stat={profile.away} />
        </div>
      </section>

      {/* availability (optional, needs API-Football key) */}
      <section>
        <SectionTitle
          title="AVAILABILITY"
          hint="Injuries & suspensions. A team missing 2–3 key players is a different team."
        />
        {!hasApiFootballKey() ? (
          <Card className="p-4 text-xs text-muted">
            Not enabled. Add a free{" "}
            <span className="text-ink-2">API_FOOTBALL_KEY</span> to{" "}
            <span className="text-ink-2">.env.local</span> to show injuries and suspensions here.
          </Card>
        ) : injuries.length === 0 ? (
          <Card className="p-4 text-sm text-muted">No injuries or suspensions reported.</Card>
        ) : (
          <Card className="p-2">
            <ul className="divide-y divide-line">
              {injuries.map((inj, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{inj.player}</span>
                  <span className="text-xs text-muted">
                    {inj.reason || inj.type || "Unavailable"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* recent results */}
      <section>
        <SectionTitle title="RECENT RESULTS" hint="Most recent first." />
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Venue</th>
                <th className="px-3 py-2 font-medium">Opponent</th>
                <th className="px-2 py-2 text-center font-medium">Score</th>
                <th className="px-2 py-2 text-center font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {profile.recent.map((m, i) => (
                <ResultRow key={i} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SplitCard({ title, stat }: { title: string; stat: SplitStat }) {
  if (stat.games === 0) {
    return (
      <Card className="p-4">
        <div className="text-[11px] tracked text-muted">{title}</div>
        <p className="mt-3 text-sm text-muted">No games.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracked text-muted">{title}</span>
        <span className="tabnum text-[11px] text-ink-2">{stat.games} games</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabnum">
          {stat.w}-{stat.d}-{stat.l}
        </span>
        <span className="text-xs text-muted">{one(stat.ppg)} pts/game</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        <Row k="Goals for" v={one(stat.gfPg)} />
        <Row k="Goals against" v={one(stat.gaPg)} />
        {stat.xgfPg !== undefined && <Row k="xG for" v={one(stat.xgfPg)} accent />}
        {stat.xgaPg !== undefined && <Row k="xG against" v={one(stat.xgaPg)} />}
        <Row k="Over 2.5" v={pct(stat.over25Pct, 0)} />
        <Row k="BTTS" v={pct(stat.bttsPct, 0)} />
        <Row k="Clean sheets" v={pct(stat.csPct, 0)} />
      </dl>
    </Card>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={`tabnum ${accent ? "text-brand" : "text-ink-2"}`}>{v}</dd>
    </div>
  );
}

function ResultRow({ m }: { m: TeamMatch }) {
  const color =
    m.result === "W" ? "var(--color-good)" : m.result === "D" ? "var(--color-warn)" : "var(--color-crit)";
  const ink = m.result === "W" ? "#071a10" : m.result === "D" ? "#1a1204" : "#1a0605";
  return (
    <tr className="border-t border-line bg-surface">
      <td className="px-3 py-2 tabnum text-muted">{fmtDate(m.date)}</td>
      <td className="px-2 py-2 text-ink-2">{m.venue === "H" ? "Home" : "Away"}</td>
      <td className="px-3 py-2">{m.opponent}</td>
      <td className="px-2 py-2 text-center tabnum font-semibold">
        {m.gf}–{m.ga}
      </td>
      <td className="px-2 py-2 text-center">
        <span
          className="inline-grid h-[18px] w-[18px] place-items-center rounded text-[10px] font-bold"
          style={{ background: color, color: ink }}
        >
          {m.result}
        </span>
      </td>
    </tr>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ code: string; team: string }> }) {
  const { code, team: slug } = await params;
  const teams = await getLeagueTeams(code);
  const team = teams.find((t) => slugify(t) === slug) ?? slug;
  return { title: `${team} — Edge` };
}
