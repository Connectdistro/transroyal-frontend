import { Environment } from './Environment.js';

export class World {
  constructor(experience) {
    this.experience = experience;
    this.environment = new Environment(experience);
  }
}
