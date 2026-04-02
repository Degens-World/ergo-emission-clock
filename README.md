# ERG Emission Clock ⏰

Real-time Ergo blockchain supply and emission tracker. Visualizes the complete ERG emission schedule, current circulating supply, and countdown to the next block reward change.

## Features

- **Live Supply Stats** — current block height, circulating supply, % minted, current block reward
- **Supply Progress Bar** — visual fill from genesis to max supply (97,739,925 ERG)
- **Next Reward Countdown** — blocks and days until the next emission epoch change, showing the incoming reward
- **Supply Curve Chart** — cumulative ERG minted across all emission epochs
- **Block Reward Chart** — bar chart of reward per epoch (past / current / future color-coded)
- **Emission Schedule Table** — full epoch-by-epoch breakdown with CURRENT / PAST / FUTURE badges
- **Auto-refresh every 60s** via Ergo Explorer API

## Ergo Emission Model

Ergo uses a fixed emission schedule with 64,800-block epochs (~90 days). Block rewards start at 75 ERG and decrease by 3 ERG per epoch until reaching the minimum of 3 ERG/block, which continues indefinitely (supplemented by storage rent fees).

Max supply: **97,739,925 ERG**

## How to Run Locally

```bash
# Just open in a browser — no build step required
open index.html
```

Or serve with any static file server:

```bash
npx serve .
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- [Chart.js](https://www.chartjs.org/) for supply curve and reward bar charts
- [Ergo Explorer API](https://api.ergoplatform.com) for live block height
- All emission math computed client-side from the known schedule
