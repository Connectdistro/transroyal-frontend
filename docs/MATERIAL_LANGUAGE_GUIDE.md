# TransRoyal — Material Language Guide

Planning document, not a code change. Every material referenced below already exists in the codebase — this classifies what's there today and defines the rule for anything added later. Produced after the warm palette migration surfaced the real question: which materials should respond to the new warm lighting, and which should stay blue on purpose.

## The doctrine

Every material in this world is **Physical**, **Digital**, or **Brand**. Every material should belong to exactly one.

- **Physical** — exists as a real object with mass: paint, rubber, concrete, glass, metal, skin, fabric. Lit by the scene's key/fill lights and environment map like everything else. Its own base color should read as a believable industrial hue under warm light. Real-world convention wins where one exists (see the taillight decision below) — this category simulates reality, it doesn't decorate it.
- **Digital** — represents information, not matter: a route line, a scan beam, a tracking indicator, a UI element rendered in-world. Typically `MeshBasicMaterial` already (unlit by design, not by accident) and stays in the brand's blue family regardless of scene lighting, because it was never claiming to be a physical object in the first place.
- **Brand** — intentional identity accents that aren't simulating reality or visualizing data: a logo treatment, a chapter-transition flourish, a signature architectural highlight. Free to blend warm and blue because it's expressing the brand, not obeying either of the other two categories' rules. Nothing in the codebase is explicitly in this category yet — it exists for future work (see below), not to reclassify anything that already has a clear physical or digital identity.

The test for any material: **if you removed this object, would the physical scene still make sense?** A truck's paint — yes, still a truck, just a different color (Physical). A route line — no, it's not a physical thing at all (Digital). A moment that exists purely to say "this is TransRoyal" rather than to be a truck or a data path — Brand.

**Color is semantic.** Warm tones represent the physical logistics world. Blue represents information, connectivity, and tracking. Brand colors are used intentionally for identity, not as ambient decoration. Don't blur these roles with an arbitrary color choice.

## Why this matters technically

Confirmed during the warm palette migration: `MeshBasicMaterial` ignores scene lighting entirely (it renders its own fixed color regardless of any light), and a deeply saturated navy `MeshStandardMaterial` albedo (most structural/vehicle colors in this project today, e.g. `0x0c1338`) still reads mostly blue-black under warm light because light color × dark saturated-blue albedo is still blue-black — warm light alone can't fix a material that was authored blue. Reclassifying a material as Physical is necessary but not sufficient; its own base hex has to actually move toward a warm industrial tone for the lighting to read on it. That recoloring is deliberately **not done in this document** — this is the classification pass that has to happen before it, so the recolor pass has a rule to follow instead of guessing chapter by chapter.

## Classification table

| Category | What's in the codebase today | Responds to warm light? | Target hue direction |
|---|---|---|---|
| **Physical — body paint** | Truck/van bodies (`VEHICLE_COLOR`, all navy: `0x0c1338`, `0x0d1440`), structures/buildings (`STRUCTURE_COLOR`/`HOUSE_COLOR`/`FACADE_COLOR`, all navy `~0x0a1030`) | Yes | Needs real recoloring — navy today, should move toward white/gray/graphite/muted industrial tones so warm light actually shows on it |
| **Physical — already correct** | Forklift body (`0xd88a1a`, warm gold-orange), Ground's cargo containers (`CONTAINER_COLORS`: blue `0x2f5fae`, brick-red `0x8a3a2a`, green `0x3a6b4a`) | Yes, already does | None needed — these already read as real, varied industrial equipment, not brand-navy |
| **Ground/surface** | Asphalt/dock/street/floor (`ASPHALT_COLOR`, `DOCK_COLOR`, `STREET_COLOR`, `FLOOR_COLOR`, all near-black navy) | Yes | Should move toward neutral dark gray/charcoal (real asphalt is gray, not blue) |
| **Rubber/tires** | `RUBBER_COLOR` (`0x05070f`, near-black) | Minimal (already dark/neutral enough) | None needed — real tires are black; this already reads correctly regardless of light color |
| **Metallic — hero equipment** | Aircraft fuselage (`0xd4dbe8`, pale metallic), engine housings (`0x14181f`) | Yes | Fuselage already light/neutral enough to catch warm light well (confirmed in the audit as the chapter's strongest reflection read) — no change needed |
| **Glass** | Windshields (`ELECTRIC_500`, transparent 0.32), architectural windows (`WINDOW_COLOR`/`0xbcd4ff`, transparent) | Partially — real glass carries a slight tint regardless of light | Open question below |
| **Industrial safety** | Hazard striping (`0xd8a021`, amber), traffic cones, indicator/turn-signal lights (`0xffaa33`, amber) | Already correct | None needed — already amber/warm, matches real-world safety color convention, not part of the blue-vs-warm tension at all |
| **Aviation equipment (real-world convention)** | Nav lights (red/green, international standard), anti-collision beacon (`0xff3b30`, red), destination/engine glow (`0xffb347`, amber) | Already correct | None needed — these colors are dictated by real aviation convention, not brand palette; changing them would reduce realism |
| **Human figures** | Clothing (`0x141a3a`, navy), skin (`0xc48a6a`) | Skin: already exempted ("the Lighting Bible's one standing exception... never tinted by the world's cool grade") | Clothing should move toward believable workwear (navy/charcoal/hi-vis), skin stays as-is |
| **Digital — route/data lines** | Every chapter's route line tube (`ELECTRIC_400`/`ELECTRIC_500`/`ROYAL_500`), Air's delivery thread + light trails, Origin's dual route lines | No, by design | Stays blue family — this is the network's own path visualization, not a physical object |
| **Digital — signage/wayfinding** | Ground's yard chevrons/panel edges, Pickup's bay panel, Sorting's lane-marker panels (`ELECTRIC_400`/`ROYAL_500` edges, `OFFWHITE_100` panels) | No, by design | Stays blue-edged — abstract wayfinding, reads as information display, not a physical sign material |
| **Parcel labels** | `PARCEL_LABEL_COLOR`/`HANDOFF_PARCEL_LABEL_COLOR` (`0xeef2ff`, off-white, unlit) | No | Stays neutral/off-white — a shipping label is printed data on the parcel, arguably belongs in the Digital column even though the parcel box itself is Physical |
| **Resolved — vehicle lighting** | Taillights used `ELECTRIC_400` (blue); headlights use `OFFWHITE_100` (already realistic); turn signals use `0xffaa33` (already realistic amber) | Physical, real-world convention wins | **Decided**: taillights move to red (`0xff3b30`, matching Air's own anti-collision beacon red rather than inventing a new hex). Physical vehicle functions use their legally-recognizable real colors; the TransRoyal brand doesn't claim vehicle lighting. If a Brand moment wants blue near a vehicle later, it belongs on equipment that isn't a legally-recognizable light (a tracking LED, a scanner strip), not on the light itself. |
| **Brand** | Nothing yet | — | Reserved for future work — logo illumination, chapter-transition flourishes, signature architectural accents, marketing moments. Don't force an existing Physical or Digital material into this category just because it's visually striking; it has to actually be doing brand-identity work rather than simulating a real object or visualizing data. |

## What this doesn't decide

This document classifies. It doesn't recolor everything. The next initiative — recoloring the "Physical — body paint" and "Ground/surface" rows toward believable industrial tones (white/gray/graphite/muted per your own note against a monochromatic risk) — is a separate, larger pass across every chapter file's vehicle/structure materials, and should get its own scoped implementation plan before any code changes, matching how the lighting migration itself was handled. The taillight fix above is small and resolved enough to implement immediately alongside this document, since real-world convention already answers it.
