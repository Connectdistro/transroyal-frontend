import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Box3Helper,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  LoopRepeat,
  PCFSoftShadowMap,
  PerspectiveCamera,
  ACESFilmicToneMapping,
  Scene,
  SkeletonHelper,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EventEmitter } from '../scroll-world/experience/utils/EventEmitter.js';
import { Resources } from '../scroll-world/experience/Resources.js';
import { createLights } from '../scroll-world/experience/world/createLights.js';

const NEUTRAL_BG = 0x1c1c1f;
const BBOX_COLOR = 0x2f8bff;

/**
 * Standalone Three.js viewer -- deliberately its own scene graph, not a
 * World/Environment region. It exists to inspect the 46 production GLBs
 * registered in resources/manifest.js (many downloaded from different
 * sources, each with its own scale/pivot/material conventions) before any
 * of them is wired into a cinematic chapter. It reuses Resources/manifest
 * unmodified -- `id` lookups here are the exact ids every chapter will
 * eventually reference, so what's verified here transfers directly.
 */
export class AssetGallery extends EventEmitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;

    this.scene = new Scene();
    this.scene.background = new Color(NEUTRAL_BG);

    this.camera = new PerspectiveCamera(45, 1, 0.01, 10000);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = false; // shadow camera bounds are tuned per-chapter (createLights.js); a generic auto-framed viewer spans too wide a scale range for one fixed frustum to serve every asset
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // Resources.load() only ever reads `context.renderer.instance` (the
    // generatedEnvMap loader) and `context.scene` (unused by every other
    // loader) -- this stub satisfies that contract without pulling in the
    // full Experience/Sizes/Time apparatus a production chapter needs.
    this.resources = new Resources({ renderer: { instance: this.renderer }, scene: null });

    this.clock = new Clock();
    this.state = {
      // Auto-orbit has no entry here -- `controls.autoRotate` (OrbitControls'
      // own flag) already is that state; a mirrored field would just be a
      // second source of truth to keep in sync.
      index: 0,
      wireframe: false,
      showBBox: false,
      showSkeleton: false,
      animPlaying: false,
      lighting: 'studio',
      hdriOn: false,
    };

    this.currentRoot = null;
    this.currentClips = [];
    this.currentStats = null;
    this.mixer = null;
    this.action = null;
    this.bboxHelper = null;
    this.skeletonHelper = null;
    this.envMap = null;

    this.assetList = this.resources.manifest.filter((entry) => entry.type === 'gltf');

    this.grid = new GridHelper(20, 20, 0x3a3a40, 0x2a2a2e);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.4;
    this.scene.add(this.grid);

    this.buildLighting();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.tick = this.tick.bind(this);
    this.renderer.setAnimationLoop(this.tick);
  }

  /** Production rig reused verbatim (createLights.js) -- "Production"
   *  lighting in this viewer IS the same warm two-source doctrine every
   *  chapter uses, not a lookalike. "Studio" is a separate, neutral
   *  three-point rig for judging an asset's true material color, unbiased
   *  by the cinematic warm grade. */
  buildLighting() {
    const { key, fill } = createLights();
    this.productionLights = [key, fill, key.target, fill.target];
    this.productionLights.forEach((l) => this.scene.add(l));

    this.studioKey = new DirectionalLight(0xffffff, 3.2);
    this.studioKey.position.set(6, 10, 8);
    this.studioFill = new DirectionalLight(0xffffff, 1.4);
    this.studioFill.position.set(-8, 4, -6);
    this.studioRim = new DirectionalLight(0xffffff, 1.1);
    this.studioRim.position.set(0, 6, -10);
    this.studioAmbient = new AmbientLight(0xffffff, 0.35);
    this.studioLights = [this.studioKey, this.studioFill, this.studioRim, this.studioAmbient];
    this.studioLights.forEach((l) => this.scene.add(l));

    this.setLighting('studio');
  }

  setLighting(mode) {
    this.state.lighting = mode;
    const productionOn = mode === 'production';
    this.productionLights.forEach((l) => {
      if (l.isLight) l.visible = productionOn;
    });
    this.studioLights.forEach((l) => (l.visible = !productionOn));
    this.emit('state:change', this.state);
  }

  async toggleHDRI() {
    this.state.hdriOn = !this.state.hdriOn;
    if (this.state.hdriOn) {
      if (!this.envMap) this.envMap = await this.resources.load('world-environment');
      this.scene.environment = this.envMap;
      this.scene.background = this.envMap;
    } else {
      this.scene.environment = null;
      this.scene.background = new Color(NEUTRAL_BG);
    }
    this.emit('state:change', this.state);
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  async fetchFileSize(path) {
    try {
      const res = await fetch(path, { method: 'HEAD' });
      const len = res.headers.get('content-length');
      return len ? Number(len) : null;
    } catch {
      return null;
    }
  }

  computeMeshStats(root) {
    let triangles = 0;
    const materials = new Set();
    const textures = new Set();
    let hasSkinnedMesh = false;

    root.traverse((child) => {
      if (child.isSkinnedMesh) hasSkinnedMesh = true;
      if (!child.isMesh) return;

      const geometry = child.geometry;
      if (geometry) {
        const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
        triangles += count / 3;
      }

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((material) => {
        if (!material) return;
        materials.add(material);
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'].forEach((slot) => {
          if (material[slot]) textures.add(material[slot]);
        });
      });
    });

    return { triangles: Math.round(triangles), materialCount: materials.size, textureCount: textures.size, hasSkinnedMesh };
  }

  frameCameraToObject(object) {
    const box = new Box3().setFromObject(object);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    const radius = Math.max(sphere.radius, 0.001);

    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distance = (radius / Math.sin(fovRad / 2)) * 1.35;
    const direction = new Vector3(1, 0.6, 1).normalize();

    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.near = Math.max(distance / 200, 0.01);
    this.camera.far = distance * 200;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(center);

    this.controls.target.copy(center);
    this.controls.update();
    this.controls.saveState();

    this.grid.scale.setScalar(Math.max((radius * 2) / 10, 0.1));
    this.grid.position.set(center.x, box.min.y, center.z);

    return { size, center, radius, distance };
  }

  clearCurrent() {
    if (this.currentRoot) this.scene.remove(this.currentRoot);
    if (this.bboxHelper) this.scene.remove(this.bboxHelper);
    if (this.skeletonHelper) this.scene.remove(this.skeletonHelper);
    this.currentRoot = null;
    this.bboxHelper = null;
    this.skeletonHelper = null;
    this.mixer = null;
    this.action = null;
    this.currentClips = [];
  }

  async goTo(index) {
    const list = this.assetList;
    const clamped = ((index % list.length) + list.length) % list.length;
    const entry = list[clamped];

    this.emit('asset:loading', entry);
    const fileSizePromise = this.fetchFileSize(entry.path);

    let gltf;
    try {
      gltf = await this.resources.load(entry.id);
    } catch (error) {
      this.emit('asset:error', { entry, error });
      return;
    }
    if (!gltf) {
      this.emit('asset:error', { entry, error: new Error(`Failed to load ${entry.id}`) });
      return;
    }

    this.clearCurrent();
    this.state.index = clamped;

    const clone = this.resources.clone(entry.id);
    const root = clone.scene;
    root.position.set(0, 0, 0);
    this.scene.add(root);

    this.currentRoot = root;
    this.currentClips = clone.animations ?? [];

    // Reset per-asset toggle state to a clean baseline -- a previous
    // asset's wireframe/bbox/skeleton state shouldn't leak onto the next.
    this.state.wireframe = false;
    this.state.showBBox = false;
    this.state.showSkeleton = false;
    this.state.animPlaying = false;
    this.controls.autoRotate = false;

    if (this.currentClips.length) {
      this.mixer = new AnimationMixer(root);
      this.action = this.mixer.clipAction(this.currentClips[0]);
      this.action.setLoop(LoopRepeat, Infinity);
      this.action.paused = true;
      this.action.play();
    }

    const frame = this.frameCameraToObject(root);
    const meshStats = this.computeMeshStats(root);
    const fileSizeBytes = await fileSizePromise;

    this.currentStats = {
      id: entry.id,
      path: entry.path,
      group: entry.group,
      index: clamped,
      total: list.length,
      fileSizeBytes,
      triangles: meshStats.triangles,
      materialCount: meshStats.materialCount,
      textureCount: meshStats.textureCount,
      animationClips: this.currentClips.length,
      hasSkinnedMesh: meshStats.hasSkinnedMesh,
      boundingBox: frame.size,
      pivot: root.position.clone(),
    };

    this.emit('asset:loaded', this.currentStats);
    this.emit('state:change', this.state);
  }

  next() {
    return this.goTo(this.state.index + 1);
  }

  prev() {
    return this.goTo(this.state.index - 1);
  }

  resetCamera() {
    this.controls.reset();
  }

  stepRotate() {
    if (!this.currentRoot) return;
    this.currentRoot.rotation.y += Math.PI / 2;
  }

  toggleAutoOrbit() {
    this.controls.autoRotate = !this.controls.autoRotate;
    this.controls.autoRotateSpeed = 2.2;
    this.emit('state:change', this.state);
  }

  setWireframe(on) {
    this.state.wireframe = on;
    if (this.currentRoot) {
      this.currentRoot.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((material) => {
          if (material) material.wireframe = on;
        });
      });
    }
    this.emit('state:change', this.state);
  }

  setBoundingBox(on) {
    this.state.showBBox = on;
    if (this.bboxHelper) {
      this.scene.remove(this.bboxHelper);
      this.bboxHelper = null;
    }
    if (on && this.currentRoot) {
      const box = new Box3().setFromObject(this.currentRoot);
      this.bboxHelper = new Box3Helper(box, BBOX_COLOR);
      this.scene.add(this.bboxHelper);
    }
    this.emit('state:change', this.state);
  }

  setSkeleton(on) {
    this.state.showSkeleton = on;
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;
    }
    if (on && this.currentRoot && this.currentStats?.hasSkinnedMesh) {
      this.skeletonHelper = new SkeletonHelper(this.currentRoot);
      this.scene.add(this.skeletonHelper);
    }
    this.emit('state:change', this.state);
  }

  toggleAnimation() {
    if (!this.action) return;
    this.state.animPlaying = !this.state.animPlaying;
    this.action.paused = !this.state.animPlaying;
    this.emit('state:change', this.state);
  }

  tick() {
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls() {
    return this.renderer.info.render.calls;
  }
}
