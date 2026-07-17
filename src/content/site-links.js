import { SCENES } from '../scroll-world/config.js';

// Shared between nav.js's menu overlay and footer.js -- the reference
// (reference/Screenshot 2026-07-16 173302.png) reuses the same two-zone
// link set in both places, and so do we, rather than maintaining two
// separate lists that could drift apart.

// The muted, in-page column -- the seven-chapter journey, reusing
// config.js's own SCENES rather than duplicating labels/ids.
export const JOURNEY_LINKS = SCENES.map((scene) => ({ label: scene.label, href: `#scene-${scene.id}` }));

// The editorial-scale column -- the site's only three real destinations
// beyond the journey itself.
export const PRIMARY_LINKS = [
  { label: 'Services', href: '#scene-pickup' },
  { label: 'Track Shipment', action: 'track' },
  { label: 'Contact', href: '#contact' },
];
