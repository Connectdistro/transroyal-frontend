/**
 * DOM overlay for AssetGallery -- pure view + event wiring, mirrors this
 * codebase's existing `mount*(container, ...)` convention (see
 * components/nav.js, components/footer.js) rather than introducing a
 * different pattern for this one tool.
 */
const CONTROLS = [
  { key: '1', label: 'Reset', action: (g) => g.resetCamera() },
  { key: '2', label: 'Rotate', action: (g) => g.stepRotate() },
  { key: '3', label: 'Auto Orbit', action: (g) => g.toggleAutoOrbit(), active: (g) => g.controls.autoRotate },
  {
    key: '4',
    label: 'Play Animation',
    action: (g) => g.toggleAnimation(),
    active: (g) => g.state.animPlaying,
    disabled: (g) => !g.currentClips?.length,
  },
  {
    key: '5',
    label: 'Toggle Wireframe',
    action: (g) => g.setWireframe(!g.state.wireframe),
    active: (g) => g.state.wireframe,
  },
  {
    key: '6',
    label: 'Show Bounding Box',
    action: (g) => g.setBoundingBox(!g.state.showBBox),
    active: (g) => g.state.showBBox,
  },
  {
    key: '7',
    label: 'Show Skeleton',
    action: (g) => g.setSkeleton(!g.state.showSkeleton),
    active: (g) => g.state.showSkeleton,
    disabled: (g) => !g.currentStats?.hasSkinnedMesh,
  },
  { key: '8', label: 'HDRI On/Off', action: (g) => g.toggleHDRI(), active: (g) => g.state.hdriOn },
  {
    key: '9',
    label: 'Warm Lighting',
    action: (g) => g.setLighting('production'),
    active: (g) => g.state.lighting === 'production',
  },
  {
    key: '0',
    label: 'Neutral Lighting',
    action: (g) => g.setLighting('studio'),
    active: (g) => g.state.lighting === 'studio',
  },
];

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatVector(v) {
  if (!v) return '—';
  return `${v.x.toFixed(2)} × ${v.y.toFixed(2)} × ${v.z.toFixed(2)}`;
}

const TRIANGLE_WARN_THRESHOLD = 100000;
const FILE_SIZE_WARN_BYTES = 50 * 1024 * 1024;

/**
 * Builds only the overlay (topbar/stats/controls) -- the canvas is created
 * and owned by main.js/AssetGallery before this runs, since AssetGallery's
 * constructor needs a real, attachable canvas to create its WebGLRenderer
 * and OrbitControls (which bind pointer listeners directly to that element
 * at construction time -- swapping the element out afterward would leave
 * those listeners on the wrong node).
 */
export function mountGalleryUI(root, gallery) {
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';
  overlay.innerHTML = `
    <div class="gallery-topbar">
      <button class="gallery-btn" data-prev>&larr; Previous Asset</button>
      <div class="gallery-title">
        <span class="name" data-asset-name>Loading&hellip;</span>
        <span class="index" data-asset-index></span>
      </div>
      <button class="gallery-btn" data-next>Next Asset &rarr;</button>
    </div>
    <div class="gallery-stats">
      <dl>
        <dt>Asset Name</dt><dd data-stat="name"></dd>
        <dt>Group</dt><dd data-stat="group"></dd>
        <dt>GLB Size</dt><dd data-stat="size"></dd>
        <dt>Triangle Count</dt><dd data-stat="triangles"></dd>
        <dt>Draw Calls</dt><dd data-stat="drawCalls"></dd>
        <dt>Texture Count</dt><dd data-stat="textures"></dd>
        <dt>Material Count</dt><dd data-stat="materials"></dd>
        <dt>Animation Clips</dt><dd data-stat="animations"></dd>
        <dt>Skeleton</dt><dd data-stat="skeleton"></dd>
        <dt>Bounding Box</dt><dd data-stat="bbox"></dd>
        <dt>Pivot Location</dt><dd data-stat="pivot"></dd>
      </dl>
    </div>
    <div class="gallery-controls">
      ${CONTROLS.map((c) => `<button class="gallery-btn" data-control="${c.key}"><span class="key">${c.key}</span>${c.label}</button>`).join('')}
      <button class="gallery-btn" data-toggle-nodes>Node Inspector</button>
    </div>
    <div class="gallery-nodes" data-nodes hidden>
      <div class="gallery-nodes-header">Scene Graph</div>
      <div class="gallery-nodes-list" data-nodes-list></div>
    </div>
    <div class="gallery-loading" data-loading hidden>Loading asset&hellip;</div>
    <div class="gallery-error" data-error hidden></div>
  `;
  root.appendChild(overlay);

  const nameEl = overlay.querySelector('[data-asset-name]');
  const indexEl = overlay.querySelector('[data-asset-index]');
  const loadingEl = overlay.querySelector('[data-loading]');
  const errorEl = overlay.querySelector('[data-error]');
  const controlButtons = new Map(
    Array.from(overlay.querySelectorAll('[data-control]')).map((btn) => [btn.dataset.control, btn])
  );

  const stat = (key) => overlay.querySelector(`[data-stat="${key}"]`);

  function renderControls() {
    CONTROLS.forEach((c) => {
      const btn = controlButtons.get(c.key);
      const isActive = c.active?.(gallery) ?? false;
      const isDisabled = c.disabled?.(gallery) ?? false;
      btn.classList.toggle('active', isActive);
      btn.disabled = isDisabled;
    });
  }

  function renderStats(stats) {
    if (!stats) return;
    nameEl.textContent = stats.id;
    indexEl.textContent = `${stats.index + 1} / ${stats.total} — ${stats.group}`;

    stat('name').textContent = stats.id;
    stat('group').textContent = stats.group;

    const sizeEl = stat('size');
    sizeEl.textContent = formatBytes(stats.fileSizeBytes);
    sizeEl.classList.toggle('warn', (stats.fileSizeBytes ?? 0) > FILE_SIZE_WARN_BYTES);

    const triEl = stat('triangles');
    triEl.textContent = stats.triangles.toLocaleString();
    triEl.classList.toggle('warn', stats.triangles > TRIANGLE_WARN_THRESHOLD);

    stat('drawCalls').textContent = gallery.drawCalls;
    stat('textures').textContent = stats.textureCount;
    stat('materials').textContent = stats.materialCount;
    stat('animations').textContent = stats.animationClips;
    stat('skeleton').textContent = stats.hasSkinnedMesh ? 'yes' : 'none';
    stat('bbox').textContent = formatVector(stats.boundingBox);
    stat('pivot').textContent = formatVector(stats.pivot);

    renderControls();
  }

  const nodesPanel = overlay.querySelector('[data-nodes]');
  const nodesList = overlay.querySelector('[data-nodes-list]');

  function renderNodeTree() {
    if (nodesPanel.hidden) return;
    nodesList.innerHTML = gallery.nodeTree
      .map((node) => {
        const indent = node.depth * 16;
        const parts = [
          node.isMesh && node.triangles !== null ? `${node.triangles.toLocaleString()} tri` : null,
          node.materialName ? `mat: ${node.materialName}` : null,
          node.bbox ? `${node.bbox.x.toFixed(2)}×${node.bbox.y.toFixed(2)}×${node.bbox.z.toFixed(2)}` : null,
        ].filter(Boolean);
        return `
          <label class="gallery-node" style="padding-left:${indent}px">
            <input type="checkbox" data-node-toggle="${node.id}" ${node.visible ? 'checked' : ''} />
            <span class="gallery-node-name">${node.name}</span>
            <span class="gallery-node-type">${node.type}</span>
            ${parts.length ? `<span class="gallery-node-meta">${parts.join(' · ')}</span>` : ''}
          </label>`;
      })
      .join('');

    nodesList.querySelectorAll('[data-node-toggle]').forEach((input) => {
      input.addEventListener('change', () => {
        gallery.toggleNode(Number(input.dataset.nodeToggle));
      });
    });
  }

  overlay.querySelector('[data-toggle-nodes]').addEventListener('click', () => {
    nodesPanel.hidden = !nodesPanel.hidden;
    if (!nodesPanel.hidden) renderNodeTree();
  });

  gallery.on('asset:loading', (entry) => {
    loadingEl.hidden = false;
    errorEl.hidden = true;
    nameEl.textContent = `Loading ${entry.id}…`;
  });

  gallery.on('asset:loaded', (stats) => {
    loadingEl.hidden = true;
    renderStats(stats);
    renderNodeTree();
  });

  gallery.on('asset:error', ({ entry, error }) => {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = `Failed to load "${entry.id}": ${error.message}`;
  });

  gallery.on('state:change', renderControls);

  // Draw calls change every frame even on an unchanged asset (camera moves,
  // wireframe toggles) -- refresh that one figure continuously rather than
  // only on load, without re-rendering the whole stats panel every tick.
  setInterval(() => {
    const el = stat('drawCalls');
    if (el) el.textContent = gallery.drawCalls;
  }, 500);

  overlay.querySelector('[data-prev]').addEventListener('click', () => gallery.prev());
  overlay.querySelector('[data-next]').addEventListener('click', () => gallery.next());
  controlButtons.forEach((btn, key) => {
    btn.addEventListener('click', () => {
      const control = CONTROLS.find((c) => c.key === key);
      if (!control.disabled?.(gallery)) control.action(gallery);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      gallery.next();
      return;
    }
    if (event.key === 'ArrowLeft') {
      gallery.prev();
      return;
    }
    const control = CONTROLS.find((c) => c.key === event.key);
    if (control && !control.disabled?.(gallery)) control.action(gallery);
  });
}
