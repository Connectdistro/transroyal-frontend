# Scene production media

Drop generated production assets here, following the naming convention below. Vite
serves everything under `public/` from the site root, so a file placed here needs
no build step — it's immediately reachable at `/media/scenes/<filename>`.

## Naming convention

Generic across all seven scenes, derived from each scene's `index` field in
`src/scroll-world/config.js` (never a scene-id branch in code):

```
Scene_{index, zero-padded to 2 digits}_Production_Master.{ext}
```

| Scene | index | Expected filename |
|---|---|---|
| Origin | 1 | `Scene_01_Production_Master.png` |
| Pickup | 2 | `Scene_02_Production_Master.png` |
| Sorting | 3 | `Scene_03_Production_Master.png` |
| Ground | 4 | `Scene_04_Production_Master.png` |
| Global | 5 | `Scene_05_Production_Master.png` |
| Final Mile | 6 | `Scene_06_Production_Master.png` |
| Delivered | 7 | `Scene_07_Production_Master.png` |

Optional companion assets, same base name:
- `..._Mobile.png` — only if a scene's focal subject can't survive a center-weighted crop on a portrait viewport (see `mobileStill` in the media contract).
- `..._Production_Master.mp4` / `..._Mobile.mp4` — future video/mobile-video assets.

## Going live

Placing a file here does **not** make it appear on the site by itself. The last
step is always a one-line, config-only edit in `src/scroll-world/config.js`: set
that scene's `media.still` (and `mobileStill`/`video`/`mobileVideo`, if present) to
its `/media/scenes/...` path. Nothing in `main.js` needs to change — the renderer
already handles the populated and null cases generically, for any scene.
