const FOOTER_COLUMNS = [
  {
    heading: 'Services',
    links: [
      { label: 'Express Courier', href: '#scene-pickup' },
      { label: 'Freight', href: '#scene-ground' },
      { label: 'Warehousing' },
      { label: 'International', href: '#scene-air' },
      { label: 'Supply Chain' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About TransRoyal', href: '#scene-origin' },
      { label: 'Network', href: '#scene-air' },
      { label: 'Careers' },
      { label: 'Newsroom' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Track a Shipment', action: 'track' },
      { label: 'Contact Us', href: '#contact' },
      { label: 'Help Center' },
      { label: 'Claims' },
    ],
  },
];

const FOOTER_LEGAL = [{ label: 'Privacy Policy' }, { label: 'Terms of Service' }];

/**
 * Every footer link resolves generically, driven entirely by the data above —
 * never a per-label branch:
 *   - `action: 'track'` -> a real button reusing nav.js's existing
 *     tracking-panel trigger (dispatches `transroyal:track-open`, the same
 *     event nav.js's own Track Shipment button uses).
 *   - `href` present -> a real anchor to an existing page section.
 *   - neither -> an intentional, non-interactive <span>. No destination exists
 *     yet for these (Warehousing, Careers, a real Privacy Policy, etc.), and
 *     this project doesn't invent pages or fake links to paper over that. A
 *     <span> is never focusable, so keyboard users correctly skip it entirely
 *     instead of landing on a link that does nothing.
 */
function renderFooterLink({ label, href, action }) {
  if (action === 'track') {
    return `<li><button type="button" class="site-footer__action" data-footer-track>${label}</button></li>`;
  }
  if (href) {
    return `<li><a href="${href}">${label}</a></li>`;
  }
  return `<li><span class="site-footer__pending">${label}</span></li>`;
}

/**
 * Static footer foundation. Lives outside the pinned scroll-world container — plain
 * document flow, no JS dependency beyond the one tracking-trigger button below.
 */
export function mountFooter(container) {
  container.innerHTML = `
    <footer class="site-footer" id="contact">
      <div class="site-footer__top">
        <div class="site-footer__brand">
          <span class="site-footer__brand-name">TransRoyal</span>
          <p>Courier, logistics, and supply-chain services — moving forward, precisely.</p>
        </div>

        <div class="site-footer__columns">
          ${FOOTER_COLUMNS.map(
            (col) => `
            <div class="site-footer__column">
              <h3>${col.heading}</h3>
              <ul>
                ${col.links.map(renderFooterLink).join('')}
              </ul>
            </div>`
          ).join('')}
        </div>
      </div>

      <div class="site-footer__bottom">
        <p>&copy; ${new Date().getFullYear()} TransRoyal Courier Services. All rights reserved.</p>
        <ul class="site-footer__legal">
          ${FOOTER_LEGAL.map(renderFooterLink).join('')}
        </ul>
      </div>
    </footer>
  `;

  container.querySelector('[data-footer-track]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('transroyal:track-open'));
  });

  return container.querySelector('.site-footer');
}
