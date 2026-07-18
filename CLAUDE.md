# TransRoyal Motion & Art Direction

This project is a cinematic scroll-driven logistics experience (Three.js), not a website with some animation on it. Treat it as a film rendered in real time.

Every implementation should satisfy these principles:

- Motion must have physical weight — anticipation, inertia, follow-through, settle.
- Every chapter tells part of one continuous logistics journey, not an independent loop.
- Hero objects guide the viewer's attention; secondary motion supports them without competing.
- Lighting and color evolve continuously across chapter boundaries, never cut.
- Materials should never appear perfectly uniform (see `materialVariation.js`'s `varyMaterial`).
- Scene transitions should feel like one uninterrupted shot wherever geometrically honest — don't fake a connection two regions' actual coordinates don't support.
- Every object has a purpose; every movement has a reason.
- Favor realism over spectacle.
- Extend the existing architecture; never rewrite it unless explicitly requested. Small commits, one behavior at a time, matching the style already in `git log`.

## Workflow for open-ended creative/visual-quality requests

A prompt like "make it more realistic" or "make the animation better" is too broad to act on directly — the safe interpretation (tweak an easing curve, add a small effect) is usually not what's actually being asked. For requests at that altitude, use this sequence instead of jumping to code:

1. **Art direction audit (Plan Mode, no code).** Per chapter: hero object, the story it's telling, what currently breaks realism, what's missing, which materials read as artificial, where motion lacks physical believability, what's an asset-fidelity ceiling (geometry/textures) versus something code can actually fix.
2. **Technical direction.** Convert the approved parts of the audit into a scoped implementation plan that extends the existing architecture — no new systems unless justified. Grouped into small, independently-validated commits.
3. **Implementation.** Only after the plan is approved. Verify each commit live (see the `verify` skill) before moving on.
4. **Cinematic review.** After implementing, a separate pass: critique only what the viewer sees (believability, where motion still feels robotic, what draws the eye vs. what should, what still reads as software). No code in this pass — findings feed the next round of art direction.

Be honest in step 1 about the difference between what's a code/animation/lighting problem (fixable) and what's a low-poly-geometry/no-texture-maps asset-fidelity ceiling (not fixable by tuning code — needs a real asset swap, which is the user's call, not something to fake with more animation).
