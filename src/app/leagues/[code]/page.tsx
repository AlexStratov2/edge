import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueModel, getUpcomingPredictions } from "@/lib/model/build";
import { LEAGUE_BY_CODE, LEAGUES } from "@/lib/leagues";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { FormPips, StrengthBar } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PredictionCard } from "@/components/PredictionCard";
import { TableRow } from "@/lib/types";
import { one } from "@/lib/format";
import { slugify } from "@/lib/slug";

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ code: l.code }));
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cfg = LEAGUE_BY_CODE.get(code);
  if (!cfg) notFound();

  const model = await getLeagueModel(code);
  if (!model) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium">No data available for {cfg.name}</p>
        <p className="mt-1 text-sm text-muted">
          The season CSV could not be loaded. Try again shortly.
        </p>
      </Card>
    );
  }

  const leaguePreds = (await getUpcomingPredictions(14)).find((l) => l.code === code);

  const totalGoals = model.matches.reduce((s, m) => s + m.fthg + m.ftag, 0);
  const gpg = model.matches.length ? totalGoals / model.matches.length : 0;
  const over25 = model.matches.filter((m) => m.fthg + m.ftag > 2.5).length;
  const btts = model.matches.filter((m) => m.fthg > 0 && m.ftag > 0).length;
  const homeWins = model.matches.filter((m) => m.ftr === "H").length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <LeagueBadge code={cfg.code} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold leading-none">{cfg.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {cfg.country} · {model.season} · {model.matches.length} matches
          </p>
        </div>
        <Link href="/" className="ml-auto text-xs text-brand hover:underline">
          ← All leagues
        </Link>
      </div>

      {/* League-wide tendencies */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Goals / game" value={one(gpg)} accent="brand" />
        <StatTile
          label="Over 2.5"
          value={`${Math.round((over25 / Math.max(model.matches.length, 1)) * 100)}%`}
        />
        <StatTile
          label="Both teams score"
          value={`${Math.round((btts / Math.max(model.matches.length, 1)) * 100)}%`}
        />
        <StatTile
          label="Home wins"
          value={`${Math.round((homeWins / Math.max(model.matches.length, 1)) * 100)}%`}
          sub={`avg ${one(model.baseline.homeAvg)}–${one(model.baseline.awayAvg)} H–A`}
        />
      </div>

      {/* Standings + betting splits */}
      <section>
        <SectionTitle
          title="TABLE · STRENGTHS · HOW OFTEN IT HAPPENS"
          hint="Attack and Defence compare a team to the league average (1.00) — higher attack is better, lower defence means fewer goals let in. O2.5 = games with 3+ goals, BTTS = both teams scored, CS = clean sheets."
        />
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Form</th>
                <th className="px-2 py-2 text-right font-medium">Pl</th>
                <th className="px-2 py-2 text-right font-medium">GD</th>
                <th className="px-2 py-2 text-right font-medium">Pts</th>
                <th className="px-3 py-2 font-medium">Attack</th>
                <th className="px-3 py-2 font-medium">Defence</th>
                <th className="px-2 py-2 text-right font-medium">O2.5</th>
                <th className="px-2 py-2 text-right font-medium">BTTS</th>
                <th className="px-2 py-2 text-right font-medium">CS</th>
                <th className="px-2 py-2 text-right font-medium">Elo</th>
              </tr>
            </thead>
            <tbody>
              {model.table.map((r, i) => (
                <TeamRow key={r.team} rank={i + 1} r={r} code={code} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Home / away splits (per the analyst notes: last-N home/away/overall) */}
      <section>
        <SectionTitle
          title="SCORING SPLITS · HOME vs AWAY"
          hint="Goals scored/conceded per game, split by venue — the biggest correction casual bettors miss. xGF/xGA is a shots-on-target expected-goals proxy: above actual goals = unlucky/underperforming finishing, below = overperforming."
        />
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-2 py-2 text-right font-medium">Home pts</th>
                <th className="px-2 py-2 text-right font-medium">Home GF</th>
                <th className="px-2 py-2 text-right font-medium">Home GA</th>
                <th className="px-2 py-2 text-right font-medium">Away pts</th>
                <th className="px-2 py-2 text-right font-medium">Away GF</th>
                <th className="px-2 py-2 text-right font-medium">Away GA</th>
                <th className="px-2 py-2 text-right font-medium">Overall GF/GA</th>
                <th className="px-2 py-2 text-right font-medium">xGF/xGA</th>
              </tr>
            </thead>
            <tbody>
              {[...model.table]
                .sort((a, b) => b.points - a.points)
                .map((r) => (
                  <tr key={r.team} className="border-t border-line bg-surface">
                    <td className="px-3 py-2 font-medium">{r.team}</td>
                    <td className="px-2 py-2 text-right tabnum">{r.homePts}</td>
                    <td className="px-2 py-2 text-right tabnum text-good">{one(r.homeGfPg)}</td>
                    <td className="px-2 py-2 text-right tabnum text-serious">{one(r.homeGaPg)}</td>
                    <td className="px-2 py-2 text-right tabnum">{r.awayPts}</td>
                    <td className="px-2 py-2 text-right tabnum text-good">{one(r.awayGfPg)}</td>
                    <td className="px-2 py-2 text-right tabnum text-serious">{one(r.awayGaPg)}</td>
                    <td className="px-2 py-2 text-right tabnum text-ink-2">
                      {one(r.scoredPerGame)} / {one(r.concededPerGame)}
                    </td>
                    <td className="px-2 py-2 text-right tabnum">
                      {r.xgfPg !== undefined && r.xgaPg !== undefined ? (
                        <span>
                          <span className="text-brand">{one(r.xgfPg)}</span>
                          <span className="text-muted"> / </span>
                          <span className="text-serious">{one(r.xgaPg)}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upcoming in this league */}
      {leaguePreds && leaguePreds.predictions.length > 0 && (
        <section>
          <SectionTitle title="UPCOMING FIXTURES" hint="Model vs market for the next matches in this league." />
          <div className="grid gap-3 lg:grid-cols-2">
            {leaguePreds.predictions.map((p, i) => (
              <PredictionCard key={i} p={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamRow({ rank, r, code }: { rank: number; r: TableRow; code: string }) {
  return (
    <tr className="border-t border-line bg-surface hover:bg-surface-2">
      <td className="px-3 py-2 tabnum text-muted">{rank}</td>
      <td className="px-3 py-2 font-medium">
        <Link href={`/leagues/${code}/${slugify(r.team)}`} className="hover:text-brand hover:underline">
          {r.team}
        </Link>
      </td>
      <td className="px-3 py-2">
        <FormPips form={r.form} />
      </td>
      <td className="px-2 py-2 text-right tabnum text-ink-2">{r.played}</td>
      <td className="px-2 py-2 text-right tabnum">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
      <td className="px-2 py-2 text-right tabnum font-semibold">{r.points}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16">
            <StrengthBar value={r.attack} kind="attack" />
          </div>
          <span className="tabnum text-[11px] text-muted">{r.attack.toFixed(2)}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16">
            <StrengthBar value={r.defense} kind="defense" />
          </div>
          <span className="tabnum text-[11px] text-muted">{r.defense.toFixed(2)}</span>
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <PctCell v={r.over25Pct} />
      </td>
      <td className="px-2 py-2 text-right">
        <PctCell v={r.bttsPct} />
      </td>
      <td className="px-2 py-2 text-right">
        <PctCell v={r.cleanSheetPct} muted />
      </td>
      <td className="px-2 py-2 text-right tabnum text-ink-2">
        {r.elo ? Math.round(r.elo) : "—"}
      </td>
    </tr>
  );
}

function PctCell({ v, muted }: { v: number; muted?: boolean }) {
  const strong = v >= 0.6;
  return (
    <span
      className={`tabnum text-[13px] ${
        muted ? "text-ink-2" : strong ? "text-good" : "text-ink-2"
      }`}
    >
      {Math.round(v * 100)}%
    </span>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cfg = LEAGUE_BY_CODE.get(code);
  return { title: cfg ? `${cfg.name} — Edge` : "League — Edge" };
}
