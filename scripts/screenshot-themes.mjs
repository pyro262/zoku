/**
 * Renders Zoku overlay in headless Chromium and screenshots each theme.
 * No display server needed.
 * Run: node scripts/screenshot-themes.mjs
 * Output: /tmp/zoku-shots/
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(fileURLToPath(import.meta.url), '../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/zoku-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const W = 1920, H = 1080;

// Mirror of THEMES from main.js — widget positions at 1920x1080
const cx = Math.round(W / 2 - 150);
const THEMES = {
  default: {
    'w-race':       { x: 20, y: 20, visible: true  },
    'w-stats':      { x: 20, y: 20, visible: true  },
    'w-rpm':        { x: 20, y: 20, visible: true  },
    'w-inputs':     { x: 20, y: 20, visible: true  },
    'w-tires':      { x: 20, y: 20, visible: true  },
    'w-suspension': { x: 20, y: 20, visible: true  },
    'w-gmeter':     { x: 20, y: 20, visible: false },
    'w-laptimes':   { x: 20, y: 20, visible: false },
    'w-boost':      { x: 20, y: 20, visible: false },
    'w-steering':   { x: 20, y: 20, visible: false },
    'w-clutch':     { x: 20, y: 20, visible: false },
    'w-tireslip':   { x: 20, y: 20, visible: false },
    'w-wheelspeed': { x: 20, y: 20, visible: false },
    'w-fuel':       { x: 20, y: 20, visible: false },
  },
  exterior: {
    'w-race':       { x: cx,                       y: 20,                        visible: true  },
    'w-stats':      { x: cx,                       y: Math.round(H * 0.65),      visible: true  },
    'w-rpm':        { x: cx,                       y: Math.round(H * 0.65) + 110,visible: true  },
    'w-inputs':     { x: cx,                       y: Math.round(H * 0.65) + 150,visible: true  },
    'w-tires':      { x: cx,                       y: Math.round(H * 0.65) + 185,visible: true  },
    'w-suspension': { x: 20,                       y: Math.round(H / 2 - 100),   visible: false },
    'w-gmeter':     { x: 20,                       y: Math.round(H * 0.65),      visible: false },
    'w-laptimes':   { x: Math.round(W - 310),      y: 20,                        visible: false },
    'w-boost':      { x: Math.round(W - 310),      y: 120,                       visible: false },
    'w-steering':   { x: cx,                       y: Math.round(H * 0.65) + 330,visible: false },
    'w-clutch':     { x: 20,                       y: Math.round(H * 0.65) + 50, visible: false },
    'w-tireslip':   { x: Math.round(W - 310),      y: Math.round(H * 0.65) + 150,visible: false },
    'w-wheelspeed': { x: Math.round(W - 310),      y: Math.round(H * 0.65) + 250,visible: false },
    'w-fuel':       { x: Math.round(W / 2 + 160),  y: H - 60,                   visible: false },
  },
  interior: {
    'w-race':       { x: cx,                        y: H - 161, visible: true  },
    'w-stats':      { x: cx,                        y: H - 139, visible: true  },
    'w-rpm':        { x: cx,                        y: H - 64,  visible: true  },
    'w-inputs':     { x: Math.round(W / 2 + 160),   y: H - 139, visible: true  },
    'w-tires':      { x: 0,                          y: 0,       visible: false },
    'w-suspension': { x: 0,                          y: 0,       visible: false },
    'w-gmeter':     { x: 20,                         y: H - 108, visible: false },
    'w-laptimes':   { x: cx,                         y: H - 230, visible: false },
    'w-boost':      { x: Math.round(W - 290),        y: H - 130, visible: false },
    'w-steering':   { x: Math.round(W / 2 + 160),   y: H - 161, visible: false },
    'w-clutch':     { x: Math.round(W / 2 + 160),   y: H - 90,  visible: false },
    'w-tireslip':   { x: 20,                         y: H - 210, visible: false },
    'w-wheelspeed': { x: 20,                         y: H - 380, visible: false },
    'w-fuel':       { x: Math.round(W - 290),        y: H - 60,  visible: false },
  },
};

const FAKE_TELEMETRY = {
  isRaceOn: 1,
  timestampMS: 1000,
  engineMaxRpm: 8500,
  engineIdleRpm: 800,
  currentEngineRpm: 6200,
  accelX: 8.5, accelY: 0.1, accelZ: -3.2,
  velocityX: 0, velocityY: 0, velocityZ: 0,
  angVelX: 0, angVelY: 0, angVelZ: 0,
  yaw: 0, pitch: 0, roll: 0,
  suspNormFL: 0.62, suspNormFR: 0.58, suspNormRL: 0.71, suspNormRR: 0.67,
  tireSlipRatioFL: 0.02, tireSlipRatioFR: 0.02, tireSlipRatioRL: 0.18, tireSlipRatioRR: 0.21,
  wheelSpeedFL: 45.2, wheelSpeedFR: 45.0, wheelSpeedRL: 47.1, wheelSpeedRR: 47.3,
  suspTravelMetersFL: 0.04, suspTravelMetersFR: 0.04, suspTravelMetersRL: 0.05, suspTravelMetersRR: 0.05,
  carOrdinal: 1234, carClass: 4, carPI: 900,
  drivetrainType: 1, numCylinders: 8, carGroup: 0,
  smashableVelDiff: 0, smashableMass: 0,
  posX: 100, posY: 0, posZ: 200,
  speed: 62.5,      // ~140 mph
  power: 500000,    // ~670 hp
  torque: 650,      // ~480 lb-ft
  tireTempFL: 185, tireTempFR: 188, tireTempRL: 192, tireTempRR: 195,
  boost: 1.4, fuel: 0.72, distanceTraveled: 1500,
  bestLap: 92.4, lastLap: 94.1, currentLap: 18.3,
  currentRaceTime: 127.5, lapNumber: 2, racePosition: 3,
  accel: 230, brake: 0, clutch: 0, handBrake: 0,
  gear: 5, steer: -15,
};

// Inject window.fh6 mock BEFORE renderer.js loads
const MOCK_FH6 = `
window.fh6 = (() => {
  const cbs = {};
  const on = (name) => (cb) => { cbs[name] = cb; };
  window.__fh6fire = (name, data) => { if (cbs[name]) cbs[name](data); };
  return {
    onTelemetry:        on('telemetry'),
    onRaceStart:        on('raceStart'),
    onRaceEnd:          on('raceEnd'),
    onSessionSaved:     on('sessionSaved'),
    onLockState:        on('lockState'),
    onTheme:            on('theme'),
    onWidgetVisibility: on('widgetVisibility'),
    onOpacity:          on('opacity'),
    onScale:            on('scale'),
    onDisplaySize:      on('displaySize'),
    onConfine:          on('confine'),
    saveWidgetPos:      () => {},
  };
})();
`;

const browser = await chromium.launch({ headless: true });

for (const [themeName, widgets] of Object.entries(THEMES)) {
  console.log(`Rendering theme: ${themeName}`);

  const page = await browser.newPage();
  await page.setViewportSize({ width: W, height: H });

  // Inject mock before any scripts
  await page.addInitScript(MOCK_FH6);

  // Bypass CSP so file:// can load local resources
  await page.route('**/*', route => route.continue());

  await page.goto(`file://${ROOT}/src/overlay/index.html`);
  await page.waitForLoadState('domcontentloaded');

  // Dark background (overlay is transparent, but we want screenshots to look good)
  await page.evaluate(() => {
    document.body.style.background = '#0a0812';
    document.documentElement.style.setProperty('--widget-opacity', '1');
    document.documentElement.style.setProperty('--widget-scale', '1');
  });

  // Fire displaySize so layout math works
  await page.evaluate((d) => window.__fh6fire('displaySize', d), { W, H });

  // Fire theme to position widgets
  await page.evaluate(
    ([name, w]) => window.__fh6fire('theme', { name, widgets: w }),
    [themeName, widgets],
  );

  // Fire telemetry to remove no-data class and populate values
  await page.evaluate((d) => {
    window.__fh6fire('telemetry', d);
    // Keep no-data off permanently for the screenshot
    document.body.classList.remove('no-data');
  }, FAKE_TELEMETRY);

  // Wait for animations / rAF to settle
  await page.waitForTimeout(500);

  const file = path.join(SHOT_DIR, `theme-${themeName}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  saved:', file);

  await page.close();
}

await browser.close();
console.log('\nDone. Screenshots in', SHOT_DIR);
