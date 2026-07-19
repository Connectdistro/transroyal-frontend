/**
 * Single manifest describing every production asset (Production Handbook
 * Section 26, Asset Pipeline). Generic by design — Resources never branches
 * on an asset's id; adding a new scene's assets is a manifest-only change.
 *
 * Each entry: { id, type, path, group, preload }
 *   type:    'texture' | 'cubeTexture' | 'hdr' | 'gltf' | 'video' | 'generatedEnvMap'
 *   group:   'core' | 'environment' | 'scene' | 'ui' | 'video' | 'aircraft' |
 *            'vehicles' | 'buildings' | 'logistics' | 'environment-props' |
 *            'characters'
 *   preload: whether this asset loads as part of its group's preload pass
 *
 * `path` is `null | string | string[]` — cube textures take an ordered array
 * of six face paths; every other type takes a single path; `generatedEnvMap`
 * takes `null` (it has no source file, see loaders.js).
 *
 * The `world-environment` entry below is a fallback, not a permanent asset
 * (Cinematic Polish Phase, Commit 1): `Environment.js` has always looked up
 * this exact id, but nothing registered it until now, so `scene.environment`
 * was previously dead code. Upgrading to a real photographic HDR later is a
 * manifest-only change — flip `type` to `'hdr'` and `path` to a real file;
 * `Environment.js` and every other consumer need no change either way.
 *
 * Production GLB entries below (Asset Integration Foundation): registered
 * from the actual contents of public/models/, cross-checked against file
 * size and content hash before being added, not transcribed blind. Every
 * one is `preload: false` deliberately -- nothing in the app calls
 * loadGroup()/preloadGroups() yet (confirmed: no call site exists today), so
 * this flag is inert either way, but `false` correctly declares "registered,
 * not yet wired into any chapter" rather than implying a preload pass that
 * doesn't run. No chapter references any of these ids yet -- registering
 * them here changes nothing about what renders.
 *
 * Four assets are deliberately NOT registered (see docs/ART_DIRECTION_AUDIT.md-
 * style honesty -- flagged, not silently dropped):
 *   - buildings/cargo_terminal/*.glb (x2) -- third-party ("Cathay Pacific")
 *     branding baked into the filename/likely the model itself.
 *   - characters/customer/male_zombie_character_around_6_feet_tall.glb and
 *     .../psychedelic_rainbow_shirt_portrait.glb -- neither is a plausible
 *     logistics customer; placeholder or mis-sourced downloads.
 * A fifth file, characters/warehouse_worker/delivery_worker_with_package_and_
 * tablet.glb, is byte-identical (verified via md5) to characters/courier/
 * delivery_worker_with_package_and_tablet.glb -- registered once, under the
 * courier path; the warehouse_worker copy is a redundant duplicate on disk,
 * not a second asset, and should be deleted rather than registered twice
 * (which would cause two network requests for identical content).
 */
// Vite serves this app under a configured base path (vite.config.js's
// `base`) in both dev and production -- an absolute '/models/...' path
// bypasses that base and 404s (confirmed live). Every model path below is
// base-relative instead, the same convention nav.js's own icon sprite
// reference already established.
const BASE = import.meta.env.BASE_URL;

export const MANIFEST = [
  { id: 'world-environment', type: 'generatedEnvMap', path: null, group: 'environment', preload: true },

  // Aircraft (6)
  { id: 'beltLoader', type: 'gltf', path: `${BASE}models/aircraft/belt_loader/low_poly_belt_loader.glb`, group: 'aircraft', preload: false },
  { id: 'cargoLoader', type: 'gltf', path: `${BASE}models/aircraft/cargo_loader/loadtitan_7000.glb`, group: 'aircraft', preload: false },
  { id: 'cargoPlane', type: 'gltf', path: `${BASE}models/aircraft/cargo_plane/c17_plane_game-ready.glb`, group: 'aircraft', preload: false },
  { id: 'aircraftFuelTruck', type: 'gltf', path: `${BASE}models/aircraft/fuel_truck/fuel_truck.glb`, group: 'aircraft', preload: false },
  { id: 'groundPowerUnit', type: 'gltf', path: `${BASE}models/aircraft/gpu/gpu_aiport_ground_power_unit.glb`, group: 'aircraft', preload: false },
  { id: 'airportTug', type: 'gltf', path: `${BASE}models/aircraft/tug/airport_tug.glb`, group: 'aircraft', preload: false },

  // Buildings (5 -- cargo_terminal x2 quarantined, see doc comment above)
  { id: 'headquartersA', type: 'gltf', path: `${BASE}models/buildings/headquarters/4b8dbc736dc045638dafbc1a8d4b4487.glb`, group: 'buildings', preload: false },
  { id: 'headquartersB', type: 'gltf', path: `${BASE}models/buildings/headquarters/numiteg.glb`, group: 'buildings', preload: false },
  { id: 'storefront', type: 'gltf', path: `${BASE}models/buildings/storefront/store_front_from_night_work_in_a_shop.glb`, group: 'buildings', preload: false },
  // 166MB on disk -- flagged in the production report as needing Blender
  // optimization before any chapter can reference it; registered (the
  // manifest is just data) but not verified via live load.
  { id: 'suburbanHouse', type: 'gltf', path: `${BASE}models/buildings/suburban_house/two-storey_suburban_house.glb`, group: 'buildings', preload: false },
  { id: 'warehouse', type: 'gltf', path: `${BASE}models/buildings/warehouse/warehouse_fbx_model_free.glb`, group: 'buildings', preload: false },

  // Characters (7 -- customer x2 quarantined; one exact duplicate excluded, see doc comment above)
  { id: 'airportWorker', type: 'gltf', path: `${BASE}models/characters/airport_worker/construction_worker_in_high-visibility_vest.glb`, group: 'characters', preload: false },
  { id: 'courierDeliveryWorker', type: 'gltf', path: `${BASE}models/characters/courier/delivery_worker_with_package_and_tablet.glb`, group: 'characters', preload: false },
  { id: 'courierGrocery', type: 'gltf', path: `${BASE}models/characters/courier/grocery_delivery_worker.glb`, group: 'characters', preload: false },
  { id: 'courierWarehouseWorker', type: 'gltf', path: `${BASE}models/characters/courier/warehouse_worker_with_boxes.glb`, group: 'characters', preload: false },
  { id: 'driver', type: 'gltf', path: `${BASE}models/characters/driver/driver.glb`, group: 'characters', preload: false },
  { id: 'warehouseWorkerTraining', type: 'gltf', path: `${BASE}models/characters/warehouse_worker/construction_worker_in_training.glb`, group: 'characters', preload: false },
  { id: 'customerServiceRep', type: 'gltf', path: `${BASE}models/characters/warehouse_worker/uniformed_customer_service_representative.glb`, group: 'characters', preload: false },

  // Environment props (14)
  // 14MB despite being a single fence prop -- worth a look before use, though
  // not in the same tier as the four multi-hundred-MB outliers below.
  { id: 'fence', type: 'gltf', path: `${BASE}models/environment/fences/fance_17mb.glb`, group: 'environment-props', preload: false },
  { id: 'guardrail', type: 'gltf', path: `${BASE}models/environment/guardrails/guardrail.glb`, group: 'environment-props', preload: false },
  { id: 'guardrailWithTerminal', type: 'gltf', path: `${BASE}models/environment/guardrails/guardrail_and_terminal.glb`, group: 'environment-props', preload: false },
  { id: 'streetlightStone', type: 'gltf', path: `${BASE}models/environment/streetlights/brown_stone_streetlight_2.glb`, group: 'environment-props', preload: false },
  { id: 'streetlightFreeway', type: 'gltf', path: `${BASE}models/environment/streetlights/freeway_streetlight_1.glb`, group: 'environment-props', preload: false },
  { id: 'streetlightGreenfield', type: 'gltf', path: `${BASE}models/environment/streetlights/greenfield_wisconsin_streetlight.glb`, group: 'environment-props', preload: false },
  // 151MB -- flagged in the production report, not verified via live load.
  { id: 'streetAssetPack', type: 'gltf', path: `${BASE}models/environment/streetlights/street_asset_pack.glb`, group: 'environment-props', preload: false },
  { id: 'trafficSign', type: 'gltf', path: `${BASE}models/environment/traffic_signs/road_traffic_sign.glb`, group: 'environment-props', preload: false },
  { id: 'treesForestPack', type: 'gltf', path: `${BASE}models/environment/trees/low_poly_forest_tree_pack.glb`, group: 'environment-props', preload: false },
  { id: 'treesOak', type: 'gltf', path: `${BASE}models/environment/trees/oak_trees.glb`, group: 'environment-props', preload: false },
  { id: 'treesLowPoly', type: 'gltf', path: `${BASE}models/environment/trees/trees_low_poly.glb`, group: 'environment-props', preload: false },
  { id: 'utilityPoleRural', type: 'gltf', path: `${BASE}models/environment/utility_poles/rural_area_old_concrete_electric_utility_pole.glb`, group: 'environment-props', preload: false },
  // 105MB -- flagged in the production report, not verified via live load.
  { id: 'utilityPoleTelephone', type: 'gltf', path: `${BASE}models/environment/utility_poles/telephone_pole.glb`, group: 'environment-props', preload: false },
  { id: 'utilityPole2048', type: 'gltf', path: `${BASE}models/environment/utility_poles/utility_pole_-_2048px2.glb`, group: 'environment-props', preload: false },

  // Logistics (7)
  { id: 'boxesSet', type: 'gltf', path: `${BASE}models/logistics/boxes/boxes.glb`, group: 'logistics', preload: false },
  { id: 'cardboardBox', type: 'gltf', path: `${BASE}models/logistics/boxes/cardboard_box.glb`, group: 'logistics', preload: false },
  // 126MB -- flagged in the production report, not verified via live load.
  { id: 'shippingContainers', type: 'gltf', path: `${BASE}models/logistics/containers/shipping_containers.glb`, group: 'logistics', preload: false },
  { id: 'conveyorBelt', type: 'gltf', path: `${BASE}models/logistics/conveyor/conveyor_belt.glb`, group: 'logistics', preload: false },
  { id: 'forklift', type: 'gltf', path: `${BASE}models/logistics/forklift/fork_lift_with_rig.glb`, group: 'logistics', preload: false },
  { id: 'palletJack', type: 'gltf', path: `${BASE}models/logistics/pallet_jack/pallet_jack.glb`, group: 'logistics', preload: false },
  { id: 'woodPallets', type: 'gltf', path: `${BASE}models/logistics/pallets/wood_pallets.glb`, group: 'logistics', preload: false },

  // Vehicles (7)
  // Folder says delivery_van, filename says semi_truck_gameready -- worth
  // confirming which this actually is before referencing it from a chapter.
  { id: 'deliveryVan', type: 'gltf', path: `${BASE}models/vehicles/delivery_van/semi_truck_gameready.glb`, group: 'vehicles', preload: false },
  { id: 'pickupVanNissan', type: 'gltf', path: `${BASE}models/vehicles/pickup/nissan_caravan_detailed_3d_van_model_..glb`, group: 'vehicles', preload: false },
  { id: 'pickupVanZaz', type: 'gltf', path: `${BASE}models/vehicles/pickup/zaz_tavria_pick-up.glb`, group: 'vehicles', preload: false },
  // Folder says semi_truck, filename says delivery_truck -- same mismatch
  // pattern as deliveryVan above, worth confirming before use.
  { id: 'semiTruck', type: 'gltf', path: `${BASE}models/vehicles/semi_truck/delivery_truck.glb`, group: 'vehicles', preload: false },
  { id: 'cateringTruck', type: 'gltf', path: `${BASE}models/vehicles/service_truck/airport_catering_truck.glb`, group: 'vehicles', preload: false },
  { id: 'serviceFuelTruck', type: 'gltf', path: `${BASE}models/vehicles/service_truck/airport_fuel_truck.glb`, group: 'vehicles', preload: false },
  { id: 'truckTrailer', type: 'gltf', path: `${BASE}models/vehicles/trailer/truck_trailer.glb`, group: 'vehicles', preload: false },
];
