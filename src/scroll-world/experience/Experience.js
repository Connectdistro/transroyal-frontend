import { Scene } from 'three';
import { Sizes } from './Sizes.js';
import { Time } from './Time.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { World } from './World.js';
import { Environment } from './Environment.js';
import { Resources } from './Resources.js';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Root of the persistent Three.js world (Production Handbook Section 9).
 * Owns the renderer, scene, camera, sizes, time, world, environment, and
 * resource manager, and drives the single render loop for the life of the
 * session. A visitor with reduced motion enabled gets one static frame,
 * re-rendered only on resize, instead of a continuous loop.
 */
export class Experience {
  static instance;

  constructor(canvas) {
    if (Experience.instance) return Experience.instance;
    Experience.instance = this;

    this.canvas = canvas;
    this.container = canvas.parentElement;

    this.sizes = new Sizes(this.container);
    this.time = new Time();
    this.scene = new Scene();
    this.resources = new Resources();
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.world = new World(this);
    this.environment = new Environment(this);

    this.reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    this.frameId = null;

    this.sizes.addEventListener('resize', () => this.resize());
    this.time.addEventListener('tick', () => this.update());
    this.reducedMotion.addEventListener('change', () => {
      this.stopLoop();
      this.startLoop();
    });

    this.startLoop();
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();
    if (this.reducedMotion.matches) this.time.tick();
  }

  update() {
    this.camera.update();
    this.world.update();
    this.renderer.update();
  }

  loop() {
    this.time.tick();
    this.frameId = requestAnimationFrame(() => this.loop());
  }

  startLoop() {
    if (this.frameId !== null) return;
    if (this.reducedMotion.matches) {
      this.time.tick();
      return;
    }
    this.loop();
  }

  stopLoop() {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}
