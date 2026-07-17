import { JOURNEY_LINKS, PRIMARY_LINKS } from '../content/site-links.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * `action: 'track'` -> a real button dispatching the same track-open event
 * as the bar's own Track Shipment action; `href` -> a real anchor.
 * `--link-index` drives each item's staggered reveal delay (nav.css).
 */
function renderMenuLink({ label, href, action }, index) {
  if (action === 'track') {
    return `<li style="--link-index:${index}"><button type="button" data-nav-track>${label}</button></li>`;
  }
  return `<li style="--link-index:${index}"><a href="${href}">${label}</a></li>`;
}

/**
 * Mounts the persistent primary navigation. Rebuilt from first principles
 * against the approved design reference (reference/*.png): there is no
 * horizontal link row at any viewport width. The bar itself carries only a
 * brand mark, a divider, and a menu toggle clustered on the left, plus one
 * quiet text action on the right -- every primary destination lives inside
 * the single full-screen overlay this toggle opens, at every breakpoint.
 * The reference doesn't distinguish "desktop nav" from "mobile nav"; it's
 * the same mechanism throughout, so this file no longer does either.
 *
 * The overlay itself is a two-column layout -- a muted "The Journey" column
 * beside a headline-scale "Get Started" column -- mirroring exactly the
 * reference's own open-menu structure (reference/Screenshot
 * 2026-07-16 173302.png) and reusing the same JOURNEY_LINKS/PRIMARY_LINKS
 * data footer.js renders, rather than a third, independent link list.
 *
 * Dispatches `transroyal:track-open` on document when either Track Shipment
 * action is used; tracking-panel.js listens for it.
 */
export function mountNav(container) {
  container.innerHTML = `
    <nav class="nav" aria-label="Primary">
      <div class="nav__bar">
        <div class="nav__cluster">
          <a class="nav__brand" href="#top">
            <span class="nav__brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22"><use href="/icons.svg#icon-mark"></use></svg>
            </span>
            <span class="nav__brand-name">TransRoyal</span>
          </a>

          <span class="nav__divider" aria-hidden="true"></span>

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

        <button type="button" class="nav__track-btn" data-nav-track>Track Shipment</button>
      </div>

      <div class="nav__menu" id="nav-menu">
        <div class="nav__menu-inner">
          <div class="nav__menu-col nav__menu-col--journey">
            <p class="nav__menu-label">The Journey</p>
            <ul>${JOURNEY_LINKS.map(renderMenuLink).join('')}</ul>
          </div>
          <div class="nav__menu-col nav__menu-col--primary">
            <p class="nav__menu-label">Get Started</p>
            <ul>${PRIMARY_LINKS.map(renderMenuLink).join('')}</ul>
          </div>
        </div>
      </div>
    </nav>
  `;

  const nav = container.querySelector('.nav');
  const toggle = container.querySelector('[data-nav-toggle]');
  const menu = container.querySelector('#nav-menu');
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
    menu.querySelector('a, button')?.focus();
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

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  trackButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      closeMenu();
      document.dispatchEvent(new CustomEvent('transroyal:track-open'));
    })
  );

  return nav;
}
