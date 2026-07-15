import { CubeTextureLoader, TextureLoader, VideoTexture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

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
};
