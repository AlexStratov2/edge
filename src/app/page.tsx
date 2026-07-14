import Link from "next/link";
import { getTopValueBets, getUpcomingPredictions } from "@/lib/model/build";
import { LEAGUES } from "@/lib/leagues";
import { Card, Pill, SectionTitle, StatTile } from "@/components/ui";
import { ValueBadge } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";
import { fmtKickoff } from "@/lib/format";
import { pct } from "@/lib/model/odds";

export default async function OverviewPage() {
  const [leagues, value] = await Promise.all([
    getUpcomingPredictions(10),
    getTopValueBets(10),
  ]);

  const fixtureCount = leagues.reduce((s, l) => s + l.predictions.length, 0);
  const liveLeagues = leagues.length;
  const withOdds = leagues.flatMap((l) => l.predictions).filter((p) => p.market);
  const avgMargin =
    withOdds.length > 0
      ? withOdds.reduce((s, p) => s + (p.market!.overround - 1), 0) / withOdds.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="relative overflow-hidden p-6">
          <div className="relative z-10">
            <span className="text-[11px] tracked text-brand">Opportunity engine</span>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              {value.length > 0 ? (
                <>
                  <span className="text-brand tabnum">{value.length}</span> value{" "}
                  {value.length === 1 ? "bet" : "bets"} on the board
                </>
              ) : (
                <>No clear edges right now</>
              )}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-ink-2">
              Every upcoming fixture is run through a Dixon-Coles goal model, then compared
              against the de-vigged market price. When our probability beats the fair price,
              it&apos;s flagged as value. {fixtureCount} fixtures analysed across {liveLeagues}{" "}
              live {liveLeagues === 1 ? "league" : "leagues"}.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/replay"
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-good-ink transition-opacity hover:opacity-90"
              >
                Play Replay →
              </Link>
              <Link
                href="/value"
                className="rounded-md border border-line-2 bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
              >
                See value bets
              </Link>
              <Link
                href="/fixtures"
                className="rounded-md border border-line-2 bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
              >
                Fixtures
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatTile label="Value bets" value={value.length} accent="brand" sub="+2% EV or better" />
          <StatTile label="Fixtures" value={fixtureCount} sub="next 10 days" />
          <StatTile label="Live leagues" value={liveLeagues} sub="with upcoming games" />
          <StatTile
            label="Avg book margin"
            value={avgMargin > 0 ? pct(avgMargin, 1) : "—"}
            accent="warn"
            sub="the vig you beat"
          />
        </div>
      </section>

      {/* Top value bets */}
      <section>
        <SectionTitle
          title="TOP OPPORTUNITIES"
          hint="Selections where the model's probability exceeds the market's fair price, ranked by expected value."
          right={
            value.length > 0 ? (
              <Link href="/value" className="text-xs text-brand hover:underline">
                View all
              </Link>
            ) : undefined
          }
        />
        {value.length === 0 ? (
          <Card className="p-6 text-sm text-muted">
            No value signals in the current fixture window. This is normal in the off-season —
            top-5 leagues repopulate in August. Meanwhile, explore league tables and team
            strengths below.
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">Pick</th>
                  <th className="px-3 py-2 text-right font-medium">Odds</th>
                  <th className="px-3 py-2 text-right font-medium">Model</th>
                  <th className="px-3 py-2 text-right font-medium">Edge</th>
                  <th className="px-3 py-2 text-right font-medium">EV</th>
                </tr>
              </thead>
              <tbody>
                {value.slice(0, 8).map((v, i) => (
                  <tr key={i} className="border-t border-line bg-surface">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">
                        {v.prediction.fixture.homeTeam} v {v.prediction.fixture.awayTeam}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <LeagueBadge code={v.code} size="sm" /> {v.league} · {fmtKickoff(v.prediction.fixture.date, v.prediction.fixture.time)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone="info">{v.signal.market}</Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right tabnum font-semibold">{v.signal.odds.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right tabnum text-ink-2">{pct(v.signal.modelProb, 0)}</td>
                    <td className="px-3 py-2.5 text-right tabnum text-good">+{(v.signal.edge * 100).toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <ValueBadge ev={v.signal.ev} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Leagues */}
      <section>
        <SectionTitle title="LEAGUES" hint="Tables, team strengths and betting splits from the latest season." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LEAGUES.map((l) => (
            <Link key={l.code} href={`/leagues/${l.code}`}>
              <Card className="group p-4 transition-colors hover:bg-surface-2">
                <div className="flex items-center gap-2.5">
                  <LeagueBadge code={l.code} size="lg" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    <div className="text-[11px] text-muted">{l.country}</div>
                  </div>
                  <span
                    className="ml-auto h-2 w-2 rounded-full"
                    style={{ background: l.accent }}
                    aria-hidden
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <SectionTitle title="HOW THE EDGE IS FOUND" />
        <div className="grid gap-3 md:grid-cols-3">
          <Explainer
            n="1"
            title="Model the goals"
            body="A Dixon-Coles model learns each team's attack & defence from recent results (recency-weighted — old games and head-to-heads barely count), producing a full scoreline distribution."
          />
          <Explainer
            n="2"
            title="Strip the vig"
            body="Bookmaker odds include a margin, so implied probabilities sum above 100%. We normalise them back to a fair 100% to see the book's true estimate."
          />
          <Explainer
            n="3"
            title="Compare & flag"
            body="Where the model's probability beats the fair price, expected value is positive — a value bet. Bigger, greener badges mean a bigger edge."
          />
        </div>
      </section>
    </div>
  );
}

function Explainer({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs font-bold text-brand">
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-2">{body}</p>
    </Card>
  );
}
