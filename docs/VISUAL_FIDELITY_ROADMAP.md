# TransRoyal — Visual Fidelity Roadmap

Companion to `ART_DIRECTION_AUDIT.md`. Still a planning document — no code changes. Every recommendation below is classified by type (Code / Art Direction / Asset / Environment / Nice-to-Have) and rated on three axes: **Visual Impact**, **Implementation Effort**, **Performance Impact** (Low/Medium/High).

A note on performance before the list: today this project loads **zero binary assets** beyond a procedurally-generated environment map — every chapter is built from primitive geometry at runtime, so load time and GPU cost are both currently near-zero. Any real GLTF model (Phase 2A) is a genuinely new performance surface: network payload, texture memory, draw calls. Ground alone stages **9 vehicle instances** (4 highway trucks, 2 dock/queue trucks, 1 service vehicle, 2 forklifts) from one shared `createTruck()`/`createForklift()` function — a real-model swap needs to preserve that instancing discipline (shared geometry/materials across instances, and likely a simpler LOD for the distant highway fleet vs. a detailed model for the foreground dock trucks) or it trades a low-poly problem for a frame-rate problem.

---

## Asset Improvement
*Needs a sourced or commissioned model/texture — not achievable by tuning code.*

| Item | Visual Impact | Effort | Performance | Notes |
|---|---|---|---|---|
| Cargo aircraft (Air) | **High** | High | Medium-High | The audit's #1 finding — widest lens (62°), largest scale (2×) in the project. One instance, so performance cost is contained to a single model; still needs real UVs/textures to justify the swap, not just higher poly count. |
| Forklifts (Ground) | Medium | Medium | Low | Only 2 instances, close to camera in the dock's foreground — proportionally more exposed per-instance than the highway trucks. I'd rank this **above** plain trucks, ahead of your stated order, precisely because of that camera proximity. |
| Cargo containers / ULDs (Ground, Air) | Medium | Medium | Low | Shared color motif already ties Ground's containers to Air's cargo pod — a real ULD shape would strengthen that "same shipment" thread across chapters for free. |
| Trucks (Ground, Pickup, Final Mile) | Medium | Medium-High | Low-Medium | Highest instance count of any vehicle (9 across 2 chapters plus Pickup's van) — needs instancing/LOD discipline more than any other swap on this list. |
| Human figures (Pickup, Final Mile, + new placements) | Medium-High | Medium-High | Low | People read strongly to viewers relative to their triangle cost — likely better visual-impact-per-effort than the vehicle swaps, just harder to pose/animate believably than to model. |
| Real photographic HDRI | Medium | Low once sourced | Low | Manifest-only code change per the existing design (`Environment.js`'s own comment already anticipates this) — the only blocker is you sourcing/licensing a file. Cheapest item on this entire list once that's solved. |
| Warehouse/airport support equipment (loading bridges, baggage carts, cargo dollies) | Low-Medium | Medium | Low | Lower priority than the hero assets above — these read as background detail, not subjects the camera lingers on. |

---

## Code Improvement
*Achievable now, no new assets, extends the existing architecture.*

| Item | Visual Impact | Effort | Performance | Notes |
|---|---|---|---|---|
| Sorting: diverter beat (parcel visibly routes at a junction) | Medium-High | Low-Medium | Negligible | Closes the audit's clearest copy/visual mismatch. Uses the exact primitive vocabulary already in `SortingEnvironment.js`. |
| Pickup: vehicle/driver idle vibration + wheel micro-motion | Medium | Low | Negligible | Reuses the idle-sine/`rollWheels` idiom already built 3× elsewhere (Ground, briefly Sorting's parcels). An afternoon of work, not a redesign. |
| Final Mile: van idle vibration + wheel micro-motion | Medium | Low | Negligible | Same pattern as above. |
| Final Mile: a real arrive→unload→confirm choreography cycle | Medium-High | Medium-High | Negligible | This is the one "code improvement" that's really a new system, not a small addition — a simplified version of Ground's dock-cycle state machine, scaled to Final Mile's much calmer, "motion mostly stopped" character. Worth scoping as its own small phase, not bundled with the quick wins above. |
| Pickup: a real scan *event* (not just an ambient pulse) | Medium | Medium | Negligible | Needs a discrete trigger (parcel placed → scan flash → confirmation), which means Pickup's currently-static "mid-scan" moment becomes an actual beat with a beginning and end. |
| More figures using the existing capsule+sphere vocabulary (forklift operator, ramp agent, warehouse worker, ground marshal) | Medium | Low-Medium | Low | Cheap presence wins using assets that already exist — pairs with the Asset Improvement figure upgrade above rather than replacing it; do this first, upgrade fidelity later. |

---

## Art Direction Improvement
*Composition/staging decisions — cheap to execute, but need deliberate authoring, not a system.*

| Item | Visual Impact | Effort | Performance | Notes |
|---|---|---|---|---|
| Pickup: verify/fix scanner-as-hero-focal-point composition | Medium | Low | None | The audit flagged this as a likely mismatch between documented intent and built scale/position — needs a live render check before deciding whether it's a camera framing fix or a scanner scale/position fix. |
| Sorting: give one parcel per lane a visual distinction (so *something* reads as the shipment being followed) | Low-Medium | Low | None | Currently all 12 parcels are interchangeable; even a single color/size variant on one parcel per pass would give the eye something to track. |
| Origin: a restrained sense of operational life without breaking its deliberate stillness | Low-Medium | Low-Medium | Low | Tension to manage carefully — Origin's calm is intentional; this isn't "add motion," it's "add one quiet detail" (a console glow, a distant silhouette) that doesn't compete with the architecture. |

---

## Environment Improvement
*Set dressing — split by whether it's achievable with the existing primitive vocabulary or genuinely needs a real model.*

**Buildable now with primitives (effectively Code Improvement in disguise):**

| Item | Visual Impact | Effort | Performance |
|---|---|---|---|
| Utility poles, extra fencing variety, windsocks (cone + pole) | Low | Low | Low |
| Roof-mounted HVAC/equipment boxes on existing buildings | Low | Low | Low |
| Additional yard clutter in Pickup/Final Mile (Ground's own cone/bollard/signage density hasn't been matched elsewhere) | Low-Medium | Low | Low |

**Needs a real model to read correctly (really Asset Improvement):**

| Item | Visual Impact | Effort | Performance |
|---|---|---|---|
| Jet bridges / loading bridges | Low-Medium | Medium-High | Low-Medium |
| Baggage/cargo dollies | Low | Medium | Low |
| Taxiway lights, runway signage | — | — | — |

That last one needs a flag, not a rating: Air's flight path was deliberately built with **no literal runway or ground-level content** (confirmed earlier this project). Taxiway/runway signage directly conflicts with that standing decision — same issue as the Ground→Air object-relay idea from a prior session. Don't add it without first deciding to reopen that constraint.

---

## Nice-to-Have

| Item | Visual Impact | Effort | Performance |
|---|---|---|---|
| Heat-haze/shimmer near engines or exhaust | Low | Low-Medium | Low-Medium |
| More background/parked vehicles for incidental clutter | Low | Low | Low |
| Ground→Air literal object relay | Low | High | Low |

---

## My recommended sequencing

Your instinct to lead with hero-asset replacement is right, but I'd stage it against risk and dependency rather than pure priority order:

1. **Source the HDRI first** — it's the cheapest item on the entire roadmap once you have a file (manifest-only), benefits every chapter simultaneously, and de-risks nothing about the harder asset work, so there's no reason to sequence it last.
2. **Cheap code wins in parallel** — Sorting's diverter, Pickup/Final Mile idle motion, extra figures using the existing vocabulary. All low-effort, all close real gaps the audit found, none blocked by asset sourcing.
3. **Aircraft replacement** — the single highest-leverage asset swap, and the one most worth doing carefully (instancing/LOD isn't a concern here since there's only one instance, so this is really about sourcing/integrating a genuinely good model).
4. **Forklifts, then containers/ULDs, then trucks, then human-figure fidelity, then support equipment** — in that order, weighted by visual-impact-per-effort rather than your original category order. Trucks are lower on my list than yours specifically because of the instancing/LOD work required across 9 instances in two chapters.
5. **Environment/nice-to-have props last** — genuinely lower leverage than anything above; don't let set-dressing compete for time against the hero-asset and code-consistency work.

Still not proposing to implement anything — this is the roadmap for you to prioritize against. Once you tell me which numbered items to greenlight, I'll convert those specifically into a scoped technical/implementation plan (Phase 2 proper) before any code changes.
