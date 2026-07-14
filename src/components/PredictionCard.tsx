import { Prediction } from "@/lib/types";
import { Card, Pill } from "@/components/ui";
import { ProbBar, SplitMeter, ValueBadge } from "@/components/viz";
import { fmtKickoff, odds, one } from "@/lib/format";
import { pct } from "@/lib/model/odds";

/**
 * One fixture: model 1X2 / O2.5 / BTTS probabilities, market comparison, and any
 * value signals. This is the core "opportunity" unit shown on Fixtures & league
 * pages.
 */
export function PredictionCard({ p, league }: { p: Prediction; league?: string }) {
  const f = p.fixture;
  const best = p.value?.[0];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {f.homeTeam} <span className="text-muted">v</span> {f.awayTeam}
          </div>
          <div className="text-[11px] text-muted">
            {league ? `${league} · ` : ""}
            {fmtKickoff(f.date, f.time)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {p.consensus && (
            <Pill tone="info">
              <span className="tracked text-[10px]">consensus</span>
            </Pill>
          )}
          {best ? (
            <Pill tone="good">
              <span className="tracked text-[10px]">value</span> {best.market} {" "}
              <ValueBadge ev={best.ev} />
            </Pill>
          ) : (
            <Pill tone="neutral">fair price</Pill>
          )}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-2">
        {/* 1X2 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] tracked text-muted">Match result</span>
            <span className="text-[11px] tabnum text-muted" title="Roughly how many goals we expect each side to score">
              ≈ {one(p.expHomeGoals)}–{one(p.expAwayGoals)} goals
            </span>
          </div>
          <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} />
          {p.elo && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] tabnum text-muted">
              <span className="tracked text-[10px]">Second opinion</span>
              <span>
                {pct(p.elo.pHome, 0)} · {pct(p.elo.pDraw, 0)} · {pct(p.elo.pAway, 0)}
              </span>
            </div>
          )}
          {p.market && (
            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] tabnum">
              <MarketCell label="Home" o={f.oddsH} model={p.pHome} market={p.market.pHome} />
              <MarketCell label="Draw" o={f.oddsD} model={p.pDraw} market={p.market.pDraw} />
              <MarketCell label="Away" o={f.oddsA} model={p.pAway} market={p.market.pAway} />
            </div>
          )}
        </div>

        {/* Goals markets */}
        <div className="grid content-start gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="tracked text-muted">Over 2.5 goals</span>
              <span className="tabnum text-ink-2">
                model {pct(p.pOver25, 0)}
                {p.marketOU && <span className="text-muted"> · mkt {pct(p.marketOU.pOver25, 0)}</span>}
              </span>
            </div>
            <SplitMeter left={p.pOver25} right={p.pUnder25} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="tracked text-muted">Both teams score</span>
              <span className="tabnum text-ink-2">model {pct(p.pBttsYes, 0)}</span>
            </div>
            <SplitMeter left={p.pBttsYes} right={p.pBttsNo} leftColor="var(--color-s5)" />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {p.topScores.slice(0, 3).map((s) => (
              <span
                key={s.score}
                className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] tabnum text-ink-2"
                title="Most likely scoreline"
              >
                {s.score} <span className="text-muted">{pct(s.p, 0)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MarketCell({
  label,
  o,
  model,
  market,
}: {
  label: string;
  o?: number;
  model: number;
  market: number;
}) {
  const edge = model - market;
  const strong = edge > 0.02;
  return (
    <div className="rounded-md bg-surface-2 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{odds(o)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between">
        <span className={strong ? "text-good" : "text-muted"}>
          {edge >= 0 ? "+" : ""}
          {(edge * 100).toFixed(0)}
        </span>
        <span className="text-ink-2">{pct(model, 0)}</span>
      </div>
    </div>
  );
}
