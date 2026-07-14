// Single source of truth for the seven-scene shipment journey.
// route-rail.js reads this today; the future scroll-scrub engine (Milestone 3) will
// read the same array and attach `clip`/`still`/`poster` fields once assets exist.
export const SCENES = [
  {
    id: 'origin',
    index: 1,
    label: 'Origin',
    eyebrow: 'TransRoyal Network',
    title: 'Command Center / Network Origin',
    body: 'Every shipment begins inside the network that watches over it.',
  },
  {
    id: 'pickup',
    index: 2,
    label: 'Pickup',
    eyebrow: 'Shipment Prepared',
    title: 'Pickup & Intake',
    body: 'A parcel is scanned, labeled, and handed into the network.',
  },
  {
    id: 'sorting',
    index: 3,
    label: 'Sorting',
    eyebrow: 'Processing Hub',
    title: 'Sorting & Processing Hub',
    body: 'Automated routing sends every shipment down the right path.',
  },
  {
    id: 'ground',
    index: 4,
    label: 'Ground',
    eyebrow: 'Regional Network',
    title: 'Regional Ground Transport',
    body: 'A fleet in constant motion, covering the ground between hubs.',
  },
  {
    id: 'air',
    index: 5,
    label: 'Global',
    eyebrow: 'International Reach',
    title: 'Air Cargo & Global Network',
    body: 'Where the regional network becomes a global one.',
  },
  {
    id: 'final-mile',
    index: 6,
    label: 'Final Mile',
    eyebrow: 'Almost There',
    title: 'Destination City & Final-Mile',
    body: 'Into the destination city, on the last leg of the journey.',
  },
  {
    id: 'delivered',
    index: 7,
    label: 'Delivered',
    eyebrow: 'Successful Delivery',
    title: 'Successful Delivery & CTA',
    body: 'Delivered — and ready to ship with TransRoyal yourself.',
  },
];
