import Link from "next/link";
import { getTopValueBets } from "@/lib/model/build";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { ValueBadge } from "@/components/viz";
import { LeagueBadge } from "@/components/LeagueBadge";
import { fmtKickoff } from "@/lib/format";
import { pct } from "@/lib/model/odds";

export default async function ValuePage() {
  const value = await getTopValueBets(14);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Value bets</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Every upcoming selection where the model&apos;s probability beats the bookmaker&apos;s
          fair (de-vigged) price. Ranked by expected value — the theoretical return per unit
          staked if the model is right. Positive EV is the mathematical definition of a good bet.
        </p>
      </div>

      <SectionTitle
        title={`${value.length} SIGNALS`}
        hint="EV ≥ +2%. Green intensity scales with edge. This is a shortlist to research, not advice."
      />

      {value.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No value signals right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            The model found no positive-EV selections in the upcoming fixture window. In the
            top-5 off-season this is expected; check back when leagues resume, or browse{" "}
            <Link href="/fixtures" className="text-brand hover:underline">
              all fixtures
            </Link>{" "}
            for full probabilities.
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
                <th className="px-3 py-2 text-right font-medium">Model %</th>
                <th className="px-3 py-2 text-right font-medium">Fair %</th>
                <th className="px-3 py-2 text-right font-medium">Edge</th>
                <th className="px-3 py-2 text-right font-medium">EV</th>
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

      <Card className="p-4">
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink-2">Reading this table.</span> “Model %” is our
          estimated chance of the outcome; “Fair %” is the bookmaker&apos;s implied chance with the
          margin removed. “Edge” is the gap between them; “EV” is expected value at the offered
          odds. A model is only as good as its assumptions — treat these as a filtered starting
          point for your own judgement, and never stake more than you can afford to lose.
        </p>
      </Card>
    </div>
  );
}
