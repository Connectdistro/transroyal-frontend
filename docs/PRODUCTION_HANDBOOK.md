# TransRoyal Visual Production Bible

**Version 1.1** — Sections 1–18 are the v1.0 baseline (unchanged); the Production Standard v1.1 appendix adds three previously-missing standards (Render Medium, Master Asset Standard, Human Rendering Standard) required before any generation.

**Canonical reference for image generation, video generation, CSS lighting/atmosphere, parallax, and scroll choreography.**

This document uses three labels, consistently, to mark the implementation status of every claim it makes. No other status language is used anywhere in this document:

- **Repository Standard** — behavior already built and locked into the codebase today. Documented, not invented. Cited to a file and line.
- **Production Standard v1.0 / v1.1** — a creative/production rule with no repository precedent (no photographic or AI-generated Scene 1 asset exists anywhere in this project). v1.0 is the **first official cinematic production specification**; later versions (starting with v1.1) are additive addenda that fill a gap identified after v1.0 without changing anything v1.0 already established. A Production Standard rule is a design decision, not a code claim — it governs what should be generated, not what the browser currently does.
- **Reserved for Future Implementation** — a capability that exists as a named placeholder (a schema field, a scaffolded component, a documented milestone) but has no working code path today. This label exists specifically so that "planned" is never confused with "built." Nothing labeled this way should be read as functional.

No business facts, figures, or operational statistics are invented anywhere in this document. Where the repository has no verified figures (see `stats` field, Section 4), none are asserted here either.

---

## 1. Vision

TransRoyal's frontend is a single-page, seven-scene scroll narrative that carries a visitor from first contact with the network through to a completed delivery, in one continuous "sparse → dense → sparse" rhythm (Repository Standard — `src/scroll-world/config.js` header comment). The site commits to one fixed premium dark cinematic theme rather than adapting to OS light/dark preference (`src/styles/tokens.css:3`).

Phase 2B extends that locked interaction architecture into visual production: every future generated image or video must read as a continuation of the same brand world already expressed in the site's CSS — same palette, same rhythm, same safe zones — not a new art direction layered on top.

## 2. Design Philosophy

**Repository Standard.** The codebase's own comments state the philosophy directly:
- A single fixed dark theme, not a light/dark toggle — `#080F50` is "the fixed primary anchor per brand direction; every other value is derived to sit alongside it" (`tokens.css:2-3`).
- Pacing follows a deliberate rhythm: `sparse → light → medium → medium-dense → dense → medium → sparse` across the seven scenes, described in-repo as "Alireza-inspired discipline" (`config.js` header comment).
- `composition` is a separate, hand-assigned axis from `pacing` — never derived automatically — meaning placement/emphasis is an explicit creative decision per scene, not a mechanical consequence of density.
- Business-purpose metadata (`businessPurpose` field) is carried on every scene but deliberately never rendered in the DOM — it exists purely to keep design and generation decisions traceable to a business reason.

## 3. Narrative Journey

**Repository Standard**, from `src/scroll-world/config.js`:

| # | id | Label | Eyebrow | Title | Pacing | Composition |
|---|---|---|---|---|---|---|
| 1 | `origin` | Origin | TransRoyal Network | Enter the Network | sparse | focus |
| 2 | `pickup` | Pickup | Shipment Prepared | Begin Your Journey | light | operational |
| 3 | `sorting` | Sorting | Processing Hub | Built for Precision | medium | split |
| 4 | `ground` | Ground | Regional Network | Moving What Matters | dense | expansive |
| 5 | `air` | Global | International Reach | Connected Beyond Borders | medium-dense | expansive |
| 6 | `final-mile` | Final Mile | Almost There | Visibility at Every Step | medium | operational |
| 7 | `delivered` | Delivered | Successful Delivery | Delivered with Confidence | sparse | resolution |

Note: the internal id for scene 5 is `air`, but its rendered label is `Global`. Both names are used interchangeably in this document to refer to the same scene; production assets should treat it as the "Global" scene.

The pacing curve is symmetric: sparse (Origin) → builds through light/medium/dense (Pickup → Ground) → begins resolving at medium-dense (Global) → eases back through medium (Final Mile) → returns to sparse (Delivered), bookending the journey.

## 4. Repository Standards (Consolidated Reference)

This section consolidates every visual/behavioral rule already locked in code, so Sections 6–13 can cite it rather than re-derive it.

### 4.1 Color tokens (`src/styles/tokens.css`)
```
--navy-950: #05081f   deepest background
--navy-900: #080f50   primary brand anchor (fixed, not derived)
--navy-800: #101a6e
--navy-700: #182590
--royal-600: #2540b0  royal blue, derived from the anchor
--royal-500: #3654d6
--electric-500: #2f8bff  motion, routes, tracking states (per token comment)
--electric-400: #4fa3ff
--white: #ffffff
--offwhite-100: #eef2ff  light-blue tinted off-white
--offwhite-200: #d7deff
--surface-glass: rgb(255 255 255 / 6%)
--border-subtle: rgb(255 255 255 / 12%)
--border-strong: rgb(255 255 255 / 24%)
--focus-ring: 0 0 0 3px rgb(47 139 255 / 55%)
--shadow-elevated: 0 20px 60px -20px rgb(0 0 10 / 65%)
--shadow-soft: 0 8px 24px -12px rgb(0 0 10 / 55%)
```
There is no "reflective material" terminology anywhere in the repository — this concept is introduced fresh in Section 9 (Production Standard v1.0).

### 4.2 Typography (`tokens.css`, `base.css`)
```
--font-sans: 'Inter', system-ui, 'Segoe UI', Roboto, sans-serif
--font-heading: var(--font-sans)   /* no separate display face */

--text-2xs: 0.72rem
--text-xs:  0.82rem
--text-sm:  0.9rem
--text-base: 1rem
--text-md:  1.15rem
--text-lg:  clamp(1.5rem, 2vw + 1rem, 2.25rem)     /* h2 */
--text-xl:  clamp(1.35rem, 1.6vw + 0.9rem, 1.9rem) /* deliberately below --text-lg, so a stat never outweighs an h2 */
--text-2xl: clamp(2.25rem, 4vw + 1rem, 4rem)       /* h1 */
```
Base document: `font: 16px/1.5`. Headings (`h1/h2/h3`): weight 600, `line-height: 1.1`, `letter-spacing: -0.02em`, color `--white`. Body (`p`): color `--text-muted` (`#d7deff`), not full white — this is the Repository Standard for copy contrast against the dark background.

### 4.3 Spacing / layout
```
--nav-height: 72px (desktop) / 60px (mobile)
scene padding-inline: 24px (default) / 64px (≥640px)
--radius-sm/md/lg: 6px / 12px / 20px
```
Pacing token drives per-scene rhythm and copy width (`world.css`):
```
sparse:       --scene-rhythm: 22px;  --scene-copy-width: 560px;
light:        --scene-rhythm: 19px;  --scene-copy-width: 620px;
medium:       --scene-rhythm: 16px;  --scene-copy-width: 660px;
medium-dense: --scene-rhythm: 14px;  --scene-copy-width: 700px;
dense:        --scene-rhythm: 12px;  --scene-copy-width: 720px;
```
Composition token drives placement (`world.css`, ~lines 260–332):
- `focus` (Origin): fixed 620px column, left-anchored, no override.
- `operational` (Pickup, Final Mile): `max-width: min(var(--scene-copy-width), 680px)`.
- `split` (Sorting): `max-width: clamp(480px, 48vw, 560px)`, collapses to normal pacing width below 640px.
- `expansive` (Ground, Global): `align-items: flex-end; padding-block-end: 64px`, copy `max-width: min(var(--scene-copy-width), 760px)`; reverts to centered with no bottom padding at `max-width: 639px` or `max-height: 560px`.
- `resolution` (Delivered): uses sparse's width; only `.scene__cta { margin-top: 40px }` is emphasized.

### 4.4 Depth-layer architecture (`world.css` lines 32–60, `main.js`)
Every scene's decorative stack lives inside one `aria-hidden` `.scene__art` wrapper, painted bottom-to-top:
```
0  .scene__media       future still/video layer (media is null on every scene today)
1  .scene__atmosphere  background texture (hairline dot/line grid, 64px grid-size)
2  .scene__lighting    glow accents (hero's fixed dual glow, or a scene's accent-tinted single glow)
3  .scene__depth       animated route-line motif (hero + sparse-pacing scenes only)
4  .scene__scrim       legibility gradient, always present
```
`.scene__art` is `position: absolute; z-index: 0`; `.scene__copy` is `z-index: 1` and always wins. `pointer-events: none` on the whole art stack. This stacking context is fully self-contained and cannot collide with page-level chrome.

### 4.5 Atmosphere hierarchy
Hairline grid texture: two 1px lines at `rgb(255 255 255 / 4%)`, `background-size: 64px 64px`, masked by a radial gradient so it fades toward the frame edges. Hero glow blobs: 46vw square (max 560×560px), `border-radius: 50%`, `filter: blur(80px)`, `opacity: 0.55`, animated drift over 16s. Route-line SVG motif: `viewBox="0 0 800 600"`, two paths, one flowing bottom-left → top-right (`M40 520 C 220 380, 260 200, 460 160 S 720 120, 760 40`), one flowing the reverse direction at lower opacity — both on independent animation loops.

### 4.6 Overlay safe zones (page-level z-index stack)
```
route-rail: 400
nav: 500
tracking overlay: 900
skip-link: 1000
```
All defined independently, all untouched by the scene art stack (`world.css` comment, lines 46–53). `--nav-height: 72px` / `60px` mobile defines the reserved top strip.

### 4.7 Responsive behavior
Breakpoints in active use: `(max-width: 639px)` (mobile picture-source swap, split/expansive composition collapse) and `(max-width: 899px), (max-height: 560px)` (route-rail's own collapse threshold, `route-rail.css`). Scene container: `min-height: 100svh`/`100dvh`, `padding-inline: 24px` below 640px, `64px` at/above. `.scene__media` uses `object-fit: cover; object-position: center` for every media type.

**Media contract — all four schema fields.** `scene.media` is `{ still, video, mobileStill, mobileVideo }` (`config.js`); every scene ships this shape today with every value `null`. The four fields are not equally implemented — this table exists so that is never ambiguous:

| Field | Purpose | Implementation status | Browser support | Renderer support | Future roadmap |
|---|---|---|---|---|---|
| `still` | Primary static image for a scene | **Repository Standard** — real, active code path | `<img class="scene__media" src>`, native browser image loading | Consumed at `main.js:23,38`; also doubles as the `<video>` poster (`main.js:31`) when `video` is set | None needed — already load-bearing; simply dormant until a real asset path is supplied |
| `video` | Primary motion asset for a scene | **Repository Standard** — real, active code path | Single `<source src type="video/mp4">` inside `<video muted loop playsinline preload="none">` | Consumed at `main.js:23,26-32` | None needed for a single fixed asset; see `mobileVideo` below for the mobile variant |
| `mobileStill` | Recomposed still for portrait/mobile viewports whose subject can't survive a center-weighted `cover` crop | **Repository Standard** — real, active code path | `<source media="(max-width: 639px)" srcset>` inside `<picture>`, native JS-free swap | Consumed at `main.js:23,37` | None needed — already load-bearing |
| `mobileVideo` | A lighter mobile encode of `video`, intended to be source-swapped by breakpoint | **Reserved for Future Implementation.** The field exists in every scene's `media` object, but `main.js:23` destructures only `{ still, mobileStill, video }` — `mobileVideo` is never read by any render function today. The field's own doc comment in `config.js` states this directly: *"reserved for a future scroll-engine to source-swap via JS... not consumed by today's static render — swapping video sources by breakpoint needs JS to avoid downloading both encodes, which is out of scope for this architecture scaffold."* | **None today.** No code path renders a mobile-specific video under any input, including a populated one. | **Not consumed anywhere in `main.js`.** Supplying a `mobileVideo` path today has zero effect on the rendered page. | Wiring requires JS-driven breakpoint source-swapping (native `<video>` has no `<picture>`-style declarative equivalent) — explicitly deferred to the future scroll-engine milestone (Milestone 3). This is not a Scroll Camera concern (Section 6) — it is a plain asset-delivery optimization, independent of camera behavior. |

`mobileVideo` must never be treated as functional in any prompt, spec, or QA step derived from this handbook until the renderer is updated to consume it.

### 4.8 Accessibility constraints
- `prefers-reduced-motion: reduce` zeroes all motion durations (`tokens.css:74-79`: `--duration-fast/base/slow` → `0ms`) and is separately respected in `world.css:377`, `route-rail.css:71`, and `tracking.css:147`.
- Skip links (`main.js:146-147`, `base.css:91-109`): "Skip to journey" and "Skip to footer," visually hidden (`translateY(-150%)`) until `:focus-visible`, then jump to `z-index: 1000` above everything.
- `:focus-visible` global style: `2px solid var(--accent-strong)` outline, `2px` offset (`base.css:80-84`).
- The tracking panel (`tracking-panel.js`) is a full `role="dialog" aria-modal="true" aria-labelledby="tracking-title"`, with a focus trap (`a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])`) and `role="status" aria-live="polite"` on its status line.
- Nav (`nav.js`): `aria-label="Primary"`, toggle button uses `aria-expanded`/`aria-controls`, closes on `Escape`.
- Route-rail (`route-rail.js`): `aria-label="Shipment journey"`, active scene marked with `aria-current="true"`, driven today by `IntersectionObserver` (thresholds `0.25/0.5/0.75`) as an explicit stand-in for a future scroll-scrub engine.
- Every scene's decorative art stack is `aria-hidden="true"` in full (`main.js:76`) — none of it is ever exposed to assistive tech; scene sections instead carry `aria-labelledby="scene-{id}-title"`.
- `color-scheme: dark` is set at `:root` (`tokens.css:6`).

**Implication for production assets:** no generated image or video may be the sole carrier of information — everything decorative is `aria-hidden`, so titles/body copy must remain complete without the visual, and motion in any future generated video must fully stop under `prefers-reduced-motion: reduce`.

---

## 5. Production Standard v1.0 — Scope

Sections 6–13 below define the parts of visual production the repository has no opinion on yet: camera language, lighting model as applied to photographic/rendered scenes, fog density, material language, environmental direction, color grading beyond raw hex values, and transition philosophy between scenes. These are new, but every rule is derived from and constrained by the Repository Standards in Section 4 — none of it introduces a new palette, a new spacing system, or a new safe-zone rule.

---

## 6. Camera Bible (Production Standard v1.0)

This handbook governs three distinct cameras. Conflating them was a real ambiguity in the previous draft — this section exists to remove it permanently. Every future reference to "camera" anywhere in this document, in a scene sheet, or in a generation prompt must specify which of these three it means.

| Concept | What it is | Status | Governs |
|---|---|---|---|
| **Production Camera** | The camera used to generate a single still image — a fixed lens, height, tilt, and framing for one frame. | **Production Standard v1.0.** This is the camera the rules below (height, focal length, FOV, perspective) define. It is the only camera in active use for Phase 2B. | Every still image this handbook's QA checklist (Section 17) is checked against. |
| **Motion Camera** | The virtual camera path *within* a single generated video clip (e.g., a slow push or descent inside one scene's `video` asset) — self-contained motion that starts and ends inside that one clip, with no relationship to scroll position. | **Production Standard v1.0, not yet exercised.** No video asset exists yet (Section 4.7's media contract — `video` is Repository Standard as a code path but dormant as an asset). When a scene's first video is produced, its Motion Camera should use the *same* height/lens/tilt as that scene's Production Camera as its starting frame, then may move within the bounds of Section 15's continuity table. | Any future `video`/`mobileVideo` asset, once one exists. Not applicable to stills. |
| **Scroll Camera** | A hypothetical future camera whose position is driven by the visitor's scroll progress, transitioning continuously between scenes as they scroll (the "fly-through" concept implied by Section 15's continuity table). | **Reserved for Future Implementation. Does not exist today in any form.** The repository has no scroll-scrub engine — `route-rail.js`'s own comment states the current `IntersectionObserver`-based active-scene tracking is an explicit stand-in "the future scroll-scrub engine (Milestone 3) can drive... from its own progress value instead." Each scene today is plain static document flow with no pinning and no scroll-driven video (`world.css:2-4`). | Nothing today. Section 15's continuity table describes what this camera *should* do once Milestone 3 exists — it is not an instruction to build that engine now, and no part of this handbook should be read as claiming it already runs in the browser. |

**How they relate:** the Production Camera is the only one that produces anything today. The Motion Camera is the same creative doctrine (Sections 6–13) applied across a short clip instead of one frame, and doesn't exist until a `video` asset is actually generated. The Scroll Camera is a distinct, unbuilt browser capability — it would eventually *sequence* Motion Camera clips (or crossfade between stills) according to scroll position, but building it is a frontend milestone, not a visual-production task, and nothing in this handbook should be treated as a spec for browser code to write today.

| Rule (applies to the Production Camera; see Section 15 for how the Motion/Scroll Cameras extend it) | Specification |
|---|---|
| Camera height | Elevated observer by default — roughly a 2.5–3.5m vantage (a mezzanine/command-deck view), not eye-level and not full aerial. Two named exceptions: **Global** (true aerial, 60m+ equivalent) and **Delivered** (lowest in the set, ~1.8–2.2m, near eye-level, for a deliberately calm closing frame). |
| Focal length | 35mm-equivalent primary lens for six of seven scenes. **Global** is the one permitted exception at 24mm wide, needed to hold continental/network scale. |
| Field of view | ~63° horizontal at the 35mm baseline. Never exceed ~75° (reads as fisheye distortion) or drop below ~45° (reads as a cropped long lens) outside the Global exception. |
| Perspective style | Elevated three-point perspective, camera tilted down 5–12° into the scene (Global: 3–5°, near-level, matching a cruising-altitude read). Vanishing point sits center-right, matching the existing route-line SVG's own bottom-left → top-right motion path (Section 4.5) — every scene's dominant sightline follows that same diagonal. |
| Frame count | The Production Camera renders exactly one static frame per scene — it does not move. Any sense of motion in a still image comes from composition and implied direction only (e.g., a vehicle mid-motion, a light trail), never from camera movement, since a still has none. |

## 7. Lighting Bible (Production Standard v1.0)

| Rule | Specification |
|---|---|
| Light count | Two sources only: one key, one fill. Never a third. |
| Key light direction | Upper-right of frame, positioned analogously to the hero's existing glow blob at `80% across, 15% down` (Section 4.5). Color: the scene's single accent hex from `config.js` (Section 14 table) — electric-500/400 for motion-bearing scenes, matching the "motion, routes, tracking states" intent already stated in `tokens.css:15`. |
| Fill light direction | Lower-left of frame, positioned analogously to the hero's second glow blob at `10% across, 90% down`. Fixed color: `#2540b0` (royal-600) in every scene, regardless of that scene's accent — this is the one color that never changes, giving every frame a shared ambient floor. |
| Practicals | Off-white highlights only (`#eef2ff` / `#d7deff`), used sparingly for screens, indicator lights, or small practical sources — never as a third full light source. |
| Prohibited | Warm color temperature of any kind (amber/orange/neutral-white key light), overhead/flat lighting, a second accent hue mixed into one frame. |

## 8. Color Bible (Production Standard v1.0, built on Section 4.1 tokens)

| Rule | Specification |
|---|---|
| Grading curve | Cool-only. Shadow range `#05081f` → `#080f50`. Highlights carry the scene's accent hue — never pure white. Blacks crushed, not lifted; no warm-tone correction anywhere in the image. |
| Accent assignment | Exactly one accent hex per scene, taken only from the four already defined in `config.js`: `#2f8bff` (Ground, Delivered), `#4fa3ff` (Pickup, Global), `#2540b0` (used as universal fill, never as a scene accent), `#3654d6` (Sorting, Final Mile). Origin uses the fixed dual pair (`#2f8bff` + `#2540b0`) rather than a single accent, matching its existing hero-only CSS treatment. |
| Secondary palette | Off-whites (`#eef2ff`, `#d7deff`) for highlights/practicals only; mid-navy steps (`#101a6e`, `#182590`) for midground/structural shadow gradation. |

## 9. Material Language (Production Standard v1.0 — new; no repository precedent)

No "reflective," "glass," "chrome," or material-finish terminology exists anywhere in the codebase (confirmed by repo-wide search). This section is entirely new:

- All reflective surfaces (wet floors, glass curtain walls, brushed metal, vehicle bodies) are **dark and tinted with the scene's accent hue** — reflections must carry color, never a neutral chrome/silver highlight.
- The closest existing analog is `--surface-glass: rgb(255 255 255 / 6%)`, a translucency token used for card/nav backdrop blur (`nav.css`, `backdrop-filter: blur(14px) saturate(140%)`) — this informs the *translucency* feel of any glass surfaces in generated imagery (subtle, low-opacity, not a mirror-bright highlight), but does not itself define a "reflective" language, since it's never described that way in code.
- Architecture reads infrastructure-scale, not domestic-scale, with a repeating structural module rhythm that echoes the existing 64px hairline grid texture (Section 4.5) — i.e., regular structural bays, not irregular massing.

## 10. Atmosphere Rules (Production Standard v1.0, scaled by the existing `pacing` token)

| Rule | Specification |
|---|---|
| Density scaling | Atmosphere/fog density scales directly with each scene's existing `pacing` value (Section 4.3): sparse/resolution scenes (Origin, Delivered) get minimal haze and high clarity; medium/dense scenes (Sorting, Ground) get moderate volumetric haze for depth separation; Global (medium-dense) gets the heaviest atmosphere in the set, appropriate to altitude. |
| Fog behavior | Fog sits low, thickens toward the background, is tinted royal-600 (never neutral gray), and must never cross into the left-third negative-space zone (Section 11) or sit over a foreground subject. |
| Depth read | Three-layer separation matching the existing z-index stack (Section 4.4): foreground sharp/high-contrast, midground slightly desaturated, background atmospheric and blurred toward the horizon. |

## 11. Composition Rules (Production Standard v1.0, built directly on Section 4.3/4.6)

- Left/lower-left third of every frame is a permanent quiet zone — this is not new, it mirrors the existing scrim gradient (`linear-gradient(90deg, rgb(5 8 31 / 55%) 0%, rgb(5 8 31 / 30%) 35%, transparent 65%)`) which already fades left-to-right specifically to protect left-anchored copy, and the fixed 560–760px copy-width tokens in Section 4.3.
- Primary subject/action sits in the right two-thirds of frame.
- Foreground density stays low across all scenes, even "dense"-pacing ones, so it never competes with overlaid copy.
- Midground density scales with `pacing` (this is where scene-specific business activity lives).
- Background is always the busiest layer (network/scale cues), softened by atmosphere so it reads as context, not focal competition.

## 12. Responsive Crop Rules (Repository Standard, restated as production constraint)

Directly from Section 4.7 — restated here as a constraint on image composition, not a new rule:
- Default rendering is `object-fit: cover; object-position: center` behind a `(max-width: 639px)` breakpoint.
- Any scene whose focal subject cannot survive a center-weighted crop on a portrait viewport must ship a distinct `mobileStill`, recomposed so the subject sits within the center third of a portrait frame.
- At desktop/ultrawide widths, keep the primary subject within the center 80% of frame horizontally so it survives aggressive `cover` cropping without needing a second asset.

## 13. Overlay Safe Zones (Repository Standard, restated as production constraint)

Directly from Section 4.6: no generated image may place critical subject matter under the top `72px`/`60px` (nav, z-index 500) or be composed assuming the route-rail (z-index 400, left-edge) or tracking overlay (z-index 900, appears above both) are absent. Because the entire decorative art stack is `aria-hidden` (Section 4.8), no image may be the sole carrier of scene meaning — title/body copy (already written in `config.js`) must remain fully sufficient without it.

---

## 14. Scene Specifications (all seven scenes)

Pacing, composition, accent, and business-purpose values are Repository Standard (`config.js`). Production Camera framing, environment, and depth-layer casting are Production Standard v1.0, authored to fit those locked values.

### Scene 1 — Origin
| Field | Spec |
|---|---|
| Business purpose *(repo)* | TransRoyal introduction, value proposition, journey introduction, persistent tracking access (via nav) |
| Pacing / composition *(repo)* | sparse / focus |
| Accent *(repo)* | none — fixed dual glow (`#2f8bff` + `#2540b0`), hero-only treatment |
| Production Camera *(v1.0)* | Elevated command-deck vantage, static establishing frame, no subject — abstract architectural/network space |
| Environment *(v1.0)* | Command-center / network-origin interior, abstract rather than literal |
| Depth layers *(v1.0)* | FG: none (pure negative space); MG: ambient route-line motion; BG: soft architectural glow |

### Scene 2 — Pickup
| Field | Spec |
|---|---|
| Business purpose *(repo)* | Customer engagement, shipment creation, pickup process, customer experience |
| Pacing / composition *(repo)* | light / operational |
| Accent *(repo)* | `#4fa3ff` |
| Production Camera *(v1.0)* | Ground-adjacent elevated (~2.5m), loading bay looking outward toward vehicle/street |
| Environment *(v1.0)* | Loading dock / curbside pickup — driver, vehicle, handheld scanning device |
| Depth layers *(v1.0)* | FG: scanner device (sharp); MG: vehicle + driver (light density); BG: dock/street structure, softly atmospheric |

### Scene 3 — Sorting
| Field | Spec |
|---|---|
| Business purpose *(repo)* | Operational capability, logistics technology, reliability, service quality, processing expertise |
| Pacing / composition *(repo)* | medium / split |
| Accent *(repo)* | `#3654d6` |
| Production Camera *(v1.0)* | Elevated mezzanine (~3.5m), 8–10° tilt down a sorting line, static wide hold |
| Environment *(v1.0)* | Automated sorting hub interior — conveyors, scan arches, route-verification indicators |
| Depth layers *(v1.0)* | FG: quiet (protects split-composition copy column); MG: conveyor + parcels (medium density); BG: repeating hub structure, hazier |

### Scene 4 — Ground
| Field | Spec |
|---|---|
| Business purpose *(repo)* | Core services, domestic transportation, freight capabilities, logistics movement |
| Pacing / composition *(repo)* | dense / expansive |
| Accent *(repo)* | `#2f8bff` |
| Production Camera *(v1.0)* | Full elevated establishing shot (~3.5m, 28–35mm), low horizon in frame (mirrors the composition token's `flex-end` bottom-anchored copy) |
| Environment *(v1.0)* | Regional highway / fleet yard — multiple vehicles, cross-hub load activity |
| Depth layers *(v1.0)* | FG: quiet road surface; MG: fleet in motion (dense — busiest midground of the set); BG: horizon-scale hub silhouettes, heavy atmosphere |

### Scene 5 — Global (internal id `air`)
| Field | Spec |
|---|---|
| Business purpose *(repo)* | International logistics, network reach, global capabilities, company statistics |
| Pacing / composition *(repo)* | medium-dense / expansive |
| Accent *(repo)* | `#4fa3ff` |
| Production Camera *(v1.0)* | True aerial (60m+), 24mm wide (the one lens exception), near-level tilt (3–5°) |
| Environment *(v1.0)* | Aerial network view — flight/shipping lanes as light trails over continental/coastal landscape |
| Depth layers *(v1.0)* | FG: cloud wisps only; MG: route/light-trail network (medium-dense); BG: continental landmass, heaviest atmosphere in the set |

**Note on "company statistics":** the repo's `businessPurpose` array for this scene includes the literal string `"company statistics"`, and its `stats` field exists in the schema but is `null`/unused on every scene today — the repo itself notes no verified TransRoyal figures currently exist. This handbook does not invent any; if statistics are added later, they are a copy/data change, not a visual-production concern.

### Scene 6 — Final Mile
| Field | Spec |
|---|---|
| Business purpose *(repo)* | Shipment visibility, tracking technology, customer communication, final-mile operations |
| Pacing / composition *(repo)* | medium / operational |
| Accent *(repo)* | `#3654d6` |
| Production Camera *(v1.0)* | Elevated operational vantage (~2.5–3m) — same height/tilt family as Pickup, closing the human-scale loop |
| Environment *(v1.0)* | Residential final-mile street — delivery vehicle, live routing indicator, doorstep proximity |
| Depth layers *(v1.0)* | FG: quiet, doorstep-adjacent; MG: vehicle + figure (medium density); BG: residential street, moderate atmosphere |

### Scene 7 — Delivered
| Field | Spec |
|---|---|
| Business purpose *(repo)* | Trust, reliability, proof points, customer confidence, final CTA |
| Pacing / composition *(repo)* | sparse / resolution |
| Accent *(repo)* | `#2f8bff` |
| Production Camera *(v1.0)* | Static, near-eye-level (~1.8–2.2m, lowest in the set), no tilt — deliberately calm after six scenes of implied motion |
| Environment *(v1.0)* | Doorstep / completed delivery — parcel at rest, no vehicles or motion elements |
| Depth layers *(v1.0)* | FG: parcel at rest (sole sharp subject); MG: minimal (sparse, matches Origin); BG: lowest density in the set |

---

## 15. Scene-to-Scene Continuity (Production Standard v1.0)

| Transition | Continuity device |
|---|---|
| Origin → Pickup | Wide command-center view contracts to a single human-scale touchpoint; same diagonal sightline carried through; first human figure appears |
| Pickup → Sorting | Scanned parcel becomes the visual through-line; camera rises from dock-level to Sorting's mezzanine view |
| Sorting → Ground | Interior motion lines extend into exterior road lines; camera pulls back and up from mezzanine height to full establishing height |
| Ground → Global | Camera continues rising past establishing height into true aerial altitude; Ground's horizon becomes Global's altitude/curvature cue |
| Global → Final Mile | Camera descends from cruising altitude to street level; continental-scale light trail narrows to a single final-mile route, same electric-blue motion cue carried through |
| Final Mile → Delivered | Delivery vehicle's route resolves at a doorstep; motion fully stops, setting up Delivered's static resolution frame |
| Delivered → (end) | Terminal scene — no forward transition; composition deliberately mirrors Origin's sparse/quiet framing to bookend the narrative |

This table describes the **Scroll Camera** concept introduced in Section 6 — it is **Reserved for Future Implementation** and describes no code that exists today. No scroll-scrub or camera-animation engine exists in the repository yet (route-rail.js's own comment names this Milestone 3; `world.css:2-4` confirms each scene today is plain static document flow with no pinning). Until that engine exists, this table has one purpose only: it tells whoever generates each scene's Production Camera still (and, later, each scene's Motion Camera clip) how that asset should relate to its neighbors, so that a future Scroll Camera implementation has visually compatible material to sequence. It is not an instruction to build that engine now, and no part of this handbook should be read as claiming scroll-driven camera movement already runs in the browser.

---

## 16. Master Prompt Framework (Production Standard v1.0)

One reusable template; only five bracketed fields change per scene. This template generates a **Production Camera** still only (Section 6). The `CAMERA_DESTINATION` field is a compositional/implied-motion cue *within a single static frame* (e.g., a vehicle mid-motion, a light trail suggesting direction) — it does not instruct the image generator to move a camera, since a still has no camera movement to describe. When a scene's first Motion Camera clip is eventually produced, that separate process should start from this same still's framing; it is not generated by this template.

This template also carries every rule from **Production Standard v1.1** (Render Medium, Master Asset Standard, Human Rendering Standard) by reference, without restating them per scene — every generated prompt is understood to additionally specify: the AAA cinematic architectural-visualization / PBR render medium, the 3:2 4K Production Master output spec, and (for any scene with a human figure) the natural-skin-tone exception. Asserting these once, globally, is deliberate — it keeps this template the single place scene-specific wording changes, and the v1.1 appendix the single place the render medium, resolution, or skin-tone rule would ever change.

```
A premium dark cinematic scene in the TransRoyal brand world: cool navy-to-electric-blue
color grade (base #05081f to #080f50, accent [ACCENT_HEX]), no warm tones, crushed blacks.
Elevated three-point perspective, camera tilted 5-12 degrees into the frame (Global scene
only: near-level aerial), 35mm-equivalent lens (Global scene only: 24mm wide), dominant
sightline running bottom-left to top-right. Two-source lighting: key light [ACCENT_HEX]
from upper right, fill light #2540b0 royal-blue from lower left, no third light source.
Reflective surfaces are dark, wet-look, and tinted with the accent hue, never neutral
chrome. Oversized, infrastructure-scale architecture on a consistent structural rhythm.
Atmosphere and fog tinted royal-blue, thickening toward the background, low to the
ground, never crossing into the left third of frame. Foreground: minimal, uncluttered,
sharp focus. Midground: [BACKGROUND_ACTIVITY], density matched to scene pacing, slight
desaturation. Background: atmospheric, softly blurred, network-scale context.

Environment: [ENVIRONMENT].
Business purpose being conveyed: [BUSINESS_PURPOSE].
Foreground subject: [FOREGROUND_OBJECTS].
Implied motion cue within this single still frame (not a camera move): [CAMERA_DESTINATION].

Composition: left and lower-left third of frame kept visually quiet and empty (reserved
for overlaid text and UI). No subject matter under the top 72px or left route-rail region.
Shot for both a wide desktop crop and a center-weighted portrait mobile crop
(object-fit: cover, center) — keep the primary subject within the center 80% of frame
horizontally.
```

| Scene | ENVIRONMENT | BUSINESS_PURPOSE | FOREGROUND_OBJECTS | BACKGROUND_ACTIVITY | CAMERA_DESTINATION | ACCENT_HEX |
|---|---|---|---|---|---|---|
| Origin | command-center network origin, abstract/architectural | brand introduction, network trust | none (abstract glow/route lines) | ambient route-line motion | establishing, static | dual: `#2f8bff` + `#2540b0` |
| Pickup | loading dock / curbside pickup point | shipment creation, customer engagement | scanning device in hand | driver + vehicle at dock | push toward vanishing point | `#4fa3ff` |
| Sorting | automated sorting hub interior | operational precision, reliability | none (quiet foreground) | conveyors, scan arches, parcels | static, wide hold | `#3654d6` |
| Ground | regional highway / fleet yard | domestic freight, network movement | none (low road surface) | fleet vehicles, cross-hub loading | low static establishing shot | `#2f8bff` |
| Global | aerial continental/coastal view | international reach, network scale | cloud wisps only | light-trail flight/shipping lanes | level cruise, forward | `#4fa3ff` |
| Final Mile | residential final-mile street | live visibility, delivery tracking | none (doorstep-adjacent) | delivery vehicle, tracking indicator | descend toward doorstep | `#3654d6` |
| Delivered | doorstep at rest | trust, delivery confidence | parcel at rest | none (calm, minimal) | static, no motion | `#2f8bff` |

**Note on the `CAMERA_DESTINATION` column's wording:** several entries use motion language ("push toward vanishing point," "descend toward doorstep," "level cruise, forward") because they double as the Section 15 continuity intent for this scene's eventual **Motion Camera** clip. For the Production Camera still this template generates, treat each phrase as describing the *frame's implied direction* only — e.g. compose the still as if paused mid-way through that motion — never as an instruction for the image generator to move a camera. Once a scene's Motion Camera clip is produced, that phrase becomes the literal starting brief for the clip's actual movement.

---

## 17. Visual QA Checklist

- [ ] **Color palette** — only navy/electric-blue family used; accent hex matches the scene's single approved value (Section 8); no warm tones anywhere in frame.
- [ ] **Perspective** — elevated three-point perspective, correct tilt for the scene; dominant sightline runs bottom-left to top-right.
- [ ] **Camera height** — matches the scene's specified vantage; does not drift below Delivered's floor or above Global's ceiling.
- [ ] **Atmosphere** — fog/haze density matches the scene's `pacing` value; fog tinted royal-blue, never neutral gray; never crosses into the left third.
- [ ] **Lighting** — two-source only, key from upper-right in the scene's accent hue, fill from lower-left in `#2540b0`; no third light, no flat/overhead lighting.
- [ ] **Reflections** — any reflective surface is dark and accent-tinted; no neutral chrome/silver highlights.
- [ ] **Crop safety** — subject survives both a wide desktop `cover` crop and a center-weighted portrait mobile crop; flag for a dedicated `mobileStill` if it can't (Section 12).
- [ ] **Overlay safety** — no critical subject sits under the top nav strip or left route-rail region; left/lower-left third stays visually quiet (Section 13).
- [ ] **Browser readability** — image still reads once the scrim gradient and overlaid copy are composited on top; test against the actual scrim, not the raw image alone.
- [ ] **Narrative continuity** — camera height/tilt and motion direction connect sensibly to both the outgoing and incoming transitions in Section 15.
- [ ] **Accessibility** — image is decorative-only; scene title/body copy remains fully sufficient without it (Section 4.8/13); any generated video fully stops motion under `prefers-reduced-motion: reduce`.

---

## 18. Future Expansion Rules

- Any new scene inserted into the sequence must be assigned a `pacing` and `composition` value independently (per the Repository Standard convention that composition is never derived from pacing), and must derive its Production Camera/lighting spec from Section 6/7 rather than introducing a new camera or lighting model.
- Any new accent color must justify why the four existing accents (`#2f8bff`, `#4fa3ff`, `#2540b0`, `#3654d6`) are insufficient before being added — the palette is intentionally closed.
- The **Scroll Camera** (Section 6) remains Reserved for Future Implementation until Milestone 3 is built. When it is, Section 15's continuity table becomes the literal camera-path spec for that engine, not just a conceptual guide — no new transition philosophy should be authored at that point; the existing table should be implemented as-is. Building that engine is a frontend milestone; it does not require any change to this handbook's visual rules.
- If verified business statistics become available for the `stats` field (currently null on every scene), they are a data/copy addition only — they do not require any change to this handbook's visual rules.
- Any material or lighting language not covered here (e.g., a scene requiring rain, snow, or interior/exterior day-night distinction) requires an explicit v1.1 addendum to this document before generation — do not improvise a new material or atmosphere rule inline in a single prompt.

---

## Production Standard v1.1

Three production standards were identified by the prompt-generation system as required for every generation but missing from v1.0. They are documented here as an addendum — nothing in Sections 1–18 above is changed or superseded; these fill a gap, they don't revise a decision.

### Render Medium

**Production Standard v1.1.** The render medium for every scene, still or video, is:

- AAA cinematic architectural visualization
- Ultra-realistic physically-based rendering (PBR)
- Film-grade composition
- Architectural-visualization quality
- Controlled cinematic realism
- Large-scale environments
- Premium, minimal aesthetic

This is explicitly **not** photography, **not** stylized illustration, and **not** concept art. The intended effect: a viewer should initially read the image as a real photographed environment, only gradually recognizing it as an intentionally art-directed digital world. This governs every scene equally and is never scene-specific.

### Master Asset Standard

**Production Standard v1.1.** Every scene is generated once, at:

- **3:2** aspect ratio
- **4K** resolution
- Highest available quality setting
- As a **Production Master** — not a final browser asset

The Production Master is the single source every delivery format is derived from, never regenerated per format:

```
Production Master (3:2, 4K)
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

Each generated master must carry enough headroom and footroom around its primary subject to survive every stage of this pipeline without regeneration — this is why the master is captured wider (3:2) than any single delivery crop (e.g., the site's desktop framing) requires on its own.

### Human Rendering Standard

**Production Standard v1.1.** Where a scene includes a human figure (Pickup, Final Mile):

- Environment, lighting, architecture, vehicles, materials, and atmosphere all continue to follow the Color Bible (Section 8) exactly as written — no exception for anything non-human in frame.
- Human skin is rendered with a natural, realistic tone. It is exempt from the environmental cool grade.
- Blue light may reach skin only as environmental influence or rim light (i.e., light bouncing off a blue-lit environment, or a thin blue rim from the key/fill geometry) — never as an overall tint.
- Cyan- or blue-tinted skin is never acceptable output, under any circumstance.

This resolves the tension between Section 8's "no warm-tone correction anywhere in the image" rule and the presence of human figures: the cool grade governs everything in the frame except skin, which stays natural.

---

## Visual Decision Log

This log is the project's long-term historical record for visual decisions. Each entry is dated to the milestone it was made in, not rewritten in place — later revisions add new entries rather than editing old ones.

| Version | Decision | Status established |
|---|---|---|
| v1.0 | Production philosophy established | The site commits to a single fixed premium dark cinematic theme (no OS light/dark adaptation); pacing follows a symmetric sparse → dense → sparse rhythm; composition is a hand-assigned concern kept independent of pacing. (Repository Standard, documented in Sections 2–4) |
| v1.0 | Camera doctrine established | Three distinct cameras defined and permanently separated: **Production Camera** (active, governs every still), **Motion Camera** (defined, not yet exercised — no video asset exists), **Scroll Camera** (Reserved for Future Implementation — no scroll-scrub engine exists in the repository). (Section 6) |
| v1.0 | Media architecture established | All four `media` schema fields (`still`, `video`, `mobileStill`, `mobileVideo`) documented individually by implementation status. `still`/`video`/`mobileStill` are real, dormant code paths; `mobileVideo` is explicitly Reserved for Future Implementation and unconsumed by the current renderer. (Section 4.7) |
| v1.0 | Scene composition established | Lighting model (two-source, key/fill positions derived from the hero's real glow-blob geometry), closed four-accent color palette, and per-scene Production Camera/environment/depth-layer specs authored for all seven scenes. (Sections 7, 8, 14) |
| v1.0 | Future motion architecture deferred | Scene-to-scene continuity (Section 15) is recorded as a conceptual guide for a future Motion/Scroll Camera implementation, explicitly not an instruction to build a scroll-scrub engine now. No motion architecture is implemented as part of v1.0. |
| v1.1 | Render Medium established | Every scene generates as AAA cinematic architectural visualization / ultra-realistic PBR at UE5-cinematic quality — explicitly not photography, not stylized illustration, not concept art. Closes the "rendering medium" gap flagged after v1.0. (Production Standard v1.1) |
| v1.1 | Master Asset workflow established | Every scene generates once as a 3:2, 4K Production Master, from which Desktop, Tablet, Mobile, Video, Motion, and Frontend delivery formats are all derived — never regenerated per format. Closes the "base resolution/aspect ratio" gap flagged after v1.0. (Production Standard v1.1) |
| v1.1 | Human Rendering Standard established | Natural skin tones are exempt from the environmental cool grade; blue light may reach skin only as environmental influence or rim light, never as an overall tint; cyan/blue-tinted skin is never acceptable. Closes the "skin-tone under cool grade" gap flagged after v1.0 for Pickup and Final Mile. (Production Standard v1.1) |
