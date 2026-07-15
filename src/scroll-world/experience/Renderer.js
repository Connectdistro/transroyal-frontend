import { ACESFilmicToneMapping, Color, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

const NAVY_950 = 0x05081f;

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
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = PCFSoftShadowMap;
    this.resize();
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height, false);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.instance.render(this.scene.instance, this.camera.instance);
  }
}
