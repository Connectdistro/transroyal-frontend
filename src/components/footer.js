const FOOTER_COLUMNS = [
  {
    heading: 'Services',
    links: ['Express Courier', 'Freight', 'Warehousing', 'International', 'Supply Chain'],
  },
  {
    heading: 'Company',
    links: ['About TransRoyal', 'Network', 'Careers', 'Newsroom'],
  },
  {
    heading: 'Support',
    links: ['Track a Shipment', 'Contact Us', 'Help Center', 'Claims'],
  },
];

/**
 * Static footer foundation. Lives outside the pinned scroll-world container — plain
 * document flow, no video/JS dependency.
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
                ${col.links.map((label) => `<li><a href="#">${label}</a></li>`).join('')}
              </ul>
            </div>`
          ).join('')}
        </div>
      </div>

      <div class="site-footer__bottom">
        <p>&copy; ${new Date().getFullYear()} TransRoyal Courier Services. All rights reserved.</p>
        <ul class="site-footer__legal">
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Terms of Service</a></li>
        </ul>
      </div>
    </footer>
  `;

  return container.querySelector('.site-footer');
}
