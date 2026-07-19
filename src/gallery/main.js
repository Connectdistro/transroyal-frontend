import './gallery.css';
import { AssetGallery } from './AssetGallery.js';
import { mountGalleryUI } from './ui.js';

const root = document.querySelector('#gallery-app');

const canvas = document.createElement('canvas');
canvas.className = 'gallery-canvas';
root.appendChild(canvas);

const gallery = new AssetGallery(canvas);
mountGalleryUI(root, gallery);

if (import.meta.env.DEV) window.__gallery = gallery;

gallery.goTo(0);
