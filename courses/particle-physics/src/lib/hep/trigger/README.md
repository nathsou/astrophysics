# hep/trigger: the trigger (Stage 5)

Pure TypeScript, seeded. Import as `hep/trigger`. Hook: `trigger.l1Decision` with signature `(ev: { towers: {eta, phi, et}[]; muonStubs: {eta, phi, pt}[] }, thresholds: Record<string, number>) => string[]` (names of the L1 items that fired). Reference: `referenceL1Decision`.

## level1.ts
Constants `L1_LATENCY_US = 4`, `BUNCH_SPACING_NS = 25`, `L1_INPUT_RATE_HZ = 40e6`, `L1_OUTPUT_RATE_HZ = 100e3`, `HLT_OUTPUT_RATE_HZ = 1000`, `EVENT_SIZE_MB = 1`. Towers are 0.1 × 2π/64, ET in 0.5 GeV steps. `l1Jets` (5×5 greedy windows), `l1EgCandidates` (seed + hottest neighbour, narrowness ≥ 85% of 3×3), `l1Met`, `l1Variables(ev)` (one number per item kind: SingleMu, DoubleMu, SingleEG, DoubleEG, SingleJet, DoubleJet, HT, MET), `l1Decision` (through the hook), `l1InputFromReco(reco, {rng, extra, …})`, `l1InputFromDetector(det)`, `l1LatencyBudget`. An item name like `DoubleMu_Low` is the kind `DoubleMu` with its own threshold.

## hlt.ts
`objectsOf`, selections `hltSingleMuon`, `hltMuonPair`, `hltSingleElectron`, `hltDiPhoton`, `hltSingleJet`, `hltHT`, `hltLowMassDimuon`, `metOf`; the catalogue `MENU_KINDS` (SingleMu, DoubleMu, SingleEG, DoubleEG, SingleJet, HT, MET, BPhys).

## menu.ts
`TriggerItem {name, l1: {item, threshold} | null, hlt(reco), prescale, hltPrescale?, eventSizeMB?}`, `TriggerMenu`, `TriggerEvent {reco, detector?, l1?, weight?, fiducial?}` (a `FullEvent` fits), `Sample {name, sigmaPb, events}`. `evaluateMenu(events, menu, {rng?})` → per-event decisions (passed, fired after prescales, expected acceptance probabilities). `estimateRates(samples, menu, {lumi, deadTimeS})`: rate = σ·L·(weighted efficiency) per item and in total with overlaps counted once, binomial/weighted errors, per-item unique rates, overlap matrix, dead time (`liveFraction`), bandwidth. `bandwidth(rate, sizeMB)`, `physicsLost(menu, samples)` (efficiency for each sample, in total and in acceptance), `weightedEfficiency`, `effectiveEvents`, `rateHz`. `CatalogueEvaluator` is a fast evaluator for interactive use (same numbers, tested), `menuFromSettings`, `itemFromSetting`.

## turnon.ts
`erf`, `turnOn(x, {plateau, x50, sigma})`, `turnOnQuantile`, `efficiencyCurve(values, passed, edges)`, `fitTurnOn(points)` (Nelder–Mead χ² fit).

## toy.ts and game.ts
`generateToySamples({seed, nPerSample, only})`: minimum bias, dijets (both stratified in hard scale with weights), W → ℓν, Z → μμ, top pairs, H → γγ, H → 4ℓ, a SUSY-like benchmark, low-pT B → J/ψ X. Cross-sections are rounded, illustrative 13.6 TeV values (see the comment at the top of `toy.ts`). `game.ts`: `startSettings`, `suggestedSettings`, `looseSettings`, `SETTING_RANGES`, `PRESCALES`, `scoreReport(report, budget, only?)` (over budget → every sample loses budget/rate).

## Approximate
L1 latency split, dead time per accept (100 ns), L1 tower and stub model, all cross-sections and acceptances are toy values.
