# TransRoyal — Hero Asset Specification

Companion to `VISUAL_FIDELITY_ROADMAP.md`. Defines exactly what a replacement model needs to satisfy before it's worth integrating — grounded in this project's actual camera distances, scale conventions, and the animation rig each asset currently drives. No code changes.

---

## Cargo Aircraft (approved — the one asset in scope right now)

**Purpose in the scene.** The sole hero object of the Air/Global Logistics chapter — the entire chapter's motion story (departure → climb → cruise/bank → descent → arrival) is built around it, and the camera/lighting are authored specifically to showcase it (2× scale, the widest lens in the project at 62° FOV, the highest environment-reflection intensity in the journey at 1.5×). It's also now the subject of the small distant-aircraft echo in Final Mile's opening frame — so its silhouette and color identity need to stay recognizable at both hero scale and thumbnail scale.

**Typical camera distance.** Computed from the actual flight path (`FLIGHT_WAYPOINTS` in `AirEnvironment.js`) against the `air` shot's camera position: roughly **100–280 world units**, closest at departure (P0), farthest near arrival (P5). Never an extreme close-up.

**Screen occupancy.** At the project's current aircraft scale (~32-unit effective wingspan after the 2× scale-up) and 62° FOV, the aircraft occupies roughly **10–20% of frame height** through most of the flight — a large, clearly dominant midground subject, but not filling the frame. This is the number that should drive the detail budget below: big enough that medium-frequency detail (window bands, panel breaks, engine nacelle shape, gear doors) reads clearly; not big enough that rivet-level micro-detail would ever be visible.

**Minimum geometric detail.**
- A fuselage with real curvature, not a flat-sided box.
- A visible window-strip (geometry or a baked texture band — either is fine at this viewing distance).
- Wings with taper/dihedral, not a flat slab.
- Distinct engine nacelles (not a bare cylinder).
- A proportioned tail assembly (vertical + horizontal stabilizer).
- Landing gear that can visually retract/extend (see animation requirements — this can be a separate low-detail sub-mesh; it's rarely the on-screen focus).
- Target polygon budget: **~15k–40k triangles**. This is a single-instance asset shot at 100+ units away — a 200k+-triangle "photoreal" asset would be pure waste here.

**Required material fidelity.** Albedo + roughness + metalness at minimum (matches the existing `MeshStandardMaterial` convention already used everywhere). A normal map is the highest-value addition — it sells panel lines/rivets at this viewing distance without needing that geometry. An AO map helps the engine-nacelle and wing-root shadowing read correctly under the project's strict two-light doctrine (no ambient fill beyond the environment map). Texture resolution: **1K–2K per map is enough** — the project's own on-screen size doesn't justify 4K, and larger textures cost real load time for a scroll-triggered site.

**Animation requirements — the rig this asset must support, not just look like.** This is the part most likely to get skipped and cause integration pain. The current procedural aircraft drives all of the following, and a replacement needs equivalent hook points or this becomes a much bigger rewrite than "swap the geometry":
- Built/oriented along the local **−Z axis** (nose at −Z), because `aircraft.lookAt(curve point)` depends on that orientation with no extra rotation offset. A model authored facing +Z or +X needs either re-export or a compensating rotation added in code.
- A **separate cargo-pod mesh/node** — it currently gets independent bank-lag sway (trails the fuselage's own roll on its own half-life), so it can't be fused into the fuselage geometry.
- **Two separate flap pivot groups** (one per wing), hinged at their leading edge, so they can droop convincingly during the deploy window.
- A **separate gear node** that can scale/animate from retracted to extended.
- A discrete **emissive region at each engine's rear** (currently a small glowing disc) whose brightness tracks thrust.
- Attachment points for a beacon light and a taxi light (currently plain `PointLight`s parented to the fuselage — any position works, as long as they exist).
- Compatible with the existing `scale.setScalar(2)` hero-scale convention, or the flight waypoints and camera framing need retuning to match the new model's natural proportions.

**Estimated performance budget.** Generous relative to the multi-instance assets below, since this is a **single instance**: ≤40k triangles, ≤4 texture maps (albedo, normal, ORM-packed roughness/metalness/AO) at ≤2K each, ideally one or few draw calls (avoid heavy sub-mesh/material fragmentation), and compressed (Draco/meshopt geometry + KTX2/Basis textures) to keep the file well under 10MB given this loads over the network via the existing `Resources`/manifest system, which already supports async/lazy loading per-entry.

---

## Other candidates — condensed spec, for the later reassessment step only

Not in scope for replacement yet per your own sequencing (Track A/B first, then reassess). Captured now so the "Reassess" step has a real starting point instead of a blank page.

| Asset | Camera distance | Screen occupancy | Instance count | Key animation hooks that must survive |
|---|---|---|---|---|
| Forklifts (Ground) | Close — dock foreground/midground | Medium-large per instance despite small size, due to proximity | 2 | Separate fork-tine group (lift/lower), separate mast (sway), separate cargo box (load reveal), 4 independent wheels (roll), beacon light |
| Cargo containers/ULDs (Ground, Air) | Close-mid (Ground dock), mid (Air cargo pod) | Small-medium | 6 pallets + containers (Ground), 1 cargo pod (Air) | Scale-based reveal (pallets), independent bank-lag (Air's cargo pod) |
| Trucks (Ground fleet + dock, Pickup van, Final Mile van) | Highway trucks: distant/background. Dock trucks: close/foreground. Pickup/Final Mile vans: close, static | **Highest instance count in the project (9+ across 2 chapters, plus 2 more vans)** | 11+ | Independent front-wheel steering yaw, 4 wheels/instance (roll), headlights/tail lights/indicators, exhaust + dust particle attachment points — this is the asset most likely to need LOD (simple distant-highway version vs. detailed dock-foreground version) given the instance count |
| Human figures (Pickup, Final Mile, + future placements) | Close-mid | Small individually, but high perceptual weight | 2 today | Currently zero animation (fully static) — any replacement should budget for at minimum idle weight-shift, ideally a walk/work cycle if used for a ramp agent or forklift operator |

---

## What this spec is for

Before replacing any asset, check it against its row above. If a candidate model can't satisfy the animation-hook requirements without a rewrite of the choreography code that drives it, that's a real cost to weigh against the visual gain — not just a modeling checklist.
