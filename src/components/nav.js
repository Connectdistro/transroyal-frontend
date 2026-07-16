const NAV_LINKS = [
  { href: '#scene-ground', label: 'Services' },
  { href: '#scene-air', label: 'Network' },
  { href: '#scene-origin', label: 'Journey' },
  { href: '#contact', label: 'Contact' },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const SCROLL_ELEVATE_THRESHOLD = 40;

/**
 * Mounts the persistent primary navigation. A floating, near-transparent bar
 * at rest -- it only gains a whisper of a backdrop once the visitor scrolls
 * past the opening frame, never a heavy fixed header. Dispatches
 * `transroyal:track-open` on document when Track Shipment is used;
 * tracking-panel.js listens for it.
 *
 * Desktop's inline link row (`.nav__links`) and the sub-900px full-screen
 * overlay (`.nav__menu`) are deliberately two separate elements, each
 * rendered from the same NAV_LINKS data, rather than one element that
 * changes role across the breakpoint. A single dual-role element previously
 * caused a real bug: crossing the 900px breakpoint while the page was open
 * made the browser animate the overlay's opacity/transform transition (only
 * ever meant to run on an explicit open/close) as a side effect of the
 * media query itself flipping -- a flash of full-screen menu text over the
 * hero. Two independent elements can't have that cross-breakpoint transition
 * at all: `.nav__menu` is `display: none` above 900px, and below it, its own
 * closed state never changes value as a result of viewport width.
 */
export function mountNav(container) {
  container.innerHTML = `
    <nav class="nav" aria-label="Primary">
      <div class="nav__inner">
        <a class="nav__brand" href="#top">
          <span class="nav__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26"><use href="/icons.svg#icon-mark"></use></svg>
          </span>
          <span class="nav__brand-name">TransRoyal</span>
        </a>

        <ul class="nav__links">
          ${NAV_LINKS.map((link) => `<li><a href="${link.href}">${link.label}</a></li>`).join('')}
        </ul>

        <div class="nav__actions">
          <button type="button" class="nav__track-btn" data-nav-track>
            <svg class="nav__track-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><use href="/icons.svg#icon-track"></use></svg>
            <span>Track Shipment</span>
          </button>

          <button
            type="button"
            class="nav__toggle"
            data-nav-toggle
            aria-expanded="false"
            aria-controls="nav-menu"
          >
            <span class="visually-hidden">Menu</span>
            <span class="nav__toggle-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
        </div>
      </div>

      <div class="nav__menu" id="nav-menu">
        <p class="nav__menu-eyebrow">Menu</p>
        <ul class="nav__menu-links">
          ${NAV_LINKS.map(
            (link, i) => `<li style="--link-index:${i}"><a href="${link.href}">${link.label}</a></li>`
          ).join('')}
        </ul>
      </div>
    </nav>
  `;

  const nav = container.querySelector('.nav');
  const toggle = container.querySelector('[data-nav-toggle]');
  const menu = container.querySelector('#nav-menu');
  const menuLinks = menu.querySelector('.nav__menu-links');
  const trackButtons = container.querySelectorAll('[data-nav-track]');

  let lastFocused = null;

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(nav.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') closeMenu({ restoreFocus: true });
    else trapFocus(event);
  }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    nav.classList.toggle('nav--menu-open', open);
  }

  function openMenu() {
    lastFocused = document.activeElement;
    setOpen(true);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    menuLinks.querySelector('a')?.focus();
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeMenu({ restoreFocus: true });
    else openMenu();
  });

  menuLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  // A live resize that carries the menu open across the 900px desktop
  // breakpoint would otherwise strand it open with no way to close (the
  // toggle button itself is desktop-hidden alongside the rest of .nav__menu
  // -- see the @media rule in nav.css). Closing on the crossing keeps the
  // two states from ever overlapping.
  const desktopQuery = window.matchMedia('(min-width: 900px)');
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  trackButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      closeMenu();
      document.dispatchEvent(new CustomEvent('transroyal:track-open'));
    })
  );

  // Stays fully transparent at rest -- an "elevated" backdrop only appears
  // once the visitor has scrolled, so the bar never competes with the
  // opening frame it floats above.
  let ticking = false;
  function updateElevation() {
    nav.classList.toggle('nav--elevated', window.scrollY > SCROLL_ELEVATE_THRESHOLD);
    ticking = false;
  }
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateElevation);
    },
    { passive: true }
  );
  updateElevation();

  return nav;
}
