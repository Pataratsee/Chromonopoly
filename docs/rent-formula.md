# Multiplayer rent formula

Implemented in `src/game/rules.ts` (`multiplayerRent`) and called by the server at the moment of
landing from the payer’s authoritative liquid cash.

```
rankPercent = [1%, 5%, 10%, 40%][highestRank - 1]
buildingFactor = 1 + 0.10 × (numberOfBuildings - 1)
prestigeFactor = 1 + 0.25 × (numberOfRank4Buildings - 1)
percent = rankPercent × buildingFactor × prestigeFactor
rent = max($10, floor(payerCash × percent))
```

There is no cap. An empty property charges the fixed base rent from the board data (also with the
$10 floor). Mortgaged property charges $0. The highest-rank building sets the base percentage; every
additional building adds 10% of that percentage; every additional rank-4 building adds a 25%
prestige multiplier.

## $1,000,000 payer, one building on Boardwalk

| Building | Rank | Percent | Rent |
|---|---:|---:|---:|
| House | 1 | 1% | $10,000 |
| House | 2 | 5% | $50,000 |
| House | 3 | 10% | $100,000 |
| House | 4 | 40% | $400,000 |

## Multiple buildings, all rank 4

| Buildings | Calculation | Percent | Rent |
|---:|---|---:|---:|
| 1 | 40% | 40% | $400,000 |
| 2 | 40% × 1.10 × 1.25 | 55% | $550,000 |
| 3 | 40% × 1.20 × 1.50 | 72% | $720,000 |
| 4 | 40% × 1.30 × 1.75 | 91% | $910,000 |

## $100,000 payer, one rank-4 building

`100,000 × 40% = 40,000`, so rent is $40,000. With a $0 payer the result is the $10 minimum.

The same helper is covered by `tests/round9.test.ts` for rank 1, rank 4, two rank-4 buildings and
the minimum.
