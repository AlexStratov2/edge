import { getEloUpcoming, getUpcomingPredictions } from "@/lib/model/build";
import { Card, SectionTitle } from "@/components/ui";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PredictionCard } from "@/components/PredictionCard";
import { ProbBar, SplitMeter } from "@/components/viz";
import { fmtDate } from "@/lib/format";
import { pct } from "@/lib/model/odds";

export default async function FixturesPage() {
  const [leagues, eloLeagues] = await Promise.all([
    getUpcomingPredictions(10),
    getEloUpcoming(12),
  ]);
  const total = leagues.reduce((s, l) => s + l.predictions.length, 0);
  const eloTotal = eloLeagues.reduce((s, l) => s + l.fixtures.length, 0);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold">Upcoming fixtures</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Our take on every upcoming match. Where we have the odds, we also flag generous prices.
        </p>
      </div>

      {/* Odds-backed predictions (value possible) */}
      {leagues.length > 0 &&
        leagues.map((lg) => (
          <section key={lg.code}>
            <div className="mb-3 flex items-center gap-2.5">
              <LeagueBadge code={lg.code} size="md" />
              <h2 className="text-[13px] font-semibold tracking-wide">{lg.name.toUpperCase()}</h2>
              <span className="text-xs text-muted">
                {lg.predictions.length} {lg.predictions.length === 1 ? "fixture" : "fixtures"}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {lg.predictions.map((p, i) => (
                <PredictionCard key={i} p={p} />
              ))}
            </div>
          </section>
        ))}

      {/* Prediction-only (no odds available yet) */}
      {eloLeagues.length > 0 && (
        <section>
          <SectionTitle
            title="IN-SEASON NOW · PREDICTIONS ONLY"
            hint="These leagues are playing, but we don't have live odds for them yet — so here's our prediction, without a value flag. Odds-based value returns when a price source covers them."
          />
          {eloLeagues.map((lg) => (
            <div key={lg.code} className="mb-5">
              <div className="mb-3 flex items-center gap-2.5">
                <LeagueBadge code={lg.code} size="md" />
                <h3 className="text-[13px] font-semibold tracking-wide">{lg.name.toUpperCase()}</h3>
                <span className="text-xs text-muted">{lg.fixtures.length} coming up</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {lg.fixtures.map((f, i) => (
                  <Card key={i} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {f.home} <span className="text-muted">v</span> {f.away}
                      </div>
                      <span className="text-[11px] text-muted">{fmtDate(new Date(`${f.date}T12:00:00Z`))}</span>
                    </div>
                    <ProbBar home={f.pHome} draw={f.pDraw} away={f.pAway} />
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <div className="mb-1 flex justify-between text-muted">
                          <span>Over 2.5 goals</span>
                          <span className="tabnum text-ink-2">{pct(f.pOver25, 0)}</span>
                        </div>
                        <SplitMeter left={f.pOver25} right={1 - f.pOver25} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-muted">
                          <span>Both teams score</span>
                          <span className="tabnum text-ink-2">{pct(f.pBttsYes, 0)}</span>
                        </div>
                        <SplitMeter left={f.pBttsYes} right={1 - f.pBttsYes} leftColor="var(--color-s5)" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Nothing at all */}
      {leagues.length === 0 && eloLeagues.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No upcoming matches right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            The big leagues are in their summer break and no fixture feed has games for the coming
            days. League tables, team pages and Match Analysis all work in the meantime.
          </p>
        </Card>
      )}

      {(total > 0 || eloTotal > 0) && (
        <p className="text-xs text-muted">
          {total > 0 && `${total} odds-backed. `}
          {eloTotal > 0 && `${eloTotal} prediction-only (no odds yet).`}
        </p>
      )}
    </div>
  );
}
