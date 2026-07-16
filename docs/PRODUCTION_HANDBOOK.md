# TRANSROYAL PRODUCTION HANDBOOK

Version: 3.1

Status: Production — Frozen. No further handbook revisions except by explicit request.

Authoritative Document

---

## Table of Contents

1. Purpose
2. Vision
3. Design Philosophy
4. Brand Personality
5. User Experience Principles
6. Storytelling Principles
7. Design Language
8. World Bible
9. Three.js Architecture
10. Rendering Pipeline
11. Camera Bible
12. Lighting Bible
13. Material Bible
14. Environment Bible
15. Motion Bible
16. Scroll Engine
17. Interaction Philosophy
18. Navigation
19. Tracking Experience
20. Typography System
21. Spacing System
22. Composition Rules
23. Scene Specifications
24. Image Generation Standards
25. Video Generation Standards
26. Asset Pipeline
27. Three.js Asset Organization
28. Performance Standards
29. Accessibility
30. QA Checklist
31. Future Expansion Rules
32. Addendum (v3.1) — Art Direction & Production Rules

---

# 1. PURPOSE

This document is the single source of truth for the TransRoyal website.

Every visual decision, engineering decision, UX decision, animation, generated asset, Three.js implementation, camera movement, lighting decision, environment, interaction, typography choice, and production workflow originates from this document.

Nothing is implemented outside the guidance contained here.

When conflicts arise, resolution follows this order:

Production Handbook

↓

Design Reference

↓

Engineering Preference

↓

Developer Opinion

The handbook always wins.

---

# 2. VISION

TransRoyal is not a marketing website.

TransRoyal is not a landing page.

TransRoyal is not a collection of webpage sections.

TransRoyal is a cinematic interactive experience that tells the complete story of a shipment travelling through the TransRoyal logistics network.

The visitor feels like they are travelling through one continuous world, not scrolling through a webpage.

The website feels closer to a modern real-time cinematic experience than a traditional webpage.

The website evokes:

• Trust

• Scale

• Precision

• Reliability

• Premium Quality

• Calm Confidence

• Engineering Excellence

The emotional response is:

"I trust these people with my shipment."

---

# 3. DESIGN PHILOSOPHY

The design philosophy is built around one governing idea: confidence rather than excitement.

The site adopts the following, exactly:

• extremely minimal interface

• massive architectural environments

• enormous negative space

• cinematic framing

• restrained typography

• premium photography

• elegant motion

• invisible interface

• confidence rather than excitement

• storytelling instead of marketing

• large environmental imagery

• slow camera movement

• soft atmospheric lighting

• premium materials

• realistic reflections

• generous spacing

• disciplined hierarchy

• calm interactions

The site never feels busy.

The site never feels futuristic.

The site never feels cyberpunk.

The site never feels like a game UI.

The site never feels like a startup landing page.

The site feels timeless.

---

# 4. BRAND PERSONALITY

TransRoyal carries itself the way a century-old shipping house carries itself: unhurried, exact, and entirely sure of its own competence.

The brand does not need to raise its voice.

The brand does not compete on excitement.

The brand competes on the quiet certainty that the shipment arrives exactly as promised.

Every design decision is filtered through one question: does this make the visitor trust the network more, or less?

Anything decorative that does not answer "more" is removed.

The personality is:

Composed. Exact. Global. Substantial. Quietly powerful.

The personality is never:

Loud. Playful. Trendy. Disposable. Aggressive.

---

# 5. USER EXPERIENCE PRINCIPLES

The environment is the hero.

The interface is secondary.

The camera is the storyteller.

The visitor notices the world before they notice the interface.

Navigation never dominates the frame.

Buttons never dominate the frame.

The experience feels calm at every scroll position.

Nothing feels rushed.

Nothing flashes.

Nothing bounces.

Nothing feels like a marketing website.

Every interaction resolves smoothly, without a hard stop, without a jarring snap.

The visitor is always oriented — they always know where they are in the journey, without needing to be told explicitly.

---

# 6. STORYTELLING PRINCIPLES

The narrative follows one shipment, start to finish, in one continuous world.

Origin → Pickup → Sorting → Ground Network → Global Logistics → Final Mile → Delivered

Every scene is one chapter in that single journey.

Every chapter belongs to the same logistics universe — the same materials, the same light, the same engineering quality, the same architecture.

The visitor never leaves the world and never re-enters it. There is no "next page." There is only "further into the network."

The shipment itself is the connective thread: a scanned label, a light trail, a moving parcel, a route line — some trace of the shipment's presence carries from scene to scene, so the story reads as continuous even as the environment transforms completely.

The story resolves, not concludes. Delivered is not an ending screen — it is the moment the tension releases, mirroring the calm of Origin and closing the loop.

---

# 7. DESIGN LANGUAGE

The design language is cool, dark, and precise.

**Palette.** A deep navy base carries every environment — the color of a night operations floor, not black, not neutral gray. Two accent families sit on top of it: an electric blue used for motion, routes, light trails, and anything in the act of moving; and a royal blue used as the constant ambient floor, present in every scene regardless of that scene's own accent. Off-white — never pure white — is reserved for highlights, practicals, and small points of human-scale light. No warm color temperature appears anywhere in the environment. The one deliberate exception is human skin, which always renders naturally, never tinted by the cool grade around it.

**Typography.** One restrained sans-serif typeface carries the entire site, set with tight tracking at display sizes and generous line height at reading sizes. Scale contrast does the work that color or weight would otherwise do — a handful of very large, very confident headlines punctuate long stretches of quiet, small-scale body copy. Nothing is bold for the sake of emphasis; emphasis is created by isolation and scale.

**Materials.** Every reflective surface — wet floors, glass curtain walls, brushed metal, vehicle bodies — is dark and tinted with its scene's accent hue. Reflections carry color. Nothing in the world reflects as flat neutral chrome or silver.

**Light.** Two sources only, always: a key light carrying the scene's accent, a fill light carrying the constant royal-blue floor. Nothing is lit flatly. Nothing is lit from more than two directions.

**Scale.** Architecture is oversized relative to the human figures that occasionally inhabit it — every space reads as built for a global network, not for a single office. Structural rhythm repeats at a consistent module across every environment, so the world reads as one continuous system of construction rather than seven unrelated sets.

**Atmosphere.** Fog and haze are present in every environment, at a density that matches that scene's place in the story's emotional arc — quiet, becomes tense, resolves into calm again. Fog is always tinted royal blue, never neutral gray, and always sits low, never obscuring the primary subject.

---

# 8. WORLD BIBLE

Everything takes place inside one continuous logistics ecosystem.

The world is composed of eight connected locations:

Command Center

Warehouse

Sorting Hub

Container Port

Road Network

Air Cargo Hub

Urban Distribution

Customer Destination

The visitor never exits this world. The camera simply travels through it, from the Command Center at the network's conceptual heart, out through the physical infrastructure that moves a shipment, and back down to a single doorstep.

Every location shares the same material language, the same lighting philosophy, the same engineering quality, and the same architectural vocabulary. A structural rib in the Command Center and a gantry crane at the Container Port are built from the same design DNA — different function, same world.

The world feels unified. Not assembled.

No location is generic. Each is built at the scale and specificity of a real, operating piece of global infrastructure — never a stock backdrop.

---

# 9. THREE.JS ARCHITECTURE

The experience is built on two layers with one responsibility each.

**Layer One — the World.** A persistent Three.js / WebGL scene, mounted once and never torn down for the life of the session. The camera moves through this world continuously; the world itself does not reload, re-mount, or reset as the visitor moves between chapters. Environment, camera, lighting, particles, atmosphere, motion, materials, and post-processing all live here.

**Layer Two — the Interface.** A DOM/HTML layer composited above the WebGL canvas, responsible for navigation, tracking, buttons, forms, text, legal pages, and search. This layer never renders cinematic content and never owns camera or lighting state.

No business logic lives inside the Three.js layer. No cinematic rendering lives inside the HTML layer. The boundary between the two is absolute.

The world is organized as a single continuous scene graph, not seven independent scenes swapped in and out. Each of the eight world locations is a region within that one graph, positioned along the master camera path described in the Scroll Engine (Section 16). Regions outside the camera's current viewing window are frustum-culled and asset-streamed out, so the persistent-world illusion never costs a persistent full-world render.

A single WebGL renderer and a single camera rig serve the entire experience. There is no scene-switch, no render-target hand-off, and no visible loading boundary between chapters.

---

# 10. RENDERING PIPELINE

Lighting is physically based throughout. Every material is authored with PBR (physically based rendering) properties — albedo, roughness, metalness, normal, and, where needed, emissive maps — so surfaces respond correctly to the two-source lighting model in every environment.

Environments are lit primarily by HDRI image-based lighting, tuned per world region to the cool navy/electric-blue grade, supplemented by the two direct sources defined in the Lighting Bible.

Tone mapping is filmic, tuned to preserve crushed blacks and to prevent accent highlights from clipping to flat white — a light source in this world glows, it does not blow out.

The post-processing stack is applied globally, consistently, across every region of the world:

Bloom, tuned narrow and restrained — enough for practicals and accent light trails to feel luminous, never enough to haze the whole frame.

Depth of field, always favoring the camera's current focal subject, softening everything behind and, subtly, everything in front.

Atmospheric fog, volumetric where the environment calls for it, always tinted royal blue.

Color grading, a fixed cool LUT applied uniformly, with the one standing exception that protects natural skin tone.

Vignette, faint, framing rather than darkening the corners.

Chromatic aberration and film grain are used at a near-subliminal level only — enough to remove any hint of a flat CG render, never enough to read as a stylistic filter.

The pipeline's goal, stated plainly: a viewer's first read is "this is a real, physically lit place." Only on a second look does it register as an intentionally art-directed world.

---

# 11. CAMERA BIBLE

There is one camera. It never cuts. It travels continuously along a single authored path through the entire world, from the opening frame of Origin to the closing frame of Delivered.

**Height.** The camera holds an elevated, command-deck vantage for most of the journey — a 2.5–3.5 meter observer height, above eye-level but well short of aerial. Two chapters break this rule on purpose: Global Logistics rises to a true aerial altitude, and Delivered drops to the lowest point in the whole journey, just below 2 meters, for a deliberately calm, human-scale closing frame.

**Lens.** A 35mm-equivalent field of view is the baseline for the entire journey. Global Logistics is the one permitted exception, widening to 24mm to hold continental scale. The field of view never exceeds roughly 75° (which reads as distortion) and never drops below roughly 45° (which reads as a cropped telephoto), outside that one exception.

**Perspective.** The camera holds a consistent three-point perspective, tilted down 5–12 degrees into the world for most of the journey, easing to a near-level 3–5 degrees during the aerial Global Logistics passage. The dominant sightline in every single frame runs from lower-left to upper-right — this diagonal is the visual signature that ties all seven chapters into one continuous world, echoed in every route line, every conveyor, every light trail.

**Movement.** The camera's motion is slow, continuous, and legible. It never moves faster than the visitor scrolls. It never cuts, jumps, or teleports between chapters — every transition described in the Scene Specifications (Section 23) is a physical camera move: a descent, a rise, a push, a pull-back. The camera occasionally holds still at a chapter's emotional high point, but even then it carries the faintest residual drift, so the world never feels like a frozen still.

**Framing discipline.** The camera always keeps its primary subject inside the center 80% of frame horizontally, and always keeps the left and lower-left third of frame open — this is where the interface lives, and the camera composes around it as a permanent constraint, not an afterthought.

---

# 12. LIGHTING BIBLE

Two light sources, always. Never a third.

**Key light.** Positioned upper-right of frame in every chapter, carrying that chapter's single accent hue. This is the light that defines the chapter's identity — it is the color a visitor associates with that part of the journey.

**Fill light.** Positioned lower-left of frame in every chapter, always the same royal blue, regardless of the chapter's own accent. This is the one light that never changes across the entire journey — the ambient floor that makes every chapter, however different its environment, unmistakably part of the same world.

**Practicals.** Small, off-white points of light — screens, indicator lights, scan points, doorway glow — are used sparingly to add human-scale detail. A practical is never a third full light source; it never illuminates more than its immediate surroundings.

**Prohibited, absolutely.** Warm color temperature of any kind. Overhead or flat lighting. A second accent hue mixed into a single frame. Three or more light sources in any single shot.

**The one exception.** Human skin is lit naturally and reads as a real skin tone at all times. Blue may reach skin only as environmental bounce or a thin rim light — never as an overall tint. Cyan- or blue-tinted skin never appears in this world, under any circumstance.

---

# 13. MATERIAL BIBLE

Materials in this world are built to be photographed, not merely to exist.

**Reflective surfaces** — wet-look floors, glass curtain walls, brushed and painted metal, vehicle bodywork — are dark by default and pick up color from the scene's own key light. A floor in the Sorting Hub reflects that chapter's blue; a floor in the Container Port reflects that chapter's blue. Nothing reflects as neutral chrome or silver.

**Glass** is used generously but never as a mirror-bright highlight. It carries the same low-opacity, faintly luminous translucency throughout the world — glass reveals depth behind it rather than showing off its own surface.

**Structural material** — concrete, steel, composite panel — is oversized and confident, built at infrastructure scale. Surfaces are clean, precise, and industrial without ever reading as neglected or worn. This is a premium network, and its materials look maintained, engineered, and exact.

**Repetition as material language.** Structural bays, support ribs, conveyor modules, and gantry elements all repeat at one consistent rhythm across every environment in the world. This repetition is itself a material signature — it is how a visitor unconsciously recognizes "this is still TransRoyal" even when the environment around them has completely changed.

**Vehicles**, where present, share one restrained design language — dark bodywork, accent-tinted glass and lighting, no visible competing branding, no clutter of signage.

---

# 14. ENVIRONMENT BIBLE

The eight world locations named in the World Bible (Section 8) share one architectural DNA, expressed differently at each scale.

**Command Center** — the conceptual heart of the network. A vast, largely abstract atrium: soaring structural volume, illuminated ribs, a distant suspended walkway, light conduits threading through the space like the network's own data made physical. No literal desks, no screens-as-subject.

**Warehouse / Pickup Point** — human-scale and threshold-like: a loading dock at the edge between the city and the network, where a single shipment first enters the system.

**Sorting Hub** — a vast automated interior: conveyor lines, scan arches, route-verification light signatures, repeating structural bays receding toward a hazy vanishing point.

**Container Port / Ground Network** — the network made physical at highway and yard scale: fleets in motion, cross-hub load activity, a low horizon carrying the diagonal sightline out to the edge of the world.

**Air Cargo Hub / Global Logistics** — experienced from true altitude: a continental or coastal landscape below, shipping and flight lanes rendered as light trails, cloud layer in the near foreground.

**Urban Distribution / Final Mile** — a residential street at dusk-dark, one vehicle, one live routing indicator, the network narrowing from continental scale back down to a single address.

**Customer Destination / Delivered** — a doorstep, at rest. The calmest, quietest, least populated environment in the world, deliberately.

Every one of these locations, regardless of its individual function, is built from the same repeating structural module, the same two-source lighting doctrine, and the same cool navy-to-electric-blue material language described in Sections 12 and 13. The visitor should be able to recognize a TransRoyal environment from a single frame, in isolation, without any text or logo present.

---

# 15. MOTION BIBLE

Motion in this world is a narrative device, never decoration.

**Camera motion** is always slow and always legible — see the Camera Bible (Section 11). It is the primary motion signature of the entire experience.

**World motion** is restrained and purposeful: a vehicle moving through its own environment, a parcel advancing along a conveyor, a light trail tracing a route, a cloud layer drifting almost imperceptibly. Every moving element in the world is doing something a real logistics network actually does — nothing moves simply to add visual interest.

**Light-trail motion** is the connective tissue of the entire journey. A route line, a scan pulse, a light conduit — some form of this motif is visible and animated in every single chapter, always flowing along the camera's own bottom-left-to-top-right sightline. This is the visual thread that ties Origin to Delivered as one continuous story.

**Atmospheric motion** — drifting haze, faint particulate, distant heat-shimmer over a runway or highway — is present at low intensity throughout, adding life to environments without ever competing with the primary subject or the interface.

**Interface motion** is the calmest register in the entire system. Transitions ease smoothly, resolve fully, and never bounce, overshoot, or call attention to themselves. If a visitor consciously notices an interface animation, it has been tuned too loud.

**Reduced motion.** Every visitor who has requested reduced motion receives the complete story at full visual fidelity — the same environments, the same lighting, the same framing — with all camera travel, world motion, and interface motion replaced by direct cuts between each chapter's resting frame. Nothing about the story or its meaning is lost; only the motion that carries it there.

---

# 16. SCROLL ENGINE

Scroll position drives one continuous camera progress value, from 0 at the first frame of Origin to 1 at the final frame of Delivered. There are no separate "pages" from the engine's point of view — only a position along one master path.

Each of the seven chapters occupies a named segment of that path. Scrolling within a segment moves the camera smoothly along that segment's authored motion; scrolling across a segment boundary carries the camera through that chapter's authored transition into the next, exactly as described in each chapter's transition spec in Section 23.

Scroll input is smoothed and eased — raw wheel or touch delta is never applied directly to camera position. Momentum decays naturally rather than stopping abruptly.

When scrolling comes to rest, the camera eases toward the nearest chapter's resting frame — close enough to a chapter to feel anchored there, without a hard, mechanical snap.

The engine always knows, and always exposes to the interface layer, which chapter the camera currently occupies and how far it has progressed within it — this is what drives the navigation wayfinding state (Section 18) without the interface layer ever touching camera logic directly.

The scroll engine is the single authority over camera position. No other system moves the camera.

---

# 17. INTERACTION PHILOSOPHY

The interface behaves like a considerate guide standing just out of frame — present when needed, invisible otherwise.

Every interactive element has a calm resting state and a calm active state; the difference between them is always subtle. Nothing in this system uses a jarring hover effect, an aggressive color shift, or a bouncing transform to signal interactivity.

Feedback is immediate but understated — a visitor always knows an action registered, without that acknowledgment ever competing with the cinematic world behind it.

The interface never interrupts the camera's motion uninvited. Opening the tracking experience (Section 19) is the one deliberate exception, and even that is staged as a calm, focused overlay rather than a jarring modal.

Restraint is the interaction philosophy's single governing rule: when in doubt, do less.

---

# 18. NAVIGATION

Navigation is minimal, persistent, and never claims more than a thin strip of the frame.

A fixed, understated top bar carries brand identity and primary wayfinding, present identically across the entire journey — its consistency is part of what makes the seven chapters read as one world rather than seven pages.

A quiet wayfinding rail tracks the visitor's position in the shipment's journey — Origin through Delivered — with the current chapter gently emphasized and every other chapter present but visually receded. This rail is a compass, not a menu; it orients without inviting the visitor to jump around and break the continuous camera path.

Navigation never uses a hard color, a drop shadow, or a background panel strong enough to compete with the world behind it. It sits on the world the way a caption sits on a film frame.

---

# 19. TRACKING EXPERIENCE

Tracking a shipment is the one moment the interface is allowed to fully hold the visitor's attention.

It opens as a calm, centered, focused overlay — the cinematic world dims and recedes behind it rather than disappearing, so the visitor never feels like they have left the TransRoyal world, only paused within it.

The tracking experience is direct and unornamented: a single clear input, a single clear status, delivered with the same restrained typography and cool palette as the rest of the site. It is the most utilitarian moment in the experience, by design — this is the one place where clarity outranks atmosphere.

Closing it returns the visitor to exactly where they left the camera path, at the same scroll progress, with no re-entry animation beyond the overlay's own calm dismissal.

---

# 20. TYPOGRAPHY SYSTEM

One typeface family carries the entire experience: a restrained, geometric sans-serif with no separate display face. Consistency, not variety, is the signal of premium craft here.

Scale does the work of hierarchy. A small number of very large, confidently tracked headlines punctuate long stretches of quiet, comfortably sized body copy — the contrast between the two is deliberately wide, so a headline never has to compete with a paragraph for attention.

Tracking tightens as size increases — the largest headlines in the experience are set with noticeably tighter letter-spacing than body copy, which keeps them feeling sculptural rather than merely enlarged.

Body copy is never pure white. It sits one step down in luminance from headline color, which keeps a chapter's headline as the unambiguous focal point of its frame.

Line length is kept short and deliberate throughout — copy is composed in narrow columns that never fight the width of the cinematic environment behind them.

---

# 21. SPACING SYSTEM

Negative space is a primary material in this design, not a leftover.

Spacing is generous by default and becomes more generous, not less, at the story's quietest emotional beats — Origin and Delivered breathe the most; the story's busiest chapters, Sorting and Ground Network, tighten their rhythm to match the density of the world around them, without ever feeling cramped.

Every chapter's spacing rhythm is legible on its own — a visitor should be able to sense, from spacing alone, whether they are in a quiet or an intense chapter of the journey, independent of the environment behind the copy.

Vertical rhythm between elements is systematic and consistent within a chapter, and scales deliberately between chapters according to that chapter's place in the pacing arc described in Section 6.

---

# 22. COMPOSITION RULES

The left and lower-left third of every frame, in every chapter, is a protected quiet zone — reserved for the interface, kept visually calm in the underlying environment so copy always reads clearly against it.

The primary subject of every frame lives in the right two-thirds of frame, along the camera's own dominant bottom-left-to-top-right sightline.

Foreground stays sparse and uncluttered in every chapter, regardless of how busy that chapter's world is — the foreground's job is to frame, not to compete.

Midground carries each chapter's actual business activity — vehicles, parcels, machinery, people — at a density that matches that chapter's place in the story's pacing arc.

Background is always the busiest, most atmospheric layer — network-scale context, softened by fog and depth of field, so it reads as world rather than as a competing focal point.

No chapter ever places its primary subject under the top navigation strip or behind the wayfinding rail — composition is authored around the interface as a fixed constraint, in every single frame.

---

# 23. SCENE SPECIFICATIONS

Each chapter below is a complete world — not a placeholder to be reskinned, but the finished, authoritative specification for that leg of the journey.

## Scene 01 — Origin

**Purpose.** The visitor's first contact with the network. Establishes trust and scale before a single parcel has moved.

**Environment.** The Command Center — a vast, largely abstract atrium at the conceptual heart of the network. Soaring structural volume, illuminated ribs, a distant suspended walkway, abstract light conduits threading through the space like the network's own data made physical. No literal desks, no screens-as-subject.

**Camera.** Elevated command-deck vantage, static-reading establishing frame with only the faintest residual drift. 35mm baseline, 5–12° downward tilt.

**Lighting.** The one chapter with a dual signature instead of a single accent — electric blue and royal blue in equal measure, positioned as the standard upper-right/lower-left pair. This dual pairing is Origin's own visual signature, distinguishing it from every accent-driven chapter that follows.

**Atmosphere.** The lightest haze in the entire journey. Maximum clarity, minimum density — this is the story's calmest, most composed breath before the shipment begins moving.

**Composition.** Fixed, left-anchored, tightly controlled — the most deliberate, least "busy" composition of the seven chapters.

**Motion.** No literal cargo motion. Ambient light-conduit motion only, tracing the architecture, establishing the route-line motif that recurs in every later chapter.

**Materials.** Structural, architectural, abstract — dark tinted glass, illuminated structural ribs, no vehicles, no literal machinery.

**Narrative.** "Every shipment begins inside the network built to move it — coordinated, monitored, and never out of sight."

**Transition from previous.** None — this is the opening frame of the experience.

**Transition into next.** The wide command-center view contracts toward a single human-scale touchpoint; the camera's diagonal sightline carries through unbroken; the first human figure of the journey appears at the far end of the transition.

**Interaction.** Persistent navigation and tracking access, present but minimal — this chapter introduces the interface at its calmest.

**UI overlays.** Eyebrow, headline, single supporting line, single forward call to action. No proof points, no stats.

**Color palette.** Deep navy base; dual electric-blue and royal-blue accent.

**Asset requirements — image.** One production master establishing the Command Center atrium, abstract and populated only by light and architecture.

**Asset requirements — video.** A slow, near-static ambient loop of the light-conduit motion, for use as the chapter's held resting frame.

## Scene 02 — Pickup

**Purpose.** The shipment's first human touchpoint. Establishes the network's precision at the smallest possible scale — one scan, one driver, one parcel.

**Environment.** A loading dock at the threshold between city and network — the Warehouse / Pickup Point from the World Bible.

**Camera.** Ground-adjacent elevated vantage, roughly 2.5 meters, looking outward from the dock toward the vehicle and street beyond.

**Lighting.** Key light in this chapter's own accent (electric blue, brighter register), fill in the constant royal blue.

**Atmosphere.** Light haze — the story has begun moving, but this chapter is still close to Origin's calm.

**Composition.** Operational — moderately contained, scannable, human in scale.

**Motion.** A driver and vehicle at the dock; a handheld scanning device catching light as it registers the shipment. The first literal cargo motion of the journey.

**Materials.** Dock concrete and steel, vehicle bodywork in dark accent-tinted paint, a single bright practical at the scan point.

**Narrative.** "One scan starts the chain of custody — labeled, logged, and handed into the network within minutes of pickup."

**Transition from previous.** Arrives from Origin's contraction, camera settling to dock height, sightline unbroken.

**Transition into next.** The scanned parcel becomes the visual through-line, carried out of frame; the camera begins rising from dock-level toward the Sorting Hub's elevated vantage.

**Interaction.** Primary conversion moment — forward call to action to begin a shipment.

**UI overlays.** Eyebrow, headline, supporting line, two short proof points, forward call to action.

**Color palette.** Deep navy base; electric-blue accent; constant royal-blue fill.

**Asset requirements — image.** One production master of the dock, driver and vehicle present, scanner as the sharp foreground focal point.

**Asset requirements — video.** A short loop of the scan moment — light catching the device, the driver's motion resolving to stillness.

## Scene 03 — Sorting

**Purpose.** Demonstrates the network's operational precision at industrial scale — reliability made visible.

**Environment.** The Sorting Hub — a vast automated interior of conveyor lines, scan arches, and repeating structural bays.

**Camera.** Elevated mezzanine vantage, roughly 3.5 meters, tilted 8–10° down a sorting line, held in a wide, steady frame.

**Lighting.** Key light in this chapter's own accent (royal-blue-leaning), fill in the constant royal blue.

**Atmosphere.** Moderate volumetric haze, enough to separate the repeating structural bays into visible depth layers.

**Composition.** Split — a deliberate portion of frame reserved for the copy column, the remainder given to the hub's full depth.

**Motion.** Conveyors running continuously, parcels advancing, scan-arch light pulses verifying each one in sequence — the busiest literal machinery motion in the journey so far.

**Materials.** Steel conveyor structure, dark tinted scan-arch glass, repeating structural bays receding into haze.

**Narrative.** "Automated routing reads every label and sends each shipment down the fastest verified path — built to remove error, not just add speed."

**Transition from previous.** Arrives already at mezzanine height, the scanned parcel from Pickup rejoining the flow of the conveyor line.

**Transition into next.** The hub's interior motion lines extend outward into exterior road lines; the camera pulls back and rises from mezzanine height toward Ground Network's full establishing height.

**Interaction.** Informational — no primary call to action, three proof points carrying the chapter's weight.

**UI overlays.** Eyebrow, headline, supporting line, three proof points.

**Color palette.** Deep navy base; royal-blue-leaning accent; constant royal-blue fill.

**Asset requirements — image.** One production master of the sorting line at mezzanine height, conveyors and scan arches receding into hazy depth.

**Asset requirements — video.** A continuous loop of conveyor and scan-pulse motion.

## Scene 04 — Ground Network

**Purpose.** Establishes domestic scale and reach — the network in constant physical motion across a region.

**Environment.** The Container Port / Road Network — highway and fleet-yard scale, multiple vehicles, cross-hub load activity.

**Camera.** Full elevated establishing height, roughly 3.5 meters, 28–35mm, low horizon carried through the frame.

**Lighting.** Key light in electric blue, fill in the constant royal blue.

**Atmosphere.** The heaviest ground-level haze in the journey — this is the story's most physically dense chapter, and the atmosphere carries that weight.

**Composition.** Expansive — bottom-anchored, widest copy column in the set, leaving the full establishing shot room to breathe above it.

**Motion.** A fleet in constant, layered motion — the busiest midground of the entire journey. Vehicles moving at different depths and speeds, cross-hub loading happening in the distance.

**Materials.** Asphalt and steel at highway scale, vehicle fleet in the shared dark accent-tinted paint language, distant hub silhouettes softened by heavy atmosphere.

**Narrative.** "A fleet in constant motion covers the ground between hubs. Regional lanes run on fixed schedules with live coordination, keeping freight moving even when a single route is delayed."

**Transition from previous.** Arrives from Sorting's mezzanine pull-back, now at full establishing height, the hub's interior lines resolved into open road.

**Transition into next.** The camera continues rising past establishing height, past what a ground vantage can hold, up into Global Logistics' true aerial altitude — the ground's own horizon becomes the aerial chapter's curvature cue.

**Interaction.** Informational — four proof points, the densest single stat/proof block in the journey.

**UI overlays.** Eyebrow, headline, supporting line, four proof points.

**Color palette.** Deep navy base; electric-blue accent; constant royal-blue fill.

**Asset requirements — image.** One production master of the highway/yard at full establishing height, fleet in motion at multiple depths.

**Asset requirements — video.** A loop of fleet motion across the mid-ground, timed to feel continuous and unhurried despite the density of activity.

## Scene 05 — Global Logistics

**Purpose.** Reveals the network's international reach — the moment the story's scale becomes continental.

**Environment.** The Air Cargo Hub, experienced from true altitude — a continental or coastal landscape below, shipping and flight lanes rendered as light trails.

**Camera.** True aerial altitude, 60 meters equivalent or higher — the one chapter permitted this height. 24mm wide lens — the one chapter permitted this lens. Near-level tilt, 3–5°, matching a cruising-altitude read.

**Lighting.** Key light in electric blue, fill in the constant royal blue, both read at greater distance and softer falloff than any other chapter.

**Atmosphere.** The heaviest atmosphere of the entire journey, appropriate to altitude — cloud layer in near-foreground, continental landmass softened toward the horizon.

**Composition.** Expansive, matching Ground Network's bottom-anchored copy column, but with the widest possible sense of open frame above it.

**Motion.** Light-trail flight and shipping lanes in continuous, level-cruise motion across the landscape below; a thin layer of cloud drifting almost imperceptibly in the near foreground.

**Materials.** None in the architectural sense — this chapter is landscape and light, the one chapter without literal built structure in frame.

**Narrative.** "Where the regional network becomes a global one — air cargo links TransRoyal hubs to destinations far beyond the region."

**Transition from previous.** Arrives still rising from Ground Network's horizon, breaking through into true altitude, the fleet below resolving into distant light trails.

**Transition into next.** The camera begins its descent from cruising altitude back toward street level; the continental-scale light trail narrows, chapter by chapter, down to a single final-mile route, the same electric-blue motion cue carried through unbroken.

**Interaction.** Informational only — no proof points, no call to action, the chapter is held as pure scale and reach.

**UI overlays.** Eyebrow, headline, supporting line only.

**Color palette.** Deep navy base; electric-blue accent; constant royal-blue fill.

**Asset requirements — image.** One production master aerial view, light-trail network over continental/coastal landscape, cloud wisps in foreground.

**Asset requirements — video.** A slow, level-cruise loop of light-trail motion across the landscape below.

## Scene 06 — Final Mile

**Purpose.** Closes the human-scale loop opened at Pickup — the network narrows back down to one street, one door.

**Environment.** Urban Distribution — a residential final-mile street, one delivery vehicle, one live routing indicator.

**Camera.** Elevated operational vantage, roughly 2.5–3 meters — the same height and lens family as Pickup, closing the journey's human-scale bracket.

**Lighting.** Key light in royal-blue-leaning accent, fill in the constant royal blue.

**Atmosphere.** Moderate haze, softer and calmer than Ground Network — the story is visibly slowing down.

**Composition.** Operational, matching Pickup's contained, scannable width.

**Motion.** A single vehicle and figure, a live routing indicator tracking progress toward the doorstep — deliberately less motion than any chapter since Origin.

**Materials.** Residential street surface, one vehicle in the shared dark accent-tinted language, a single practical glow at the routing indicator.

**Narrative.** "Into the destination city, on the last leg of the journey — status follows every shipment the whole way, visible anytime through tracking."

**Transition from previous.** Arrives from Global Logistics' descent, the continental light trail narrowed to this one street's single route line.

**Transition into next.** The delivery vehicle's route resolves at a doorstep; all motion fully stops, setting up Delivered's static resolution frame.

**Interaction.** Demonstrates the tracking capability without opening it — the live tracking interaction itself remains a single, persistent, global entry point (Section 19), not duplicated here.

**UI overlays.** Eyebrow, headline, supporting line, two proof points.

**Color palette.** Deep navy base; royal-blue-leaning accent; constant royal-blue fill.

**Asset requirements — image.** One production master of the residential street, vehicle and routing indicator present, doorstep visible but not yet the focal point.

**Asset requirements — video.** A short loop of the vehicle's final approach, motion visibly slowing toward the transition into Delivered.

## Scene 07 — Delivered

**Purpose.** The story's resolution. All tension releases. Trust is confirmed.

**Environment.** The Customer Destination — a doorstep, at rest. The calmest, least populated environment in the world.

**Camera.** The lowest vantage in the entire journey, just under 2 meters, near eye-level, held perfectly static — no tilt, no residual drift.

**Lighting.** Key light in electric blue, fill in the constant royal blue — the same accent family as Origin, closing the loop.

**Atmosphere.** The lightest haze in the journey alongside Origin — maximum clarity, nothing obscured.

**Composition.** Resolution — uses the same narrow, quiet column as Origin, with only the closing call to action given any added emphasis.

**Motion.** None. No vehicles, no figures in motion, no light trail. This is the one chapter in the entire journey where motion fully stops.

**Materials.** A single parcel at rest on a doorstep — the sole sharp subject in frame, everything else calm and minimal around it.

**Narrative.** "Delivered — and ready to ship with TransRoyal again. Every shipment on the network is backed by the same standard of care."

**Transition from previous.** Arrives at the exact moment Final Mile's motion resolves — no camera movement of its own, the stillness itself is the transition.

**Transition into next.** None — this is the closing frame of the experience. Composition deliberately mirrors Origin's sparse, quiet framing, bookending the journey.

**Interaction.** Closing call to action.

**UI overlays.** Eyebrow, headline, supporting line, closing call to action, emphasized.

**Color palette.** Deep navy base; electric-blue accent; constant royal-blue fill.

**Asset requirements — image.** One production master of the doorstep at rest, parcel as the sole sharp foreground subject.

**Asset requirements — video.** None required — this chapter is deliberately held as a still frame, motion having fully resolved in the previous chapter.

---

# 24. IMAGE GENERATION STANDARDS

Every generated image in this world is rendered as AAA cinematic architectural visualization — ultra-realistic, physically based, film-grade composition, at architectural-visualization quality. This is explicitly not photography, not stylized illustration, and not concept art. A viewer's first read is a real, physically lit place; only on a second look does it register as an intentionally art-directed world.

Every image follows the Camera Bible, Lighting Bible, Material Bible, and Composition Rules exactly, without exception, for its chapter.

Every image is generated once, at a wide master aspect ratio and the highest available resolution, as a Production Master — never generated per delivery format. The master carries enough headroom and footroom around its primary subject to survive every downstream crop without regeneration.

Every image keeps its primary subject within the safe composition zone defined in Section 22, and keeps the left and lower-left third of frame quiet, in every chapter, without exception.

Human figures, where present, follow the one standing exception in the Lighting Bible: natural skin tone, never tinted by the environment's cool grade.

No chapter's image contains text, logos, or branding of any kind — the environment communicates entirely through composition, light, and material.

---

# 25. VIDEO GENERATION STANDARDS

Motion assets extend a chapter's still frame rather than replacing it. Every video begins from that chapter's Production Master framing, height, lens, and lighting, and moves only within the bounds already established by that chapter's entry in Section 23.

Ambient loops — conveyor motion, light-trail flow, cloud drift, fleet motion — are authored to loop seamlessly, with no visible restart, so a held chapter never betrays its own loop point.

Transition motion — a rise, a descent, a push — is authored once per chapter boundary, matching exactly the transition described in that chapter's specification, and is the literal camera path the Scroll Engine (Section 16) plays back as the visitor crosses that boundary.

Every motion asset fully and immediately stops under a visitor's reduced-motion preference, resolving to that chapter's still resting frame with no loss of narrative meaning.

---

# 26. ASSET PIPELINE

Every asset in this world is generated once, at master quality, and derived downward — never regenerated per platform or format.

```
Production Master (wide master aspect ratio, highest resolution)
        ↓
    Desktop
        ↓
    Tablet
        ↓
    Mobile
        ↓
    Video
        ↓
    Motion
        ↓
    Frontend
```

Each stage derives from the one above it. A mobile crop is a recomposition of the Production Master, never an independent generation — this keeps every delivery format visually identical in light, material, and grade, differing only in framing.

Where a chapter's focal subject cannot survive a center-weighted crop at a narrow viewport, that chapter receives a distinct recomposed variant, framed so its subject sits within the safe center of a portrait frame — never a second, independently generated image.

---

# 27. THREE.JS ASSET ORGANIZATION

The world's geometry and materials are authored as GLTF, organized by world region, matching the eight locations in the World Bible.

Textures are authored once at master resolution and compressed per delivery tier; repeated structural elements — conveyor modules, structural bays, gantry segments — share a single texture set across every instance, never duplicated per occurrence.

Environments are geometry-instanced wherever a structural element repeats — the repeating structural rhythm described in the Material Bible is built once and instanced, not modeled by hand at every repetition.

Each world region carries its own HDRI, tuned to that region's key/fill accent pairing, swapped as the camera's progress crosses into that region — never blended mid-region.

Level-of-detail tiers reduce geometric and texture complexity for any region outside the camera's immediate viewing window, restored ahead of the camera's arrival so no popping is ever visible.

---

# 28. PERFORMANCE STANDARDS

The experience holds a smooth, consistent frame rate throughout the camera's travel — motion is the primary experience, and any stutter in camera movement breaks the illusion of a continuous world immediately.

Assets stream progressively, prioritized by the camera's current and immediately upcoming position along the master path — nothing outside the camera's near-term path competes for bandwidth or GPU time with what the visitor is about to see.

Texture and geometry memory are budgeted per world region, not globally — a region unloads its heaviest assets once the camera has fully passed it and is not expected to return along the visitor's forward path.

The first frame the visitor sees loads fast and complete — Origin never appears partially resolved, low-resolution, or mid-stream.

---

# 29. ACCESSIBILITY

Every chapter's narrative is fully carried by its written copy, independent of the cinematic environment behind it — nothing essential to understanding the story is ever conveyed by imagery or motion alone.

Reduced motion is a first-class experience, not a degraded fallback — see Section 15 and Section 25. A visitor who disables motion receives the complete seven-chapter story, at full visual fidelity, as a sequence of held resting frames.

Interface contrast, focus states, and keyboard navigation meet or exceed standard accessibility requirements at every point in the journey, including inside the Tracking Experience (Section 19), which remains fully operable without a mouse.

Every decorative element of the world is excluded from assistive technology; every chapter's meaning remains complete through its structured, labeled content alone.

---

# 30. QA CHECKLIST

- [ ] Camera height, lens, and tilt match the chapter's specification in Section 23 exactly.
- [ ] The dominant sightline runs lower-left to upper-right in every frame.
- [ ] Lighting uses exactly two sources, key in the chapter's accent, fill in the constant royal blue.
- [ ] No warm color temperature appears anywhere except natural human skin.
- [ ] Reflective surfaces are dark and accent-tinted, never neutral chrome.
- [ ] Atmosphere density matches the chapter's place in the story's pacing arc.
- [ ] The left and lower-left third of frame stays visually quiet in every chapter.
- [ ] The primary subject survives both a wide desktop crop and a center-weighted portrait crop.
- [ ] The chapter's transition, in and out, matches its authored camera move exactly.
- [ ] The chapter reads clearly with its interface copy composited on top, not just in isolation.
- [ ] Reduced motion resolves to the correct held frame with no loss of narrative meaning.
- [ ] No chapter's imagery contains text, logos, or third-party branding.

---

# 31. FUTURE EXPANSION RULES

Any new chapter inserted into the journey is assigned its own pacing and composition independently — never derived mechanically from a neighboring chapter — and derives its camera, lighting, and material treatment from Sections 11–14 rather than introducing a new doctrine.

Any new accent color must justify why the existing accent family is insufficient before being added — the palette is intentionally closed.

The master camera path (Section 16) is extended, never rebuilt, when a new chapter is added — existing chapters' transitions are never altered to accommodate a new one; a new chapter is inserted as a new segment with its own authored entry and exit.

Any environmental condition not already covered by this handbook — rain, snow, night-for-day, a new world region — requires an explicit addendum to this document before any asset referencing it is generated. No new material or atmosphere language is improvised inline in a single generation prompt.

This handbook describes the finished production experience in full. As the build progresses toward that description, this document does not change to match the build — the build changes to match this document.

---

# 32. ADDENDUM (v3.1) — ART DIRECTION & PRODUCTION RULES

This addendum closes the gap between Sections 1–31, which specify *what* the experience is, and the artistic judgment required to build it consistently. It does not revise anything above. After this addendum, the handbook is frozen — implementation is the only remaining work, and no further handbook revision happens except by explicit request.

## 32.1 Three.js Primacy Mandate

The Three.js world is the website. The HTML/DOM layer is an overlay on top of it — never the reverse. This clarifies and hardens Section 9's layer split.

Every unit of visual experience — light, atmosphere, depth, material, motion — belongs in the WebGL layer. CSS is permitted only for interface chrome (navigation, tracking, footer), text legibility scrims, and typography.

A CSS-authored gradient blob, dot-grid background, or animated SVG line standing in for a real environment is scaffolding, not a finished scene. A scene without a real Three.js environment is unfinished, full stop — there is no such thing as a CSS-only scene that is "done."

Test before shipping any scene: turn off WebGL. If the page still looks art-directed, the balance is wrong.

## 32.2 Art Direction Bible

Composition is asymmetric, never centered, never a symmetric grid — the two authored exceptions are Origin's opening frame and Delivered's closing frame (Section 23), and even those are off-center by design, never dead-center.

Negative space is load-bearing, not leftover. Most of any frame is empty, dark, and quiet. One subject earns the eye per frame — never two competing subjects in the same shot.

Scale communicates trust: structure and machinery read as built for a network, oversized relative to any human figure present.

Hierarchy comes from scale contrast and isolation alone — never from color, never from decorative boxes, never from borders or panels separating content from the world behind it.

Every frame reads as a single photograph, not an assembled interface. If a viewer can point to a distinct floating "card" or "panel," the frame has failed.

## 32.3 Cinematography Bible

Extends the Camera Bible (Section 11) with the judgment behind its numbers.

The quiet third (left / lower-left, per Section 22) stays genuinely empty in every frame — no midground clutter, no secondary light, nothing there to compete for the eye.

Focal points are singular and sit on the dominant bottom-left-to-upper-right sightline — never centered, never doubled.

Vanishing lines — conveyor rails, route lines, structural ribs, road lanes, flight lanes — always converge toward the upper-right. This is the visual rhyme that unifies all seven chapters into one world.

Foreground exists to frame, never to inform. A soft, dark, out-of-focus foreground element deepens a shot; a sharp or legible one competes with it and is wrong.

Depth reads in three discrete layers in every frame: a sparse, sharp foreground; an active midground carrying the chapter's story; a hazy, atmospheric background. Two layers collapsed into one, or a flat single-plane shot, fails the QA checklist regardless of any other criterion it meets.

## 32.4 Environment Language

Extends the Environment Bible (Section 14) with the shared construction vocabulary every location draws from.

**Structure.** Exposed structural ribs, repeating at one consistent module from the Command Center to the Container Port to the Air Cargo Hub, are the world's skeleton, not decoration. Every location shows its bones.

**Material.** Dark, matte-to-satin concrete and painted steel form the base surface everywhere. Glass encloses and reveals depth; it is never a decorative feature wall. Nothing in this world is polished to a showroom finish — it is working infrastructure, engineered and maintained, never a lobby.

**Massing.** Every structure reads as a fragment of something larger extending past the frame. A building never shows its full footprint in a single shot — the network always implies scale beyond what is visible.

**Distinguishing locations.** Locations differ by function and scale only — an atrium's height, a dock's human proportion, a runway's horizon — never by switching material language, color temperature, or architectural style. A visitor recognizes "same world" before they recognize "different place."

## 32.5 Banned Aesthetics

Absolute. No per-scene exceptions.

Never: generic stock-photo warehouse interiors · white or bright office interiors · sci-fi glow props (holograms, floating screens, neon circuitry) · orange, amber, or any warm key light · a scene with more than one competing focal point · floating UI cards over the 3D world · dashboard-style layouts (stat-tile grids, KPI panels, admin-console framing) · glassmorphism as decoration (frosted panels, card drop-shadows, faux depth via blur alone) · Bootstrap-style even-gutter grid layouts · centered symmetric hero compositions outside the two authored Section 23 exceptions · bouncing, overshooting, or elastic motion of any kind · any surface photographed as neutral chrome or silver, or any light or text rendered pure white where an off-white token exists for that purpose.

If a proposed design element appears on this list, it is rejected regardless of how it looks in isolation.
