import { ACESFilmicToneMapping, Color, SRGBColorSpace, WebGLRenderer } from 'three';

const NAVY_950 = 0x05081f;

/**
 * Production Handbook Section 10 (Rendering Pipeline). Filmic tone mapping
 * and the brand's navy clear color are the only pipeline decisions that
 * apply before any scene content exists — bloom, depth of field, and the
 * rest of the post-processing stack are later production tasks.
 */
export class Renderer {
  constructor(experience) {
    this.experience = experience;
    this.canvas = experience.canvas;
    this.sizes = experience.sizes;
    this.scene = experience.scene;
    this.camera = experience.camera;

    this.instance = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.instance.setClearColor(new Color(NAVY_950), 1);
    this.instance.outputColorSpace = SRGBColorSpace;
    this.instance.toneMapping = ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1;
    this.resize();
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height, false);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.instance.render(this.scene, this.camera.instance);
  }
}
