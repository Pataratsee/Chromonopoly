# Stock market balance — measured simulation

Command:

```
node_modules/.bin/vite-node scripts/round9-market-sim.ts
```

Model: 10,000 independently seeded players, each starting with $10,000 and making 16 random
buy/sell decisions across 16 stocks, using the real `nextPrice`, `fundamental`, 0.5% fee and 0.5%
spread from `src/game/rules.ts`. Every player marks their final holdings after spread and fee.

Final constants: `stockDrift = -0.002`, `stockNoise = 0.05`, `stockFee = 0.005`,
`stockSpread = 0.005`.

```json
{
  "players": 10000,
  "ticks": 16,
  "fee": 0.005,
  "spread": 0.005,
  "drift": -0.002,
  "noise": 0.05,
  "mean": -0.03331912134944661,
  "median": -0.0386880475336453,
  "p10": -0.15686005514389767,
  "p90": 0.09727762569194476,
  "p99": 0.22217576079164902,
  "profitable": 0.3478,
  "meaningful": 0.1936,
  "large": 0.0053,
  "max": 0.41383749928447977,
  "min": -0.33039374010072164
}
```

Raw output: `docs/round9-proof/market-sim.json`.

## Reading

- The median random player loses 3.87% after costs, so indiscriminate trading is still a losing
  strategy.
- 34.78% of players finish positive; 19.36% clear +5% and 0.53% clear +25%. There is a real minority
  of meaningful winners, not a broad guaranteed gain.
- The mean is −3.33%. The best run is +41.38% and the worst is −33.04%; p10 is −15.69% and p99 is
  +22.22%.

This meets the requested shape: hard to profit by buying at random, but a minority can do
meaningfully well. It is a random-timing simulation, not a claim about skilled play or a live
10,000-player session.

## What changed

The earlier build used a positive drift and charged neither fee nor spread, so random buying was
profitable. The current rules use a small negative drift, lower noise, a 0.5% fee and a 0.5% spread.
Purchases, builds and upgrades still bump the affected share price, so board activity feeds back
into the market.

## Reproduce

```bash
node_modules/.bin/vite-node scripts/round9-market-sim.ts
```

The optional `MARKET_PLAYERS`, `MARKET_TICKS`, `MARKET_DRIFT`, `MARKET_NOISE`, `MARKET_FEE` and
`MARKET_SPREAD` environment variables override the run for sensitivity checks; the committed result
uses the defaults above.
