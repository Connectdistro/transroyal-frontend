import { Environment } from './Environment.js';
import { OriginEnvironment } from './world/OriginEnvironment.js';

export class World {
  constructor(experience) {
    this.experience = experience;
    this.environment = new Environment(experience);
    this.origin = new OriginEnvironment(experience);
  }

  update() {
    this.origin.update(this.experience.time);
  }
}
