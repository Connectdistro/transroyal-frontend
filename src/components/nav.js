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
 * at rest -- it only gains a subtle backdrop once the visitor scrolls past
 * the opening frame, never a heavy fixed header -- with a full-screen
 * overlay menu below 900px instead of a dropdown. Dispatches
 * `transroyal:track-open` on document when Track Shipment is used;
 * tracking-panel.js listens for it.
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

        <ul class="nav__links" id="nav-links">
          ${NAV_LINKS.map(
            (link, i) => `<li style="--link-index:${i}"><a href="${link.href}">${link.label}</a></li>`
          ).join('')}
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
            aria-controls="nav-links"
          >
            <span class="visually-hidden">Menu</span>
            <span class="nav__toggle-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
        </div>
      </div>
    </nav>
  `;

  const nav = container.querySelector('.nav');
  const toggle = container.querySelector('[data-nav-toggle]');
  const links = container.querySelector('#nav-links');
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
    links.classList.toggle('is-open', open);
    nav.classList.toggle('nav--menu-open', open);
  }

  function openMenu() {
    lastFocused = document.activeElement;
    setOpen(true);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    links.querySelector('a')?.focus();
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

  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
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
