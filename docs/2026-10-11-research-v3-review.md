# Offline photo reconstruction V3

Production is unchanged. `calibratePhotoResearchV3` is not called by `analyzeOne`. This review does not authorize a deployment or push.

Six 2026-10-08 screenshot cases: standard has 10/22 prices within 1.5 with matching roles, 4/22 exact prices and 1/12 exact visible bands. V3 qualified mode has 16/22, 14/22 and 5/12. The explicitly absent second support is separate: standard/V2 have one extra, V3 has zero.

V3 applies first-support moving-average expansion to second support, rejects a second band backed solely by the lower edge of the same gap used by first support, and excludes filled gaps and volume lows as standalone pressure candidates. Independent pivot evidence at the same price remains eligible. The rejected gap edge remains a reviewable risk boundary; a separate lower band is searched next. Event independence and pressure requalification are hypotheses, not recovered screenshot rules. Pressure-only gap exclusion preserves support-side candidates.

An alternative excludes highs subsequently closed above and allows lows to anchor second resistance. It yields 17/22 price passes and 15/22 exact prices, but only 16/22 price-and-role passes. It reproduces 6182 second resistance 140.5 while changing its breakout into ordinary resistance, so it remains an experiment.

Candidate maximum age is 120 trading sessions including age zero (up to 121 rows), bounded by available history. Volume averages include the current day. ATR14 is a simple average of true range. Support base grouping uses close * 1.25%; moving-average extension can widen the final band beyond that base width. Pressure base grouping uses ATR14 / 2.

Six main-price failures remain: 2301 breakout/second resistance, 2368 second support, 8299 second support/second resistance, 6182 second resistance. Seven of twelve visible bands differ. 2301 target 309.5 has no direct OHLC match in the saved full input; rounded turnover/volume can match but does not prove its source.

Archived five-stock retrospective comparison: 7/20 -> 8/20 price passes, 7/20 -> 6/20 exact. 2472 second support worsens; 6197 pressure regressions remain. These cases were already examined, some windows are incomplete, and this is not blind validation. Reference conformity is not trading performance.

Validation: 139 tests pass. The report renders/filters/switches modes and exactly reproduces six-stock V3 outputs offline. Production and V2 source remain an unchanged prefix. Model inputs exclude symbols, screenshot prices and date exceptions.
