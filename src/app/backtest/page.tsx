import Link from "next/link";
import { getAllBacktests } from "@/lib/model/build";
import { Card, Pill, SectionTitle, StatTile } from "@/components/ui";
import { LeagueBadge } from "@/components/LeagueBadge";
import { fmtDate } from "@/lib/format";
import { pct } from "@/lib/model/odds";

export default async function BacktestPage() {
  const tests = await getAllBacktests();

  const totalBets = tests.reduce((s, t) => s + t.bets.length, 0);
  const totalStaked = tests.reduce((s, t) => s + t.staked, 0);
  const totalProfit = tests.reduce((s, t) => s + t.profit, 0);
  const roi = totalStaked > 0 ? totalProfit / totalStaked : 0;
  const beatsMarket = tests.filter((t) => t.brierModel < t.brierMarket).length;

  const recent = tests
    .flatMap((t) => t.bets.map((b) => ({ ...b, code: t.code, name: t.name })))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Track record</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Can you trust the numbers? This is the honesty page. We take past matches the model never
          learned from, let it pick the bets it thinks are worth it against the{" "}
          <span className="text-ink">real odds that were offered</span>, and check every pick against
          what actually happened. Beating the bookmaker&apos;s closing price is the hardest test in
          betting, so read this as a sober reality check — not a promise.{" "}
          <Link href="/replay" className="text-brand hover:underline">
            Want to test your own read instead? Try Replay →
          </Link>
        </p>
      </div>

      {tests.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Not enough priced history to backtest yet. This fills in once season CSVs carry closing
          odds for the configured leagues.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Value bets graded" value={totalBets} sub="across all leagues" />
            <StatTile
              label="Blind ROI"
              value={totalBets > 0 ? `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(1)}%` : "—"}
              accent={roi >= 0 ? "good" : "crit"}
              sub="flat 1-unit stakes"
            />
            <StatTile
              label="Model beats market"
              value={`${beatsMarket}/${tests.length}`}
              accent={beatsMarket >= tests.length / 2 ? "good" : "warn"}
              sub="1X2 calibration (Brier)"
            />
            <StatTile label="Leagues tested" value={tests.length} />
          </div>

          <SectionTitle
            title="PER-LEAGUE RESULTS"
            hint="Brier score measures probability calibration (lower is better). A model Brier below the market's means our probabilities were sharper than the book's."
          />
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                  <th className="px-3 py-2 font-medium">League</th>
                  <th className="px-2 py-2 text-right font-medium">Holdout</th>
                  <th className="px-2 py-2 text-right font-medium">Bets</th>
                  <th className="px-2 py-2 text-right font-medium">Hit %</th>
                  <th className="px-2 py-2 text-right font-medium">ROI</th>
                  <th className="px-2 py-2 text-right font-medium">Brier (model)</th>
                  <th className="px-2 py-2 text-right font-medium">Brier (market)</th>
                  <th className="px-2 py-2 text-center font-medium">Edge</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.code} className="border-t border-line bg-surface">
                    <td className="px-3 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <LeagueBadge code={t.code} size="sm" /> {t.name}
                        <span className="text-[11px] text-muted">{t.season}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabnum text-ink-2">{t.testedMatches}</td>
                    <td className="px-2 py-2.5 text-right tabnum">{t.bets.length}</td>
                    <td className="px-2 py-2.5 text-right tabnum text-ink-2">
                      {t.bets.length ? pct(t.hitRate, 0) : "—"}
                    </td>
                    <td
                      className={`px-2 py-2.5 text-right tabnum font-semibold ${
                        t.staked === 0 ? "text-muted" : t.roi >= 0 ? "text-good" : "text-crit"
                      }`}
                    >
                      {t.staked ? `${t.roi >= 0 ? "+" : ""}${(t.roi * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabnum">{t.brierModel.toFixed(3)}</td>
                    <td className="px-2 py-2.5 text-right tabnum text-muted">{t.brierMarket.toFixed(3)}</td>
                    <td className="px-2 py-2.5 text-center">
                      {t.brierModel < t.brierMarket ? (
                        <Pill tone="good">sharper</Pill>
                      ) : (
                        <Pill tone="neutral">market</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recent.length > 0 && (
            <>
              <SectionTitle title="RECENTLY GRADED VALUE BETS" hint="The model's most recent flags on held-out matches, settled at closing odds." />
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-left text-[11px] tracked text-muted">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Match</th>
                      <th className="px-3 py-2 font-medium">Pick</th>
                      <th className="px-2 py-2 text-right font-medium">Odds</th>
                      <th className="px-2 py-2 text-center font-medium">Result</th>
                      <th className="px-2 py-2 text-right font-medium">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b, i) => (
                      <tr key={i} className="border-t border-line bg-surface">
                        <td className="px-3 py-2 tabnum text-muted">{fmtDate(b.date)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <LeagueBadge code={b.code} size="sm" /> {b.home} v {b.away}
                          </span>
                        </td>
                        <td className="px-3 py-2">{b.market}</td>
                        <td className="px-2 py-2 text-right tabnum">{b.odds.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          {b.won ? <Pill tone="good">won</Pill> : <Pill tone="crit">lost</Pill>}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabnum font-semibold ${
                            b.profit >= 0 ? "text-good" : "text-crit"
                          }`}
                        >
                          {b.profit >= 0 ? "+" : ""}
                          {b.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Card className="p-4">
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink-2">Honest caveat.</span> This is a single
              hold-out per league on one season, at flat stakes, with no transaction costs or line
              movement — it is a sanity check, not proof of profitability. Positive ROI here does
              not guarantee future returns; markets adjust. The more robust signal is calibration:
              if the model&apos;s Brier score is at or below the market&apos;s, its probabilities
              are competitive with the book&apos;s, which is the foundation any edge is built on.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
