// Single source of truth for the seven-scene TransRoyal shipment-journey narrative.
//
// Consumed today by main.js (scene rendering) and route-rail.js (id/index/label only —
// route-rail.js and nav.js are otherwise untouched by this schema).
//
// `businessPurpose` is planning/documentation metadata — intentionally NOT rendered in
// the DOM. It keeps each scene's narrative intent attached to its content as copy
// evolves, without leaking internal planning language into the page.
//
// `pacing` drives the sparse -> dense -> sparse rhythm (Alireza-inspired discipline).
// main.js also reads it to decide how much decorative art a scene gets: sparse scenes
// (the opening and closing beats) carry the animated route motif; denser scenes stay
// calmer so heavier content reads cleanly. Values: 'sparse' | 'light' | 'medium' |
// 'medium-dense' | 'dense'.
//
// `composition` is a separate, explicitly hand-assigned concern from `pacing` — it is
// never derived from it. Where `pacing` governs density/rhythm/breathing room,
// `composition` governs content placement, alignment, and narrative emphasis (see
// world.css's `[data-composition]` rules). Values: 'focus' | 'operational' | 'split' |
// 'expansive' | 'resolution'.
//
// `accent` is a brand-token hex reused to tint each scene's decorative glow, giving the
// seven CSS-authored placeholder environments a subtly distinct identity ahead of real
// generated art. Omitted on the hero scene, which uses its own fixed glow colors.
//
// `proofPoints` / `stats` / `cta` are optional. `stats` is currently unused by every
// scene — no verified TransRoyal figures exist yet — but renderStats() and its CSS stay
// wired up so adding a scene's stats later is a config-only change.
//
// `media` is reserved for the future cinematic layer. Every scene ships the same
// shape today — { still: null, video: null, mobileStill: null, mobileVideo: null }
// — with every value null because no generated assets exist yet.
//   - `still` doubles as the future <video>'s poster and lazy-load fallback once a
//     video exists (see main.js's renderSceneMedia()) — there is no separate
//     `poster` field, since that would just duplicate `still`.
//   - `mobileStill` is optional: only needed for a scene whose focal subject can't
//     survive object-fit: cover's center-weighted crop on a portrait viewport.
//   - `mobileVideo` is optional: a lighter mobile encode of `video`, selected via a
//     declarative <source media> query on initial load (main.js's
//     renderSceneMedia()) — the same JS-free mechanism `mobileStill` uses. It does
//     not re-select on a later resize/orientation change (video doesn't re-run
//     source selection reactively the way picture/img do); reactive breakpoint
//     swapping remains the future scroll-engine milestone's job.
// Wiring a still/video for a scene is a config-only change — main.js's
// renderSceneMedia()/renderSceneArt() already handle both the populated and null
// cases without a rendering rewrite.
export const SCENES = [
  {
    id: 'origin',
    index: 1,
    label: 'Origin',
    pacing: 'sparse',
    composition: 'focus',
    eyebrow: 'TransRoyal Network',
    title: 'Enter the Network',
    body: 'Every shipment begins inside the network built to move it — coordinated, monitored, and never out of sight.',
    businessPurpose: [
      'TransRoyal introduction',
      'value proposition',
      'journey introduction',
      'persistent tracking access (via nav)',
    ],
    cta: { label: 'Continue the journey', href: '#scene-pickup' },
    // Production still lands at /media/scenes/Scene_01_Production_Master.png —
    // see public/media/scenes/README.md. Once it exists, set `still` below to
    // that path; no other change is needed.
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'pickup',
    index: 2,
    label: 'Pickup',
    pacing: 'light',
    composition: 'operational',
    eyebrow: 'Shipment Prepared',
    title: 'Begin Your Journey',
    body: 'One scan starts the chain of custody — labeled, logged, and handed into the network within minutes of pickup.',
    businessPurpose: ['customer engagement', 'shipment creation', 'pickup process', 'customer experience'],
    proofPoints: ['Scheduled & on-demand pickup', 'Real-time intake scanning'],
    accent: '#4fa3ff',
    cta: { label: 'Start a Shipment', href: '#contact' },
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'sorting',
    index: 3,
    label: 'Sorting',
    pacing: 'medium',
    composition: 'split',
    eyebrow: 'Processing Hub',
    title: 'Built for Precision',
    body: 'Automated routing reads every label and sends each shipment down the fastest verified path — built to remove error, not just add speed.',
    businessPurpose: [
      'operational capability',
      'logistics technology',
      'reliability',
      'service quality',
      'processing expertise',
    ],
    proofPoints: ['Automated route verification', 'Continuous quality checks', 'Sub-hour hub processing'],
    accent: '#3654d6',
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'ground',
    index: 4,
    label: 'Ground',
    pacing: 'dense',
    composition: 'expansive',
    eyebrow: 'Regional Network',
    title: 'Moving What Matters',
    body: 'A fleet in constant motion covers the ground between hubs. Regional lanes run on fixed schedules with live coordination, keeping freight moving even when a single route is delayed.',
    businessPurpose: ['core services', 'domestic transportation', 'freight capabilities', 'logistics movement'],
    proofPoints: [
      'Scheduled regional lanes',
      'Dedicated & shared freight',
      'Live fleet coordination',
      'Cross-hub load balancing',
    ],
    // No verified figures yet — see the `stats` note at the top of this file.
    accent: '#2f8bff',
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'air',
    index: 5,
    label: 'Global',
    pacing: 'medium-dense',
    composition: 'expansive',
    eyebrow: 'International Reach',
    title: 'Connected Beyond Borders',
    body: 'Where the regional network becomes a global one — air cargo links TransRoyal hubs to destinations far beyond the region.',
    businessPurpose: ['international logistics', 'network reach', 'global capabilities', 'company statistics'],
    // No verified figures yet — see the `stats` note at the top of this file.
    accent: '#4fa3ff',
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'final-mile',
    index: 6,
    label: 'Final Mile',
    pacing: 'medium',
    composition: 'operational',
    eyebrow: 'Almost There',
    title: 'Visibility at Every Step',
    body: 'Into the destination city, on the last leg of the journey — status follows every shipment the whole way, visible anytime through Track Shipment.',
    businessPurpose: ['shipment visibility', 'tracking technology', 'customer communication', 'final-mile operations'],
    // Deliberately no functional tracking form here — Track Shipment (nav) remains the
    // single tracking interaction; this scene only demonstrates the capability.
    proofPoints: ['Live status updates', 'Final-mile routing'],
    accent: '#3654d6',
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
  {
    id: 'delivered',
    index: 7,
    label: 'Delivered',
    pacing: 'sparse',
    composition: 'resolution',
    eyebrow: 'Successful Delivery',
    title: 'Delivered with Confidence',
    body: 'Delivered — and ready to ship with TransRoyal again. Every shipment on the network is backed by the same standard of care.',
    businessPurpose: ['trust', 'reliability', 'proof points', 'customer confidence', 'final CTA'],
    // No verified figures yet — see the `stats` note at the top of this file.
    accent: '#2f8bff',
    cta: { label: 'Get in Touch', href: '#contact' },
    media: { still: null, video: null, mobileStill: null, mobileVideo: null },
  },
];
