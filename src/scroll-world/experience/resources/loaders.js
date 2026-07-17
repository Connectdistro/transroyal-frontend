import { CubeTextureLoader, PMREMGenerator, TextureLoader, VideoTexture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { createBackgroundGradient } from '../environment/background.js';

/**
 * One dedicated loader per asset type (Production Handbook Section 26/27).
 * Every loader exposes the same `load(path) -> Promise<asset>` shape so
 * Resources can dispatch on an entry's `type` without branching on its id.
 */

const textureLoader = new TextureLoader();
const cubeTextureLoader = new CubeTextureLoader();
const hdrLoader = new RGBELoader();
const gltfLoader = new GLTFLoader();

function loadTexture(path) {
  return textureLoader.loadAsync(path);
}

function loadCubeTexture(paths) {
  return cubeTextureLoader.loadAsync(paths);
}

function loadHdr(path) {
  return hdrLoader.loadAsync(path);
}

/**
 * Cinematic Polish Phase, Commit 1: a fallback environment map baked from
 * the existing procedural background gradient (`environment/background.js`)
 * via three.js's PMREMGenerator -- no external HDR asset, no new art. This
 * is deliberately a stand-in, not a permanent solution: swapping to a real
 * photographic HDR later is a manifest-only change (flip the entry's `type`
 * to `hdr` and give it a real `path`) -- this function, and every consumer
 * of the resulting texture, needs no change either way.
 *
 * `path` is unused (the manifest entry for this type carries `path: null`)
 * -- every other loader in this file takes `(path)` only; this is the one
 * type that also reads the second `context` argument Resources.load() now
 * passes to every loader (ignored by all the others), since PMREMGenerator
 * requires a live WebGLRenderer instance that isn't available at module
 * scope the way the other loaders' single-instance loaders are.
 */
function loadGeneratedEnvMap(path, context) {
  const renderer = context?.renderer?.instance;
  if (!renderer) return Promise.reject(new Error('generatedEnvMap loader requires a renderer'));

  const pmremGenerator = new PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const equirect = createBackgroundGradient();
  const renderTarget = pmremGenerator.fromEquirectangular(equirect);

  pmremGenerator.dispose();
  equirect.dispose();

  return Promise.resolve(renderTarget.texture);
}

function loadGltf(path) {
  return gltfLoader.loadAsync(path);
}

/**
 * Registration only, per the handbook's brief for this milestone — the video
 * element is created and its metadata awaited so a VideoTexture is ready to
 * hand out, but playback is never started here. Whatever consumes the asset
 * later (a future Motion Camera / Video Generation integration) owns calling
 * `.play()`.
 */
function loadVideo(path) {
  return new Promise((resolve, reject) => {
    const element = document.createElement('video');
    element.muted = true;
    element.loop = true;
    element.playsInline = true;
    element.preload = 'metadata';
    element.addEventListener('loadedmetadata', () => resolve(new VideoTexture(element)), { once: true });
    element.addEventListener('error', () => reject(new Error(`Failed to load video: ${path}`)), { once: true });
    element.src = path;
  });
}

export const LOADERS = {
  texture: loadTexture,
  cubeTexture: loadCubeTexture,
  hdr: loadHdr,
  gltf: loadGltf,
  video: loadVideo,
  generatedEnvMap: loadGeneratedEnvMap,
};
