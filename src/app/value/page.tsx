import Link from "next/link";
import { getSuggestedPicks, getTopValueBets } from "@/lib/model/build";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { ValueBadge } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";
import { fmtDate, fmtKickoff } from "@/lib/format";
import { pct } from "@/lib/model/odds";

export default async function ValuePage() {
  const [value, picks] = await Promise.all([getTopValueBets(14), getSuggestedPicks()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Value bets</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          These are upcoming matches where the app thinks a result is <span className="text-ink">more
          likely than the odds suggest</span> — in other words, the price looks too generous. It&apos;s
          a shortlist worth a closer look, not a tip. The bigger the green number, the bigger the gap.
        </p>
      </div>

      <SectionTitle
        title={`${value.length} TO LOOK AT`}
        hint="Sorted by how good the price looks. Always your own decision — never a sure thing."
      />

      {value.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nothing worth flagging right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            The app didn&apos;t find any generously-priced matches in the coming days. During the
            summer break this is normal — check back when the leagues restart, or browse{" "}
            <Link href="/fixtures" className="text-brand hover:underline">
              all fixtures
            </Link>{" "}
            to see the chances for every game.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                <th className="px-3 py-2 font-medium">Match</th>
                <th className="px-3 py-2 font-medium">Pick</th>
                <th className="px-3 py-2 text-right font-medium">Odds</th>
                <th className="px-3 py-2 text-right font-medium">Our chance</th>
                <th className="px-3 py-2 text-right font-medium">Bookie&apos;s chance</th>
                <th className="px-3 py-2 text-right font-medium">Gap</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {value.map((v, i) => (
                <tr key={i} className="border-t border-line bg-surface hover:bg-surface-2">
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
                  <td className="px-3 py-2.5 text-right tabnum text-ink-2">{pct(v.signal.modelProb, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabnum text-muted">{pct(v.signal.marketProb, 1)}</td>
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

      {/* Confident predictions (no odds needed) */}
      {picks.length > 0 && (
        <section>
          <SectionTitle
            title="MOST CONFIDENT CALLS"
            hint="Our strongest picks for games we don't have odds on yet (e.g. Romania). These are high-probability predictions, not value-vs-price — a shortlist, never a certainty."
          />
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">Our call</th>
                  <th className="px-3 py-2 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {picks.slice(0, 25).map((p, i) => (
                  <tr key={i} className="border-t border-line bg-surface hover:bg-surface-2">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.home} v {p.away}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <LeagueBadge code={p.code} size="sm" /> {p.league} · {fmtDate(new Date(`${p.date}T12:00:00Z`))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone="info">{p.market}</Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right tabnum font-semibold text-brand">{pct(p.prob, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Card className="p-4">
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink-2">How to read this.</span> “Our chance” is how
          likely the app thinks the result is. “Bookie&apos;s chance” is what the odds really imply
          once you take out the bookmaker&apos;s cut. When our chance is higher, the price looks
          generous — that&apos;s the “gap”, and the “value” is roughly how much you&apos;d expect to
          make over time if we&apos;re right. Use it as a starting point for your own judgement, and
          never bet more than you can afford to lose.
        </p>
      </Card>
    </div>
  );
}
