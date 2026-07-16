// Dev-only validation helper (not part of the production build). Scrolls to
// a scene section, snaps the camera instantly to that scene's shot (bypassing
// the eased scroll-to-camera transition, which needs far more real animation
// frames than headless Chromium's throttled requestAnimationFrame delivers
// in a short wait), and screenshots the result.
const { chromium } = require('playwright');

(async () => {
  const sceneId = process.argv[2];
  const outPath = process.argv[3];
  if (!sceneId || !outPath) {
    console.error('Usage: node scripts/snap-scene.cjs <sceneId> <outPath>');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://localhost:5183/');
  await page.waitForTimeout(400);

  if (sceneId !== 'origin') {
    await page.locator(`#scene-${sceneId}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.evaluate(
      (id) => window.__experience?.camera.setShot(id, { instant: true }),
      sceneId
    );
  }

  await page.waitForTimeout(250);
  await page.screenshot({ path: outPath });
  await browser.close();
})();
