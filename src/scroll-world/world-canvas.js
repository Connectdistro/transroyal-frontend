import {
  ACESFilmicToneMapping,
  Color,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

const NAVY_950 = 0x05081f;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Mounts the persistent Three.js world (Production Handbook, Section 9, Layer
 * One). One renderer, one scene, one camera for the life of the session — the
 * canvas is never torn down or re-mounted as the visitor moves through the
 * journey. The DOM interface layer (Layer Two) composites above it and owns
 * all business logic; nothing here reads scene content or page state.
 */
export function mountWorldCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  container.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(new Color(NAVY_950), 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  let frameId = null;

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    renderer.setSize(width, height, false);
    camera.aspect = width / height || 1;
    camera.updateProjectionMatrix();
  }

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function loop() {
    renderFrame();
    frameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (frameId !== null) return;
    if (reducedMotion.matches) {
      renderFrame();
      return;
    }
    loop();
  }

  function stopLoop() {
    if (frameId === null) return;
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  reducedMotion.addEventListener('change', () => {
    stopLoop();
    startLoop();
  });

  window.addEventListener('resize', () => {
    resize();
    if (reducedMotion.matches) renderFrame();
  });

  resize();
  startLoop();

  return { renderer, scene, camera };
}
