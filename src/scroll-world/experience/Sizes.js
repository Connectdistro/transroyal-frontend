import { EventEmitter } from './utils/EventEmitter.js';

export class Sizes extends EventEmitter {
  constructor(container) {
    super();
    this.container = container;
    this.resize();

    this.observer = new ResizeObserver(() => {
      this.resize();
      this.emit('resize');
    });
    this.observer.observe(this.container);
  }

  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
  }
}
