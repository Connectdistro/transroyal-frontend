import { Environment } from './Environment.js';
import { OriginEnvironment } from './world/OriginEnvironment.js';
import { PickupEnvironment } from './world/PickupEnvironment.js';
import { SortingEnvironment } from './world/SortingEnvironment.js';
import { GroundEnvironment } from './world/GroundEnvironment.js';
import { AirEnvironment } from './world/AirEnvironment.js';

/**
 * Every world region is instantiated once, up front, and lives permanently
 * in the scene graph (Section 9: "a single continuous scene graph, not seven
 * independent scenes swapped in and out"). Adding a chapter's environment is
 * a two-line change here: import the class, add one instance to `regions`.
 */
export class World {
  constructor(experience) {
    this.experience = experience;
    this.environment = new Environment(experience);
    this.regions = [
      new OriginEnvironment(experience),
      new PickupEnvironment(experience),
      new SortingEnvironment(experience),
      new GroundEnvironment(experience),
      new AirEnvironment(experience),
    ];
  }

  update() {
    this.regions.forEach((region) => region.update(this.experience.time));
  }
}
