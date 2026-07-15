import { Sizes } from './Sizes.js';
import { Time } from './Time.js';
import { Scene } from './Scene.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { World } from './World.js';
import { Resources } from './Resources.js';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
    this.resources = new Resources(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.world = new World(this);

    this.reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    this.frameId = null;

    this.sizes.on('resize', () => this.resize());
    this.time.on('tick', () => this.update());
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

  destroy() {
    this.stopLoop();
    this.renderer.instance.dispose();
  }
}
