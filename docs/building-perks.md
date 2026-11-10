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

61 distinct types are present, spanning steady income, lending, law, healthcare, rent boosting, court, market, detective, jail, insurance, casino, tax, fire, education, power, transport, reputation, traffic, cash protection, underworld, hospitality and harvest. Each has an explicit trade-off. **Balance simulation: not run — Unverified.**
