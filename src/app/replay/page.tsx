import { getReplayFixtures } from "@/lib/model/build";
import { ReplayGame } from "@/components/ReplayGame";

export default async function ReplayPage() {
  const fixtures = await getReplayFixtures(14);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Replay</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Test your read against reality. You get the pre-match picture of a real past match —
          recent form, the model&apos;s take, the odds — but the <span className="text-ink">result is
          hidden</span>. Make your call, place a paper bet (1 unit), then reveal what actually
          happened. Your record is saved on this device. No real money, ever.
        </p>
      </div>
      <ReplayGame fixtures={fixtures} />
      <p className="text-xs text-muted">
        Fixtures are drawn from the most recent completed matches across all leagues. Odds shown are
        the market averages that were offered pre-match. This is a training game, not betting advice.
      </p>
    </div>
  );
}
