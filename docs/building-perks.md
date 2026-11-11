# Building perks

Every catalog row in `src/game/buildings.ts` carries `perkKey` and `perkValue`; rank multiplies the value. `perksForOwner()` sums them on the server. Key formulas:

- incomePerTurn = Σ steadyIncome × rank × $40 + schooling × rank × $60
- rentBoost = Σ rentBoost × rank; applied to rent as `1 + rentBoost + traffic + transport`
- loanInterest = Σ loanDesk × rank; interest = ceil(base × (1 − min(.5, total)))
- courtOdds = Σ courtDesk × rank; chance = min(.95, curve(evidence) + courtOdds)
- jailFee = Σ jailDesk × rank; release rate = max(.01, .05 − jailFee)
- recovery/cashShield protect stolen cash: `amount × (1 − min(.6, shield + recovery×.5))`
- transport gets +1% per additional owned hub.
- seasonal adds both seasonal income pressure and traffic; hospitality discounts the owner's spending.

61 distinct types are present, spanning steady income, lending, law, healthcare, rent boosting, court, market, detective, jail, insurance, casino, tax, fire, education, power, transport, reputation, traffic, cash protection, underworld, hospitality and harvest. Each has an explicit trade-off.

## Three slots and duplicate returns (Round 11 Y6)

Every multiplayer property has exactly **3** independent building slots. Duplicates are legal. The first copy of a type earns 100% of its perk and income, the second 70%, the third 50% (`DUPLICATE_RETURN_FACTORS` in `src/game/buildings.ts`). Different types never reduce each other. Rank still multiplies the perk value. In multiplayer rent, the extra-building percentage uses the same factors; the highest rank still sets the base percentage.

Single player keeps standard Monopoly houses/hotels and one building per property. The full catalogue is not a missing solo menu: solo is deliberately restricted.

**Payback simulation: not run — Unverified.** The Y7 validation script and 10,000-game payback report are not present.
