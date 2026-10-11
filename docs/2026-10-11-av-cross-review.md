# AV cross-model review (offline only)

AV formulas were read from current GitHub main `av-stock-levels/worker/index.js`, blob `fa2087c78daaba5e30b5370c5084d6e06d3aaf1e`. A4/A3/A2/A1/AQ and VQ/V1/V抓/V2 are defined; V3 is undefined and stays blank. The original AV display preserves full arithmetic and shows two decimals, with no trading-tick or band formula.

Using the same six 2026-10-08 closes, target-dependent nearest AV matching is 11/22 before tick rounding and 13/22 after rounding (3 exact). These are optimistic arithmetic ceilings, not a target-independent selector. Sixty fixed support/pressure slot mappings top out at 11/22. Those slots cannot infer breakout roles, construct bands, or suppress the explicitly absent 6213 second support.

The research function `calibrateAvReview` first runs V3. In guarded-breakout mode it changes only an existing breakout's main price when tick-rounded A1 lies inside the unchanged band and within one trading tick of an in-band confirmed pivot high. It does not add historical evidence, change bands, infer new roles or use reference targets.

6182 changes 130 -> 131.5, backed by confirmed high 131 and AV A1 raw 131.322. Its band stays 130–133, different from reference 131.5–135. Other five current cases have no changes. Exact main matches rise 14/22 -> 15/22; price-and-role tolerance matches remain 16/22 and band matches 5/12. Six larger main errors remain. This guarded rule is a fitted hypothesis, not a recovered original algorithm.

Archived five-stock V3 -> AV price tolerance passes rise 8/20 -> 9/20, but price-and-role passes remain 8/20. 6285 changes breakout 258 -> 260.5 near reference ordinary resistance 260; its role remains wrong. Other four selected outputs stay unchanged, including V3 regressions in 2472 and 6197. This comparison is retrospective, not blind.

Validation: 149 tests pass, including exact original AV arithmetic, undefined V3, immutable input, unchanged bands/roles and qualification evidence. The HTML report filters and reproduces all six current results offline. Existing production, AV project and V3 functions are unchanged. New functions are not wired to either live analysis entry. No push or deployment.
