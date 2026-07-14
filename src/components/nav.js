const NAV_LINKS = [
  { href: '#scene-ground', label: 'Services' },
  { href: '#scene-air', label: 'Network' },
  { href: '#scene-origin', label: 'Journey' },
  { href: '#contact', label: 'Contact' },
];

/**
 * Mounts the persistent top navigation. Fixed above the future video layer at all
 * times — not tied to scroll position. Dispatches `transroyal:track-open` on
 * document when the Track Shipment action is used; tracking-panel.js listens for it.
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

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
    nav.classList.toggle('nav--menu-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  trackButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      setOpen(false);
      document.dispatchEvent(new CustomEvent('transroyal:track-open'));
    })
  );

  return nav;
}
