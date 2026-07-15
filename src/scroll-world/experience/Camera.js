import { PerspectiveCamera } from 'three';

export class Camera {
  constructor(experience) {
    this.experience = experience;
    this.sizes = experience.sizes;

    this.instance = new PerspectiveCamera(35, this.sizes.width / this.sizes.height || 1, 0.1, 1000);
    this.instance.position.set(0, 0, 5);
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height || 1;
    this.instance.updateProjectionMatrix();
  }
}
