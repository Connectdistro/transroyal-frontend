# TransRoyal — Track A/B Implementation Plan

Converts the approved work (cinematic direction + procedural materials/lighting) into scoped, small, independently-verifiable commits, matching this project's own existing commit granularity. Aircraft sourcing and HDRI remain deferred. Still no code written — this is the plan for approval before Phase 3 (implementation).

## The creative backbone

Every chapter now has a dramatic question, an emotional outcome, and — except Act I, which is a pure "before the story begins" establishing beat by design (your own decision-moment list already omits it) — one unmistakable decision moment.

| Act | Chapter | Dramatic Question | Emotional Outcome | Hero Object | Decision Moment | Current Status |
|---|---|---|---|---|---|---|
| I | Origin | Can this shipment begin its journey? | Commitment | The network itself (architecture) | — (establishing beat, no decision) | N/A by design |
| II | Pickup | Will it be collected safely? | Confidence | Cargo van + driver | Driver closes the cargo door | **Missing** — van/driver are 100% static |
| III | Sorting | Can the network make the right routing decision? | Intelligence | The conveyor line | Diverter sends a parcel down the correct lane | **Missing** — parcels move in straight lines only |
| IV | Ground | Can thousands of operations work together? | Coordination | The dock/yard operation | Forklift transfers cargo to the outbound truck | **Missing** — forklifts never interact with the departing truck |
| V | Global (Air) | Can distance be conquered? | Global reach | The cargo aircraft | Aircraft rotates and lifts off | **Already built** (Logistics Choreography Phase, Commit 5) |
| VI | Final Mile | Can the shipment reach its destination? | Anticipation | Delivery van + parcel | Driver takes possession of the package | **Missing** — no parcel object exists in this chapter yet |
| VII | Delivered | Was the promise fulfilled? | Satisfaction | The doorstep parcel | Status resolves from "In Transit" to "Delivered" | **Missing, but not a 3D fix** — see below |

---

## Track A — Cinematic direction (decision moments)

### A1. Pickup — the door-close beat
**Reuses:** the target+damped-ease idiom every chapter already uses (a `*_HALF_LIFE_MS` constant, a phase timer), and the door-slide technique Ground's dock door already established (`GroundEnvironment.js`'s `doorTargetY` pattern).
**New:** a rear door sub-mesh split out of the van's current single `cargo` box, and one authored timeline: door open (initial) → held → closes slowly (matching the chapter's own documented "nothing is rushed" pace, so a much longer half-life than Ground's dock door) → held shut. Paired with the existing scanner pulse so the beat reads as two steps: scanned, then secured.
**Effort:** Medium. **Risk:** Low — additive, doesn't touch the existing scan-light system.

### A2. Sorting — the diverter beat
**Reuses:** the flap-pivot-group technique from `AirEnvironment.js` (a small hinge that rotates a flat panel), and the existing parcel position-update loop.
**New:** one small diverter arm at a junction point on one lane; one parcel per loop cycle gets a visible lateral shift timed to the arm's swing, using its own already-tracked loop index.
**Effort:** Low-Medium. **Risk:** Low — the existing 12-parcel loop is untouched except for one conditional branch.

### A3. Ground — the load-out beat
**Reuses:** the existing forklift trip-waypoint system (`FORKLIFT_DROP`/`FORKLIFT_PICKUP`/lift-height reveal) already driving the unload choreography.
**New:** one additional forklift trip, gated to the tail of `'dockClose'`/start of `'depart'`, carrying a pallet from the stack toward `dockTruck`'s position before it eases away — "one last load, just before departure."
**Effort:** Medium. **Risk:** Low-Medium — touches the dock-cycle state machine, so needs a live verify pass same as prior Ground sessions (scroll through a full 24s cycle, screenshot each phase).

### A4. Global (Air) — already satisfied
No new work. Confirmed via prior audit read of `AirEnvironment.js`: `ROTATION_PITCH_MAX`/`ROTATION_PITCH_WINDOW` already drive a liftoff rotation. Listed here only so the plan's coverage is complete, not because it needs a commit.

### A5. Final Mile — the handoff beat
**Reuses:** Delivered's own `createParcel()` visual vocabulary (same color/shape, "the same shipment" motif already established between Ground's containers and Air's cargo pod), and Ground's forklift-translate idiom for a figure moving along a short path.
**New:** a parcel mesh (doesn't exist in this chapter today), and a short cycle: figure moves from van to doorstep carrying it, hands it off, returns. This is the most substantial single item in Track A — it's a small new system, not a tweak, and should be its own commit(s), not bundled with A1-A3.
**Effort:** Medium-High. **Risk:** Medium — first chapter to add a moving human figure; needs its own live verification.

### A6. Delivered — status resolution (not a 3D change)
**Important distinction:** Delivered is deliberately, explicitly the one chapter where "motion fully stops" — adding a 3D animation here would undo a real directorial decision, not fix a gap. The decision moment belongs in the **UI/DOM layer** (`main.js`/`world.css`), not `DeliveredEnvironment.js`: a status label transitioning from "In Transit" to "Delivered" as the section activates, using the existing `scene:state-change` event this codebase already dispatches everywhere else.
**Effort:** Low. **Risk:** Low — no Three.js scene touched.

---

## Track B — Procedural materials & lighting

Scoped tightly to materials/lighting specifically — "richer silhouettes/layered geometry" from the original brief is really environment/prop work (already covered in `VISUAL_FIDELITY_ROADMAP.md`'s Environment Improvement section) and is deliberately excluded here to keep this track honest.

### B1. Close the material-variation gap
**Finding:** `varyMaterial()` — this project's own established "no perfectly uniform materials" convention — is used in `GroundEnvironment.js`, `SortingEnvironment.js`, and `AirEnvironment.js`, but **entirely absent** from `PickupEnvironment.js`, `FinalMileEnvironment.js`, and `OriginEnvironment.js` (confirmed by reading all seven files' imports). Pickup's van, Final Mile's van/houses/figure, and Origin's seven repeated rib arches all currently use flat, unvaried materials while the rest of the project doesn't.
**Fix:** apply the existing function to those materials. Zero new code beyond call sites — `varyMaterial` already exists and is proven.
**Effort:** Low. **Performance:** None (construction-time only, matching its own existing contract). **Risk:** Very low.

### B2. Ground-wear decals
**Reuses:** the exact thin-box-decal technique Ground's own yard markings already use (`createYardMarkings()`).
**New:** subtle darker "wear patch" decals at high-traffic chokepoints — Pickup's dock floor near the vehicle, Sorting's belt boundaries, extending Ground's own hazard-striping language rather than inventing a new one.
**Effort:** Low-Medium. **Risk:** Low.

### B3. Procedural industrial decals
**Reuses:** Ground's own abstract yard-signage vocabulary (flat panel + emissive edge, no font/texture pipeline — matches this project's established "real geometric shapes rather than legible characters" rule).
**New:** bay-number-style panels at Pickup's dock bay, lane-marker panels at Sorting's conveyors — reinforcing operational specificity without new assets.
**Effort:** Low. **Risk:** Low.

**Explicitly not in Track B right now:** broad shadow-quality/bias tuning (no specific defect identified to justify touching it across seven chapters) and the real HDRI swap (still deferred, needs a sourced file).

---

## Final commit order

Reordered so narrative progression lands before visual polish, and Ground is split into two independently-reviewable passes:

1. **B1** — Material variation pass.
2. **A2** — Sorting diverter.
3. **A1** — Pickup decision moment (door close, departure).
4. **A6** — Delivered UI state transition.
5. **B2 + B3** — Procedural environmental detail (decals, wear, markings).
6. **A3 Pass 1** — Ground load-out beat (the forklift-to-departing-truck transfer).
7. **A3 Pass 2** — Ground secondary layering (beacon timing, ambient vehicles, background choreography) — scoped *after* Pass 1 lands and is verified; Ground is already the most animated chapter in the project, so Pass 2 stays conservative and targeted rather than polish-for-its-own-sake.
8. **A5** — Final Mile handoff.

## Signature frame

Every chapter needs one frame someone would screenshot if they paused mid-scroll. Each commit below should be verified against its own signature frame, not just "does it run":

- **Pickup:** van parked, cargo door open, package entering, golden-hour light.
- **Sorting:** conveyor splitting, scanner active, packages diverging.
- **Ground:** forklift between trailer and dock, truck in foreground, warehouse behind.
- **Global (Air):** aircraft rotating for takeoff, airport/landmass behind.
- **Final Mile:** van stopped, driver carrying package, house behind.
- **Delivered:** parcel on the doorstep, UI reads "Delivered," camera settled.

## Quality gate

Before marking any commit in this plan complete, answer all five:

1. Did the hero object become clearer?
2. Did the logistics story become easier to understand?
3. Did realism improve without adding unnecessary complexity?
4. Does this create a better paused frame (signature frame) than before?
5. Did performance stay within the project's target (no new draw calls/instances beyond what's justified)?

Approved. Starting on #1.
