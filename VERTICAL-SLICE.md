# Vertical Slice Roadmap (VS-00 to VS-10)

This document defines the initial vertical slice implementation backlog and acceptance criteria.

## VS-00 — Define the vertical slice “done” criteria
- [x] Write and lock scope for one complete mission loop (start, objective flow, fail/success).
- [x] Ensure objective and fail conditions are visible in HUD.
- **Acceptance criteria:**
  - Mission can be started, won, and failed in one play session.
  - Objective state transitions are visible to player.

### VS-00 Locked scope (implemented)
One complete mission loop for the vertical slice is now locked to:
1. **Start:** Mission begins immediately after map generation and actor placement.
2. **Objective flow:** Primary objective is **eliminate all hostiles**; HUD shows remaining hostiles.
3. **Success:** Mission resolves to success when all enemies are in `dead` state.
4. **Failure:** Mission resolves to failure when all player operators are in `dead` state.
5. **Resolved state behavior:** Once success/failure is reached, new intents are ignored and HUD reflects final state.

## VS-01 — Deterministic seed ownership
- [x] Store `runSeed`, `missionSeed`, and `missionIndex` in authoritative game state.
- [x] Seed map generation and expose seed values in HUD/debug output.
- **Acceptance criteria:**
  - Same run seed + mission index reproduces same mission seed.
  - Same mission seed reproduces same initial mission state.

## VS-02 — Timeline recorder
- [x] Record authoritative gameplay events from intent dispatch.
- [x] Serialize/deserialize timeline event logs.
- **Acceptance criteria:**
  - Events include turn/tick, actor, intent, and result.
  - Recorder captures all state-mutating intents.

## VS-03 — Timeline replay mode
- [x] Replay a previous loop while player controls a different operator.
- [x] Add drift detection for replay mismatches.
- **Acceptance criteria:**
  - Replay runs without user input.
  - Replay mismatch emits a clear first-failure event.

## VS-04 — Objective system v1
- [x] Implement one objective type end-to-end.
- [x] Hook objective success/failure to mission success/failure.
- **Acceptance criteria:**
  - Objective transitions: active -> complete/failed.
  - Mission result reflects objective state.

## VS-05 — Enemy AI state upgrade
- [ ] Add patrol, investigate, and engage states.
- [ ] Add deterministic state transitions from perception events.
- **Acceptance criteria:**
  - Enemy patrols by default and reacts to detection.
  - State transitions are reproducible under fixed seed.

## VS-06 — Perception model v1
- [ ] Add LOS + sound-triggered memory of last-known player position.
- [ ] Expire/refresh memory deterministically.
- **Acceptance criteria:**
  - Enemy can investigate last-known position after LOS break.
  - Sound events can redirect investigate behavior.

## VS-07 — Action set v1 completion
- [ ] Complete 2–3 core tactical actions with the full selection flow.
- [ ] Ensure action AP costs and outcomes are deterministic.
- **Acceptance criteria:**
  - Actions support request -> infoNeeded -> confirm/cancel -> resolve.
  - Cancel returns cleanly to idle input state.

## VS-08 — HUD timeline/status bindings
- [ ] Show turn/tick, replay state, objective state, and seed metadata in HUD.
- [ ] Keep UI reactive to read-only game view/state.
- **Acceptance criteria:**
  - HUD updates after every relevant state change.
  - Replay vs live mode is always visible.

## VS-09 — Determinism regression harness
- [ ] Add scripted test scenario with fixed seed + fixed intents.
- [ ] Compare final state/timeline hashes against baseline.
- **Acceptance criteria:**
  - Harness fails on divergence.
  - Harness runs in CI/dev command flow.

## VS-10 — Vertical-slice mission polish pass
- [ ] Tune one mission for readability, pacing, and challenge.
- [ ] Validate first-time player clarity for objective flow.
- **Acceptance criteria:**
  - Slice is consistently completable and testable.
  - Includes at least one replay-dependent challenge.

-
