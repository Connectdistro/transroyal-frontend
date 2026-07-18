# TransRoyal — Art Direction Audit

Produced as a Creative Director / cinematography review, not an engineering document. No code was changed to produce this — it's a read-only audit of all seven chapters plus the shared camera/lighting/material systems, written to separate three kinds of problems: what code can fix today, what needs a higher-fidelity asset, and what's a cinematic-direction/staging decision.

## The rendering pipeline, honestly assessed

Before the chapter-by-chapter breakdown, the ceiling every chapter operates under:

- **Already solid:** ACES Filmic tone mapping, sRGB color pipeline, soft PCF shadow maps, `MeshStandardMaterial` everywhere (a real PBR lighting model — roughness/metalness respond to light correctly), per-instance material jitter (`varyMaterial`) so nothing reads as stamped copies, a working `scene.environment` reflection map, and — as of this session — continuous camera/fog/light/activity blending across every chapter boundary.
- **The real ceiling:** the environment map is a PMREM baked from the site's own flat gradient background, not a photographic HDRI — reflections exist but only ever reflect a smooth gradient, never real-world detail. Every material is a flat authored color with **zero texture maps** (no normal/roughness/AO/albedo images anywhere in the project). Every object is hand-built from primitive geometry (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `CapsuleGeometry`) — `GLTFLoader` is wired into the resource pipeline and has never been pointed at a real model.
- **A world-wide color decision, not a bug:** all seven chapters share one navy/electric-blue family, only tint-shifting warm or cool per chapter. Consistent and distinctive; also part of why the world reads more "brand film" than "documentary."
- **A world-wide population decision, worth naming:** across all seven chapters there are exactly **two human figures** (Pickup's driver, Final Mile's figure), both a capsule + a sphere with no limbs, face, or clothing detail. No workers anywhere else — no one in Sorting, no forklift drivers visible in their seats in Ground, no ground crew in Air. A logistics operation is fundamentally staffed by people; this world reads as almost entirely automated, which pulls it toward sci-fi-automation rather than "real operation."

---

## Scene 01 — Origin

**Hero Object.** None literal. The receding illuminated structural ribs and the pulsing route line ARE the subject — an architectural establishing shot, not an object-driven one.

**What the viewer notices first.** The glowing rib/arch tunnel receding into fog (confirmed via live capture), echoed by the thin electric-blue strip along each beam.

**Visual Story.** "The network exists, vast and orchestrated, before any single shipment enters it." A pure establishing beat — deliberately no narrative motion.

**Shot Composition.**
- Foreground: route-line glow, nearest to camera.
- Midground: seven repeating rib arches, each slightly larger than the last.
- Background: a suspended walkway on cables, deep in fog.

**Motion Direction.** Only particle drift and a route-line pulse. Zero operational activity — no vehicles, no people, no visible "command center" function despite the copy calling it one. On a second scroll-through, the frame is identical to the first.

**Lighting Mood.** Warm sunrise key, royal-blue fill, the lightest haze in the journey.

**Environmental Details.** Floor, ribs, walkway, particles — nothing else. No monitors, consoles, or signage to justify "Command Center."

**Transition Into Next Chapter.** First chapter — no "entering" corridor. Camera/fog/light now blend continuously toward Pickup (shipped this session).

**Asset Limitations.** None meaningful — this scene is intentionally abstract architecture, so primitive geometry is the *right* level of fidelity here, not a compromise.

**Animation Limitations.** The gap is narrative, not technical: an "opening establishing shot of a Command Center" with zero human or operational activity reads static on a repeat view.

**Overall Realism Score.** Not applicable as literal realism (intentionally abstract). As a cinematic opening beat: **7/10**.

---

## Scene 02 — Pickup

**Hero Object.** The handheld scanner — explicitly documented in the production handbook as "the sharp foreground focal point."

**What the viewer notices first.** Likely the cargo van and driver, not the scanner. The scanner mesh is 0.16×0.26×0.06 world units, roughly 16+ units from camera at this shot's framing — genuinely worth a live-render check, but the numbers say it's a small fraction of the frame next to a 3.4×3×6.5 van. **Flagging this as a probable composition mismatch between documented intent and built geometry, not a confirmed one** — verify with a render before acting.

**Visual Story.** "One scan starts the chain of custody." But nothing is animated to depict a scan *happening* — no parcel placement, no scan-beam sweep, no confirmation flash tied to an actual event. The scanner's light idly pulses forever, with no beginning, middle, or end to "the scan" as a moment.

**Shot Composition.**
- Foreground: scanner (by intent).
- Midground: vehicle + driver, both frozen mid-scan.
- Background: ribbed dock facade, recessed panel.

**Motion Direction.** The vehicle and driver are **completely static** — explicitly authored that way ("a deliberate narrative moment"). No idle vibration, no wheel detail, no driver weight-shift. This is the least animated populated chapter in the journey; even Ground's cruising-fleet trucks get idle vibration.

**Lighting Mood.** Bright morning, electric-blue key.

**Environmental Details.** Solid architecture (ribbed facade, bay, canopy) but no yard clutter — no cones, no other vehicles, no other people.

**Transition Into Next Chapter.** Route-line only; no visual moment of "the parcel leaves the scanner."

**Asset Limitations.** Van/driver share the project's flat-primitive vocabulary — not the primary issue here.

**Animation Limitations.** The primary issue. A frozen tableau under copy that promises action ("Begin Your Journey").

**Overall Realism Score.** **4/10** — strong architecture undercut by a scene that doesn't move.

---

## Scene 03 — Sorting

**Hero Object.** Nominally the parcels, but no single parcel is emphasized — twelve identical boxes moving at identical speed down three dead-straight lanes.

**What the viewer notices first.** The repeating scan-arch tunnel (visually similar language to Origin/Pickup's ribs) and the parcels sliding beneath it.

**Visual Story — the clearest mismatch found in the whole audit.** Copy: *"Automated routing reads every label and sends each shipment down the fastest verified path."* That's a branching/decision claim. The actual visual shows zero branching, diverting, or merging — parcels travel in straight parallel lines forever. There is no visual "routing" happening anywhere in this scene; it's a conveyor, not a router.

**Shot Composition.**
- Foreground: nearest conveyor lane.
- Midground: repeating scan arches.
- Background: hazy vanishing point.

**Motion Direction.** Parcels ease-accelerate/taper/reset well (good technique), arch glow pulses, one ambient beacon. But there's no interaction — no diverter arm, no robotic sorting mechanism, no human QC checkpoint, despite a proof point literally reading "Continuous quality checks."

**Lighting Mood.** Industrial neutral, royal-blue-leaning key.

**Environmental Details.** Solid repeating structure, but nothing that visually explains "automated routing" as a mechanism.

**Transition Into Next Chapter.** Route-line only.

**Asset Limitations.** Box parcels are fine at this level of abstraction — not the issue.

**Animation Limitations.** The routing/branching the copy promises has no visual counterpart at all, even abstractly. This is a **code-fixable, no-new-assets** gap: a diverter arm nudging a parcel sideways at a junction, using the exact same primitive vocabulary already in this file, would close it.

**Overall Realism Score.** **5/10** — pleasant ambient motion, disconnected from its own narrative claim.

---

## Scene 04 — Ground

**Hero Object.** The dock/yard operation as a whole — the most choreographed, causally-connected chapter in the project (full arrive → queue → dockOpen → unload → dockClose → depart → gap cycle).

**What the viewer notices first.** The dock building and staged trucks from an elevated wide angle, highway fleet receding in the far background (confirmed via live capture).

**Visual Story.** The clearest and most legible in the journey — a single continuous operational cycle that actually matches its copy ("fleet in constant motion").

**Shot Composition.**
- Foreground: yard markings, cones, tire dust (new this session).
- Midground: dock cluster, staged trucks, forklifts, pallet stack.
- Background: highway fleet, hub silhouettes.

**Motion Direction.** The richest in the project: wheel roll, front-wheel steering yaw, brake-dive, body roll, forklift lift/lower/mast-sway, dock-door motion, pallet reveal + settle-bounce, exhaust + dust particles, turn signals, headlights, a door-motion warning beacon, wind-gust-modulated cable/pennant sway, and camera anticipation tied to the dock truck's own braking.

**Lighting Mood.** Golden afternoon; the densest ground-level haze in the journey.

**Environmental Details.** Genuinely dense — signage, bollards, security fencing, a fire box, wheel stops, dock bumpers, hazard striping.

**Transition Into Next Chapter.** Camera/fog/light now blend continuously into Air, but the actual geometry never shares a frame — Ground's tallest content tops out around y≈9; Air's flight path starts at y=48. A 39+ unit gap with nothing built in it (confirmed by both live capture and coordinate math, from an earlier session this week). The handoff is a camera glide through empty space, not an object relay.

**Asset Limitations.** Same flat-primitive trucks/forklifts as everywhere else, but density and material variation carry this chapter better than most — it's shot from far enough back that primitive geometry reads fine.

**Animation Limitations.** Genuinely minor at this point. This chapter is close to the ceiling of what's achievable without new geometry.

**Overall Realism Score.** **7/10** — the strongest chapter in the project. Primitive geometry is the only thing capping it higher.

---

## Scene 05 — Global Logistics (Air)

**Hero Object.** The cargo aircraft — deliberately scaled 2× to read as hero against the vast landmass.

**What the viewer notices first.** The aircraft banking against the landmass and cloud layer, the delivery thread growing beneath it (confirmed via live capture).

**Visual Story.** The strongest "complete operation" narrative in the project — origin vignette → climb → cruise/bank → descent → arrival, one continuous curve, seamlessly looped with a hold-then-reset.

**Shot Composition.**
- Foreground: light trails, cloud layer.
- Midground: the aircraft.
- Background: landmass, sparse city-block silhouettes.

**Motion Direction.** Rich: banking, gear/flap staging, a liftoff rotation-pitch, cargo-pod sway-lag, engine glow tied to thrust, nav lights, an anti-collision beacon, taxi lights, a sunlight-catching-fuselage ramp on approach, wingtip jitter.

**Lighting Mood.** Cool blue atmosphere; the brightest environment-reflection intensity in the journey (1.5×) — the aircraft's fuselage is specifically built to catch and show that reflection.

**Environmental Details.** Landmass city blocks (60 small boxes — genuinely toylike at this scale, worth naming), a cloud layer, light trails.

**Transition Into Next Chapter.** The one object relay in the project — a small distant-aircraft echo fades into Final Mile's opening frame as the delivery van becomes hero, verified live via real scroll this session.

**Asset Limitations. THE single biggest asset-fidelity blocker in the project.** The aircraft is built from box primitives — a rectangular fuselage, a flat wing slab, cylinder engines — with zero surface detail: no window strip, no panel lines, no gear-door seams, no fuselage curvature. It's the hero of the widest-FOV shot in the entire journey (62°, versus 35-38° everywhere else), scaled up specifically to dominate frame. That combination — widest lens, largest on-screen presence, most exposed silhouette — is exactly where low-poly geometry is most visible to a viewer. No amount of additional banking or lighting nuance changes this; it needs a real model.

**Animation Limitations.** Minor. Motion is already the richest in the project; the ceiling here is geometry, not animation.

**Overall Realism Score.** **6/10** — best motion storytelling in the project, held down hardest by asset fidelity because it's the most exposed hero shot in the journey.

---

## Scene 06 — Final Mile

**Hero Object.** The delivery van, plus the new distant-aircraft echo in the sky.

**What the viewer notices first.** The houses-and-van cluster in the lower-left foreground, the small aircraft silhouette in the upper sky (confirmed via live capture this session).

**Visual Story.** "Last leg of the journey" — matches the copy reasonably well.

**Shot Composition.**
- Foreground: van, houses.
- Midground: street, routing indicator, route line.
- Background: the new distant aircraft.

**Motion Direction.** Same gap category as Pickup: the van and the figure are **completely static** — no wheel roll, no idle vibration, no walking motion on the figure despite it presumably representing an in-progress delivery. Only the routing indicator's pulse and route-line pulse (plus, now, the aircraft fade) carry any life. Some stillness here is a documented, deliberate choice ("deliberately less motion than any chapter since Origin") — but a fully frozen van, with zero idle vibration, feels like an oversight rather than a directorial decision, since even Ground's parked/queued trucks get idle vibration.

**Lighting Mood.** Royal-blue leaning, calm.

**Environmental Details.** Houses, curb, street, a single figure — thinner than Ground's yard, appropriately so for a residential street.

**Transition Into Next Chapter.** Corridor-blends into Delivered, the one deliberately fully-static chapter — motion receding toward Delivered's stillness is the *right* direction for this handoff, not a flaw.

**Asset Limitations.** Same flat-primitive vocabulary; the figure (capsule + sphere, no limbs/face) is the weakest human representation in the project alongside Pickup's driver.

**Animation Limitations.** The van should at minimum get idle vibration/wheel micro-motion to match the baseline Ground already established, even while staying parked.

**Overall Realism Score.** **5/10**.

---

## Scene 07 — Delivered

**Hero Object.** The parcel on the doorstep — explicitly documented as "the sole sharp subject in frame."

**What the viewer notices first.** The parcel, by design — everything else recedes around it.

**Visual Story.** The resolution beat: tension released, delivery complete. Deliberately, explicitly static — *"the one chapter in the entire journey where motion fully stops."* This is a real directorial choice and it **works**: it's the one place in the journey where stillness is earned by contrast with everything before it.

**Shot Composition.**
- Foreground: parcel.
- Midground: doorstep, facade.
- Background: implied house, porch light.

**Motion Direction.** None — intentional.

**Lighting Mood.** Softest haze alongside Origin, closing the color loop the journey opened with.

**Environmental Details.** Minimal by design — doorstep, facade, door, porch light.

**Transition Into Next Chapter.** Final chapter.

**Asset Limitations.** None meaningful — the scene's simplicity matches its intended abstraction.

**Animation Limitations.** None — a correctly executed choice, not a gap.

**Overall Realism Score.** Not applicable as literal realism; as a directorial beat: **8/10**.

---

## If this were entered into Awwwards / FWA / CSS Design Awards today

Ranked by impact × effort — what would actually cost it recognition, not a minor-polish checklist.

| # | Blocker | Impact | Effort | Fix type |
|---|---|---|---|---|
| 1 | Aircraft's primitive-box geometry, exposed at the widest lens and largest scale in the project (Air) | **High** | High | **Asset** — needs a real model, not animatable away |
| 2 | Sorting's copy promises branching/routing; the visual shows a straight conveyor with zero divergence | **Medium-High** | Low-Medium | **Code** — a diverter beat using existing primitives |
| 3 | Pickup and Final Mile's hero vehicles (and all human figures) are completely frozen while Ground/Air are richly animated — the inconsistency reads as a bug, not a choice | **Medium** | Low | **Code** — reuse the idle-vibration/wheel-roll pattern already built 3× in this codebase |
| 4 | Only two human figures exist across all seven chapters; the world reads automated rather than staffed | **Medium** | Medium | **Code + light asset work** — cheap geometry, real design iteration to pose/animate believably |
| 5 | Monochromatic navy-only palette world-wide | **Low-Medium** | N/A | **Direction call, not a bug** — flagging for awareness, not recommending a change |
| 6 | Environment reflections come from a flat procedural gradient, not a photographic HDRI | **Low-Medium** | Low once sourced | **Asset** — manifest-only code change, needs a licensed HDRI file from you |
| 7 | Ground→Air has no object relay (unlike the new Air→FinalMile one) | **Low** | High if pursued literally | **Direction call** — my recommendation stays: skip; the camera/light glide already sells continuity, and building it properly means reopening the "no literal runway" decision |

**My read:** #1 is the one item on this list I can't move — it needs a sourced or commissioned model. #2 and #3 are both genuinely cheap, code-only fixes that would measurably tighten the project's internal consistency (the same standard Ground and Air already meet). #4 is worth doing but is real design work, not a quick pass. #5–7 are calls to make, not bugs to fix.
