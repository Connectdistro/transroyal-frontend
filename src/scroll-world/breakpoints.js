// Single source of truth for the mobile media breakpoint used by main.js and
// scene-preload.js. CSS can't read a JS constant inside a @media condition, so
// world.css's own `(max-width: 639px)` / `(min-width: 640px)` rules must still
// be kept in sync with this value by hand — this file is the one place that
// matters on the JS side.
export const MOBILE_BREAKPOINT_PX = 639;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;
