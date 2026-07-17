import { JOURNEY_LINKS, PRIMARY_LINKS } from '../content/site-links.js';

// No real legal pages exist yet -- renderLink's fallback (a non-focusable
// <span>) applies here exactly as it did before this rebuild.
const FOOTER_LEGAL = [{ label: 'Privacy Policy' }, { label: 'Terms of Service' }];

/**
 * Every link resolves generically, driven entirely by the data above --
 * never a per-label branch:
 *   - `action: 'track'` -> a real button reusing nav.js's existing
 *     tracking-panel trigger (dispatches `transroyal:track-open`, the same
 *     event nav.js's own Track Shipment action uses).
 *   - `href` present -> a real anchor to an existing page section.
 *   - neither -> an intentional, non-interactive <span>. No destination
 *     exists yet for these, and this project doesn't invent pages or fake
 *     links to paper over that. A <span> is never focusable, so keyboard
 *     users correctly skip it entirely instead of landing on a link that
 *     does nothing.
 */
function renderLink({ label, href, action }) {
  if (action === 'track') {
    return `<li><button type="button" data-footer-track>${label}</button></li>`;
  }
  if (href) {
    return `<li><a href="${href}">${label}</a></li>`;
  }
  return `<li><span class="site-footer__pending">${label}</span></li>`;
}

/**
 * Rebuilt against the approved design reference (reference/*.png): an
 * editorial two-zone layout, not a multi-column link directory. A muted
 * small column (the seven-chapter journey, reusing config.js's own SCENES)
 * sits beside a headline-scale column of the site's three real
 * destinations -- footer navigation carrying the same typographic weight
 * as a hero headline, exactly as the reference treats its own second
 * column. No boxed sections, no card borders; hierarchy comes from scale
 * and spacing alone. Lives outside the pinned scroll-world container --
 * plain document flow, no JS dependency beyond the one tracking-trigger
 * button.
 */
export function mountFooter(container) {
  container.innerHTML = `
    <footer class="site-footer" id="contact">
      <div class="site-footer__nav">
        <div class="site-footer__group site-footer__group--journey">
          <p class="site-footer__label">The Journey</p>
          <ul>${JOURNEY_LINKS.map(renderLink).join('')}</ul>
        </div>

        <div class="site-footer__group site-footer__group--primary">
          <p class="site-footer__label">Get Started</p>
          <ul>${PRIMARY_LINKS.map(renderLink).join('')}</ul>
        </div>
      </div>

      <div class="site-footer__bottom">
        <span class="site-footer__brand-name">TransRoyal</span>
        <ul class="site-footer__legal">${FOOTER_LEGAL.map(renderLink).join('')}</ul>
        <span class="site-footer__copyright">&copy; ${new Date().getFullYear()} TransRoyal Courier Services</span>
      </div>
    </footer>
  `;

  container.querySelector('[data-footer-track]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('transroyal:track-open'));
  });

  return container.querySelector('.site-footer');
}
