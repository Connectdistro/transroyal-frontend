const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Mounts the accessible tracking modal/panel. Frontend-only: submitting the form
 * never calls an API — it only surfaces a stubbed status message. Opens whenever
 * `transroyal:track-open` is dispatched on document (see nav.js), so tracking is
 * reachable from anywhere without scrolling the journey.
 */
export function mountTrackingPanel(container) {
  container.innerHTML = `
    <div class="tracking-overlay" data-tracking-overlay hidden>
      <div
        class="tracking-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-title"
        data-tracking-panel
      >
        <button type="button" class="tracking-panel__close" data-tracking-close>
          <span class="visually-hidden">Close tracking panel</span>
          <span aria-hidden="true">&times;</span>
        </button>

        <h2 id="tracking-title">Track your shipment</h2>
        <p class="tracking-panel__lede">
          Enter your TransRoyal tracking number to follow your shipment through the
          network.
        </p>

        <form data-tracking-form novalidate>
          <label for="tracking-number">Tracking number</label>
          <div class="tracking-panel__field">
            <input
              type="text"
              id="tracking-number"
              name="tracking-number"
              placeholder="e.g. TR-4821-9903"
              autocomplete="off"
            />
            <button type="submit">Track</button>
          </div>
        </form>

        <p class="tracking-panel__status" role="status" aria-live="polite" data-tracking-status></p>
      </div>
    </div>
  `;

  const overlay = container.querySelector('[data-tracking-overlay]');
  const panel = container.querySelector('[data-tracking-panel]');
  const closeBtn = container.querySelector('[data-tracking-close]');
  const form = container.querySelector('[data-tracking-form]');
  const status = container.querySelector('[data-tracking-status]');
  const input = container.querySelector('#tracking-number');

  let lastFocused = null;

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
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
    if (event.key === 'Escape') close();
    else trapFocus(event);
  }

  function open() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.addEventListener('keydown', onKeydown);
    document.body.style.overflow = 'hidden';
    input.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
    status.textContent = '';
    form.reset();
    const finish = () => {
      overlay.hidden = true;
    };
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? finish()
      : setTimeout(finish, 220);
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Frontend-only stub: no backend/API is wired up yet (see project plan M0 scope).
    status.textContent = input.value.trim()
      ? `Tracking lookup for "${input.value.trim()}" isn't connected yet — this is a preview of the tracking experience.`
      : 'Enter a tracking number to see a preview of the tracking experience.';
  });

  document.addEventListener('transroyal:track-open', open);

  return { open, close };
}
