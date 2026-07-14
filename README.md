# ⚽ Edge — Football Betting Statistics Dashboard

An automated football (soccer) stats dashboard that **flushes out betting
opportunities**. Instead of manually querying one stat at a time (à la
AdamChoi), it pulls results, odds and ratings for whole leagues, runs every
upcoming match through a probability model, and flags the fixtures where the
**model's probability beats the bookmaker's price** — i.e. value bets.

It runs **entirely on your own machine** and needs **no paid data** and, by
default, **no API keys**.

---

## What it does

- **Value Bets** — every upcoming selection where our estimated probability beats
  the de-vigged market price, ranked by expected value (EV). This is the
  opportunity finder.
- **Fixtures** — model probabilities for every upcoming match (1X2, Over/Under
  2.5, Both Teams To Score, likely scorelines), side-by-side with the market.
- **League pages** — full tables with the betting angles bettors actually use:
  form, attack/defence strengths, Over 2.5 %, BTTS %, clean-sheet %, **home vs
  away scoring splits**, a **shots-based xG proxy**, and Elo ratings.
- **Team pages** — click any team for **last-10 overall / home / away** splits,
  recent results, strengths, and (with a key) an **injuries & suspensions** panel.
- **Backtest** — an honesty check: the model is tested on recent finished matches
  (no lookahead) against the real closing odds, so you can see whether it
  actually finds an edge and how its probabilities compare to the market's.

Each fixture also carries an independent **Elo second opinion**, and a
**consensus** badge appears when the goal model and Elo agree on the favourite —
higher-confidence opportunities.

## The idea in three steps

1. **Model the goals.** A Dixon-Coles model learns each team's attack & defence
   from recent results (recency-weighted, so old games and head-to-heads barely
   count) and produces a full scoreline probability distribution.
2. **Strip the vig.** Bookmaker odds include a margin, so their implied
   probabilities add up to more than 100 %. We normalise them back to a fair
   100 % to recover the book's true estimate.
3. **Compare & flag.** Where the model's probability beats the fair price,
   expected value is positive — a value bet. Bigger, greener badge = bigger edge.

---

## How to run it (no coding needed)

You need **Node.js 18+** installed (get it from https://nodejs.org — the "LTS"
button). Then, in a terminal opened in this folder:

```bash
npm install      # first time only — downloads dependencies
npm run dev      # starts the app
```

Then open **http://localhost:3000** in your browser. That's it.

> First page load for a league takes a few seconds while it downloads that
> season's data; after that it's cached locally and fast.

To stop it, press `Ctrl+C` in the terminal. To start it again another day, just
run `npm run dev` again.

### Sharing it with a friend

Two easy options:

- **They run their own copy.** Send them this folder (or a zip). They install
  Node, run the same two commands, and open `localhost:3000`. Nothing is
  published online.
- **Same Wi-Fi.** While `npm run dev` is running it also prints a
  `Network: http://192.168.x.x:3000` address — anyone on your network can open
  that in their browser.

---

## Data sources (all free)

| Source | What it gives | Key needed |
|---|---|---|
| **Football-Data.co.uk** | ~25 seasons of results, match stats and multi-bookmaker odds (1X2, O/U, Asian Handicap), plus an upcoming-fixtures file with odds | No |
| **ClubElo** | Club Elo strength ratings | No |
| **The Odds API** *(optional)* | Live multi-bookmaker odds | Free key |

### Optional keys

The app is complete without any keys. Two optional integrations light up if you
add keys — copy `.env.example` to `.env.local` and paste them:

- **Live odds** — a free key from https://the-odds-api.com/ enables live
  multi-bookmaker odds. (Wiring these into the value engine is on the roadmap.)
- **Injuries & suspensions** — a free key from https://www.api-football.com/
  (`API_FOOTBALL_KEY`) shows an availability panel on each team page.

---

## Leagues covered

Top-5 (Premier League, La Liga, Bundesliga, Serie A, Ligue 1) plus Championship,
Eredivisie, Primeira Liga, Belgian Pro League and La Liga 2. In the European
summer break there are no upcoming fixtures, so **Value Bets / Fixtures will be
empty until seasons resume in August** — the League and Backtest pages work
year-round. New leagues are one line in `src/lib/leagues.ts`.

## Roadmap

Analyst ideas and planned features (real xG from Understat/Flashscore, injuries &
lineups, cup awareness, last-10 splits, live odds wiring) are tracked in
[`docs/BACKLOG.md`](docs/BACKLOG.md).

---

## ⚠️ Important

This is a **research and entertainment tool**, not betting advice. A model is only
as good as its assumptions, and beating the closing line is genuinely hard — the
backtest is deliberately honest about that. No bet is a sure thing. Only ever
stake what you can afford to lose, and check the gambling laws and age limits
where you live.

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS. All data fetching,
modelling and value detection is plain TypeScript in `src/lib`. No database — data
is downloaded on demand and cached to a local `.cache/` folder.
