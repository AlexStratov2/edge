# Backlog — analyst insights & future features

A running list of ideas to fold into the model/dashboard. Captured as they come;
we revisit when the time is right. Newest batches at the bottom.

Status key: ✅ done · 🟡 partially handled · ⬜ not started

---

## Big-picture direction

- ⬜ **Extend beyond football to other sports.** Long-term: cover the most-bet
  sports (candidates by global betting volume: basketball/NBA, tennis, American
  football/NFL, baseball/MLB, ice hockey/NHL, cricket, MMA/boxing, esports). Each
  sport needs its own data sources and a market/model layer, but the core engine
  (odds → de-vig → model probability → value/EV → backtest) is sport-agnostic and
  can be reused. Architect the domain layer so "football" is one pluggable sport
  module. Future work.

## Prematch vs live split (analyst spec)

The analyst wants the product split into a **prematch zone** and a **live zone**
(live = real-time, more complex — do it later).

- ✅ **Match Simulator (prematch):** pick any two teams → every market as a %.
  Covers total goals (multiple lines), 1st-half & 2nd-half goals, BTTS/GG,
  corners (per match), and cards (per match). Works year-round, no scheduled
  fixture needed — the convincing demo.
- 🟡 **Full market coverage per the spec.** Done: goals lines, halves, BTTS,
  corners (match total + per team), cards (match total). ⬜ To add: corners
  *per team* over-lines, first-half BTTS, exact card/corner handicaps, and tuning
  each line's probability against realised hit-rates.
- ⬜ **Basis = current league, last 10 (home/away/overall) + H2H ≤10.** Goals/1X2
  use the recency-weighted multi-season model; corners/cards currently use
  current-season venue averages. TODO: switch corners/cards to strict last-10
  home/away windows to match the analyst's basis exactly.
- ⬜ **Live zone (real-time).** In-play markets and live xG — explicitly deferred.

## Replay / Paper-Bet mode (user's vision — high priority)

The user wants a human-in-the-loop version of the backtest: **pick a past match,
show only the pre-match stats/predictions (result hidden), let the friend draw
conclusions and place a paper bet, then reveal how the match actually went** and
whether the call won. This is the convincing, interactive counterpart to the
automated backtest — it lets the friend test his own judgement against reality
and build trust in the numbers.

- ⬜ **Build `/replay`:** random or chosen past fixture → pre-match panel (last-10
  home/away/overall, model probs, market odds, xG proxy) with the score hidden →
  user picks a market → "Reveal" shows the real result + grades the pick → keep a
  running paper-bet record (hit-rate / P&L). Works on the static site with baked
  match data + client-side interactivity.
- Distinguish from the existing **Backtest** page, which auto-grades the *model's*
  value flags across a season (not human-driven). Both are useful; the Replay is
  the one that convinces a skeptical human.

## Convincing the analyst — calibration & trusted markets

The analyst was sold by a (now-defunct) platform that showed **Over 1.5 goals**
and **BTTS** as a **%** using the **last 10 matches**, and whose high-confidence
calls landed ~45/50 (≥80% predicted → ~90% realised). Takeaways:

- ⬜ **Calibration view (highest priority for trust).** Prove our percentages mean
  something: bucket backtest predictions (e.g. Over 1.5, BTTS, Over 2.5) by
  predicted probability and show realised hit-rate per bucket ("when we say 80%,
  it happens X% over N games"). This directly mirrors his 45/50 experience.
- 🟡 **Lead with the markets he trusts:** Over 1.5 goals and BTTS, as a clear %.
  The Match Simulator now surfaces these; make sure they're prominent.
- Note: AdamChoi uses last-5 for its splits; the analyst prefers last-10.

## Model & data quality

- ✅ **Recency matters most; old games & H2H barely count.** The goal model is
  recency-weighted (exponential decay, ~210-day half-life), so results more than
  ~10 games / one season back fade out. Head-to-head is deliberately *not* a
  feature — research and the analyst both rate it low-signal.
- 🟡 **Split form into last-10 home / last-10 away / last-10 overall (+ H2H).**
  The model already separates home vs away scoring/conceding rates, and the
  league page shows home/away/overall splits. TODO: add explicit rolling
  "last-10" windows per venue on a team detail page.
- 🟡 **Same-country competitions (league, cups, other comps) are different.**
  Currently mitigated *by construction*: we only ingest league CSVs, so cup
  matches never contaminate league form. TODO (optional): a separate "cup mode"
  that pulls cup data and models it independently.
- ⬜ **Squad rotation between cups and league.** Teams field different XIs in cups
  vs league; cup form is not directly comparable to league form. Relevant only
  once cup data is added.

## Team availability (high value)

- 🟡 **Injuries / suspensions — DISPLAY done, model-adjustment pending.** Team
  pages now show an availability panel from API-Football (optional, key-gated via
  `API_FOOTBALL_KEY`). ⬜ Still to do: feed availability back into the model — an
  availability-adjusted strength that discounts a team's attack/defence when key
  contributors are out (needs a player-importance weighting, e.g. minutes or
  rating). Lineups (predicted XI) are a further step.

---

## Expected Goals (xG) — the core signal

- ✅ **Shots-based xG proxy is now blended into the model.** Football-Data carries
  shots and shots-on-target per match; we convert shots-on-target into an
  expected-goals proxy (league conversion rate) and blend it with actual goals
  when fitting team strengths. This dampens luck and moves the model toward chance
  quality — the core xG idea — with no scraping. Shown as "xGF/xGA (proxy)".
- ⬜ **Real shot-placement xG (Understat/FBref) — BLOCKED by anti-bot.** As of the
  build, Understat serves a stripped page to non-browser fetches and even headless
  `--dump-dom` does not expose `teamsData`; reliable ingestion would need full
  browser automation (Playwright), which is fragile and not portable to a friend's
  copy. Research (PLOS ONE 2023) still shows true shot-based xG beats goals
  (r≈0.57 vs 0.47), so revisit if a clean feed appears (Flashscore ~85 %, a
  licensed API, or an accepted CSV mirror). The proxy above is the pragmatic stand-in.

## Live odds integration

- 🟡 **The Odds API module exists** (`src/lib/sources/oddsApi.ts`) and can fetch +
  de-vig live multi-bookmaker 1X2 odds when `THE_ODDS_API_KEY` is set. ⬜ Not yet
  wired into the value engine because it needs a **team-name matcher** between The
  Odds API names and Football-Data names (fuzzy match + alias table). Once mapped,
  compare model probs against live odds for real-time value (fresher than the
  fixtures.csv snapshot, and more bookmakers).

## Notes on data sources for the above

- **xG feeds:** Understat (free, top-6 leagues, scrape) is the primary candidate.
  Analyst also suggests **Flashscore** carries xG for the major leagues (~85%
  coverage) — worth evaluating as a second/alternative xG source.
- **Injuries/suspensions/lineups:** API-Football (freemium, ~100 req/day),
  or FotMob/SofaScore internal endpoints (scraping — ToS risk). No fully-free,
  clean, licensed feed identified yet; this is the main blocker for the
  availability feature.
- **Cup data:** Football-Data.co.uk is league-only; cups would need another
  source (e.g. OpenFootball, API-Football).
