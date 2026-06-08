const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X'];

const TEMP_COLD    = 140;
const TEMP_OPTIMAL = 200;
const TEMP_HOT     = 240;

const $ = (id) => document.getElementById(id);

function tempColor(f) {
  if (f < TEMP_COLD) return '#3498db';
  if (f < TEMP_OPTIMAL) {
    const t = (f - TEMP_COLD) / (TEMP_OPTIMAL - TEMP_COLD);
    return lerpColor('#3498db', '#2ecc71', t);
  }
  if (f < TEMP_HOT) {
    const t = (f - TEMP_OPTIMAL) / (TEMP_HOT - TEMP_OPTIMAL);
    return lerpColor('#2ecc71', '#f39c12', t);
  }
  return '#e74c3c';
}

function lerpColor(a, b, t) {
  const hex = (s) => parseInt(s.slice(1), 16);
  const r = (c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  const ca = r(hex(a)), cb = r(hex(b));
  const ri = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const gi = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bi = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${ri},${gi},${bi})`;
}

function formatTime(sec) {
  if (!sec || sec <= 0) return '0:00.000';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

function gearLabel(g) {
  if (g === 0) return 'R';
  if (g === 11) return 'N';
  return String(g);
}

let maxRpm = 8000;
let idleRpm = 800;
let inRace = false;
let hasData = false;
let noDataTimer = null;
let displayW = window.innerWidth;
let displayH = window.innerHeight;
let confineWidgets = true;

// Consolidated panel anchor — top-left of the whole panel, preserved across drags
let stackAnchor = { x: 20, y: 20 };

const WIDGET_ORDER = [
  'w-race', 'w-stats', 'w-rpm', 'w-inputs', 'w-tires', 'w-suspension',
  'w-gmeter', 'w-laptimes', 'w-boost', 'w-steering', 'w-clutch',
  'w-tireslip', 'w-wheelspeed', 'w-fuel',
];

function stackConsolidated() {
  const scale = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')
  ) || 1;
  const visible = WIDGET_ORDER
    .map((id) => document.getElementById(id))
    .filter((el) => el && !el.classList.contains('hidden'));
  if (!visible.length) return;
  let y = stackAnchor.y;
  for (let i = 0; i < visible.length; i++) {
    const el = visible[i];
    el.classList.toggle('section-divider', i > 0);
    el.style.left = stackAnchor.x + 'px';
    el.style.top  = y + 'px';
    y += el.offsetHeight * scale;
  }
}

function updateTireCell(id, tempF) {
  const cell = $(id);
  const el = cell.querySelector('.tire-temp');
  el.textContent = tempF > 0 ? Math.round(tempF) + '°' : '--';
  cell.style.borderColor = tempF > 0 ? tempColor(tempF) : 'rgba(155,89,182,0.25)';
  el.style.color = tempF > 0 ? tempColor(tempF) : '#fff';
}

const suspHist = { 'su-fl': [], 'su-fr': [], 'su-rl': [], 'su-rr': [] };
const SUSP_WINDOW_MS = 30000;

function updateSuspCell(fillId, valId, maxId, norm) {
  const pct  = Math.min(100, Math.max(0, norm * 100));
  const fill = $(fillId);
  fill.style.height = pct + '%';
  $(valId).textContent = Math.round(pct) + '%';

  // Rolling 30 s max
  const now  = Date.now();
  const hist = suspHist[fillId];
  hist.push({ t: now, v: pct });
  while (hist.length > 0 && hist[0].t < now - SUSP_WINDOW_MS) hist.shift();
  const maxPct = Math.max(...hist.map(e => e.v));
  $(maxId).textContent = Math.round(maxPct) + '%';

  // Blend purple→cyan gradient toward solid red as 98→100%
  if (pct >= 98) {
    const t  = (pct - 98) / 2;
    const r1 = Math.round(0x9b + (0xe7 - 0x9b) * t);
    const g1 = Math.round(0x59 + (0x4c - 0x59) * t);
    const b1 = Math.round(0xb6 + (0x3c - 0xb6) * t);
    const r2 = Math.round(0x00 + (0xe7 - 0x00) * t);
    const g2 = Math.round(0xd4 + (0x4c - 0xd4) * t);
    const b2 = Math.round(0xff + (0x3c - 0xff) * t);
    fill.style.background = `linear-gradient(0deg,rgb(${r1},${g1},${b1}),rgb(${r2},${g2},${b2}))`;
  } else {
    fill.style.background = '';
  }
}

function gForceColor(absG) {
  if (absG < 0.5) return '#2ecc71';
  if (absG < 1.2) return '#f39c12';
  return '#e74c3c';
}

function setGBar(fillId, value, maxG) {
  const fill = $(fillId);
  const pct  = Math.min(50, Math.abs(value) / maxG * 50);
  if (value >= 0) { fill.style.left = '50%'; fill.style.right = ''; }
  else            { fill.style.right = '50%'; fill.style.left = ''; }
  fill.style.width      = pct + '%';
  fill.style.background = gForceColor(Math.abs(value) / 9.81);
}

function updateSlipCell(cellId, valId, slip) {
  const cell   = $(cellId);
  const el     = $(valId);
  const absSlip = Math.abs(slip);
  el.textContent = Math.abs(slip) > 0.001 ? slip.toFixed(3) : '0.000';
  const color = absSlip < 0.05 ? '#2ecc71' : absSlip < 0.2 ? '#f39c12' : '#e74c3c';
  cell.style.borderColor = color;
  el.style.color = color;
}

function updateWheelCell(cellId, valId, omega, expectedOmega) {
  const cell = $(cellId);
  const el   = $(valId);
  el.textContent = Math.round(omega);
  if (expectedOmega < 1) {
    cell.style.borderColor = 'rgba(155,89,182,0.25)';
    el.style.color = '#fff';
    return;
  }
  const ratio = omega / expectedOmega;
  const color = ratio > 1.06 ? '#e74c3c' : ratio < 0.94 ? '#3498db' : '#2ecc71';
  cell.style.borderColor = color;
  el.style.color = color;
}

// ── Panel-bg for consolidated mode ──────────

function updatePanelBg() {
  const bg = $('panel-bg');
  if (!bg) return;
  if (document.body.dataset.theme !== 'default' || document.body.classList.contains('no-data')) {
    bg.style.display = 'none';
    return;
  }

  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')) || 1;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  document.querySelectorAll('.widget:not(.hidden)').forEach((w) => {
    const x = parseInt(w.style.left) || 0;
    const y = parseInt(w.style.top)  || 0;
    const r = x + (w.offsetWidth  || 260) * scale;
    const b = y + (w.offsetHeight || 40) * scale;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (r > maxX) maxX = r; if (b > maxY) maxY = b;
  });

  if (!isFinite(minX)) { bg.style.display = 'none'; return; }
  const pad = 6;
  bg.style.left    = (minX - pad) + 'px';
  bg.style.top     = (minY - pad) + 'px';
  bg.style.width   = (maxX - minX + pad * 2) + 'px';
  bg.style.height  = (maxY - minY + pad * 2) + 'px';
  bg.style.display = 'block';
}

// ── Layout / theme ──────────────────────────

function applyLayout(data) {
  document.body.dataset.theme = data.name;
  for (const [id, state] of Object.entries(data.widgets)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.left = state.x + 'px';
    el.style.top  = state.y + 'px';
    el.classList.toggle('hidden', !state.visible);
  }
  if (data.name === 'default') {
    // Set anchor from the first widget in order that has a configured position
    const firstId = WIDGET_ORDER.find((id) => data.widgets[id]);
    if (firstId && data.widgets[firstId]) {
      stackAnchor = { x: data.widgets[firstId].x, y: data.widgets[firstId].y };
    }
    requestAnimationFrame(() => { stackConsolidated(); requestAnimationFrame(updatePanelBg); });
  } else {
    // Clear consolidated-only classes when leaving this theme
    WIDGET_ORDER.forEach((id) => document.getElementById(id)?.classList.remove('section-divider'));
    requestAnimationFrame(updatePanelBg);
  }
}

function applyWidgetVisibility(id, visible) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', !visible);
  if (document.body.dataset.theme === 'default') {
    requestAnimationFrame(() => { stackConsolidated(); requestAnimationFrame(updatePanelBg); });
  } else {
    requestAnimationFrame(updatePanelBg);
  }
}

// ── Drag ────────────────────────────────────

let dragState = null;

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (dragState.consolidated) {
    for (const w of dragState.widgets) {
      w.el.style.left = (w.origX + dx) + 'px';
      w.el.style.top  = (w.origY + dy) + 'px';
    }
    // Move panel-bg directly for smooth dragging
    const bg = $('panel-bg');
    if (bg && bg.style.display !== 'none') {
      bg.style.left = (dragState.bgOrigX + dx) + 'px';
      bg.style.top  = (dragState.bgOrigY + dy) + 'px';
    }
  } else {
    dragState.widget.style.left = (dragState.origX + dx) + 'px';
    dragState.widget.style.top  = (dragState.origY + dy) + 'px';
  }
});

document.addEventListener('mouseup', () => {
  if (!dragState) return;
  if (dragState.consolidated) {
    for (const w of dragState.widgets) {
      const x = parseInt(w.el.style.left) || 0;
      const y = parseInt(w.el.style.top)  || 0;
      window.fh6.saveWidgetPos(w.el.id, x, y);
    }
    // Update anchor from topmost visible widget after drag
    const topWidget = dragState.widgets.reduce((a, b) =>
      (parseInt(a.el.style.top) || 0) < (parseInt(b.el.style.top) || 0) ? a : b
    );
    stackAnchor = {
      x: parseInt(topWidget.el.style.left) || stackAnchor.x,
      y: parseInt(topWidget.el.style.top)  || stackAnchor.y,
    };
    requestAnimationFrame(updatePanelBg);
  } else {
    const x = parseInt(dragState.widget.style.left) || 0;
    const y = parseInt(dragState.widget.style.top)  || 0;
    window.fh6.saveWidgetPos(dragState.widget.id, x, y);
    requestAnimationFrame(updatePanelBg);
  }
  dragState = null;
});

document.querySelectorAll('.widget-drag').forEach((handle) => {
  handle.addEventListener('mousedown', (e) => {
    if (!document.body.classList.contains('unlocked')) return;
    const isConsolidated = document.body.dataset.theme === 'default';

    if (isConsolidated) {
      const bg = $('panel-bg');
      dragState = {
        consolidated: true,
        widgets: Array.from(document.querySelectorAll('.widget:not(.hidden)')).map((w) => ({
          el: w,
          origX: parseInt(w.style.left) || 0,
          origY: parseInt(w.style.top)  || 0,
        })),
        bgOrigX: parseInt(bg?.style.left) || 0,
        bgOrigY: parseInt(bg?.style.top)  || 0,
        startX: e.clientX,
        startY: e.clientY,
      };
    } else {
      const widget = handle.closest('.widget');
      dragState = {
        consolidated: false,
        widget,
        startX: e.clientX,
        startY: e.clientY,
        origX: parseInt(widget.style.left) || 0,
        origY: parseInt(widget.style.top)  || 0,
      };
    }
    e.preventDefault();
  });
});

// ── IPC handlers ────────────────────────────

window.fh6.onTheme((data)           => applyLayout(data));
window.fh6.onWidgetVisibility((d)   => applyWidgetVisibility(d.id, d.visible));
window.fh6.onLockState((locked)     => document.body.classList.toggle('unlocked', !locked));
window.fh6.onOpacity((v) => document.documentElement.style.setProperty('--widget-opacity', v));
window.fh6.onScale((v)   => document.documentElement.style.setProperty('--widget-scale',   v));
window.fh6.onDisplaySize((d) => { displayW = d.W; displayH = d.H; });
window.fh6.onConfine((v)     => { confineWidgets = v; });

window.fh6.onSessionSaved(() => {
  const toast = $('toast');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
});

// ── Telemetry ────────────────────────────────

window.fh6.onTelemetry((d) => {
  // Show overlay on first data; auto-hide 30 s after last packet
  if (!hasData) {
    hasData = true;
    document.body.classList.remove('no-data');
    if (document.body.dataset.theme === 'default') {
      requestAnimationFrame(() => { stackConsolidated(); requestAnimationFrame(updatePanelBg); });
    } else {
      requestAnimationFrame(updatePanelBg);
    }
  }
  if (noDataTimer) clearTimeout(noDataTimer);
  noDataTimer = setTimeout(() => {
    hasData = false;
    noDataTimer = null;
    document.body.classList.add('no-data');
    updatePanelBg();
  }, 3000);

  if (d.engineMaxRpm > 100) maxRpm = d.engineMaxRpm;
  if (d.engineIdleRpm > 0)  idleRpm = d.engineIdleRpm;

  const speedMph = d.speed * 2.23694;
  const rpmRange = maxRpm - idleRpm;
  const rpmPct   = rpmRange > 0 ? ((d.currentEngineRpm - idleRpm) / rpmRange) * 100 : 0;
  const thrPct   = (d.accel / 255) * 100;
  const brkPct   = (d.brake / 255) * 100;

  $('gear').textContent            = gearLabel(d.gear);
  $('speed').textContent           = Math.round(speedMph);
  $('rpm-val').textContent         = Math.round(d.currentEngineRpm).toLocaleString();
  $('rpm-max-label').textContent   = Math.round(maxRpm / 1000).toFixed(1) + 'k';

  $('rpm-fill').style.width        = Math.min(100, Math.max(0, rpmPct)) + '%';

  $('thr-fill').style.setProperty('--fill-pct', thrPct + '%');
  $('brk-fill').style.setProperty('--fill-pct', brkPct + '%');
  $('thr-val').textContent         = Math.round(thrPct) + '%';
  $('brk-val').textContent         = Math.round(brkPct) + '%';

  $('race-time').textContent       = formatTime(d.currentRaceTime);
  if (d.racePosition > 0) $('race-pos').textContent = `P${d.racePosition}`;

  if (!inRace && d.carPI > 0) {
    const cls = CAR_CLASSES[d.carClass] ?? '?';
    $('race-label').textContent = `FREE ROAM · ${cls}${d.carPI}`;
    $('race-label').style.color = 'rgba(255,255,255,0.45)';
    $('race-pos').textContent   = '--';
    $('race-time').textContent  = '--:--.---';
  }

  updateTireCell('tt-fl', d.tireTempFL);
  updateTireCell('tt-fr', d.tireTempFR);
  updateTireCell('tt-rl', d.tireTempRL);
  updateTireCell('tt-rr', d.tireTempRR);

  updateSuspCell('su-fl', 'su-fl-val', 'su-fl-max', d.suspNormFL);
  updateSuspCell('su-fr', 'su-fr-val', 'su-fr-max', d.suspNormFR);
  updateSuspCell('su-rl', 'su-rl-val', 'su-rl-max', d.suspNormRL);
  updateSuspCell('su-rr', 'su-rr-val', 'su-rr-max', d.suspNormRR);

  // G-Force (±20 m/s² scale)
  const MAX_G_MS2 = 20;
  setGBar('g-lat',  d.accelX, MAX_G_MS2);
  setGBar('g-long', d.accelZ, MAX_G_MS2);
  $('g-lat-val').textContent  = (d.accelX / 9.81).toFixed(2) + 'g';
  $('g-long-val').textContent = (d.accelZ / 9.81).toFixed(2) + 'g';

  // Lap times
  $('lt-best').textContent = d.bestLap    > 0 ? formatTime(d.bestLap)    : '--:--.---';
  $('lt-last').textContent = d.lastLap    > 0 ? formatTime(d.lastLap)    : '--:--.---';
  $('lt-cur').textContent  = d.currentLap > 0 ? formatTime(d.currentLap) : '--:--.---';

  // Engine output
  $('eo-boost').textContent  = d.boost.toFixed(1);
  $('eo-power').textContent  = Math.round(d.power / 745.7);
  $('eo-torque').textContent = Math.round(d.torque * 0.7376);

  // Steering (steer is Int8 -127..127)
  const steerFill = $('steer-fill');
  const steerPct  = Math.min(50, Math.abs(d.steer) / 127 * 50);
  if (d.steer >= 0) { steerFill.style.left = '50%'; steerFill.style.right = ''; }
  else              { steerFill.style.right = '50%'; steerFill.style.left = ''; }
  steerFill.style.width = steerPct + '%';
  $('steer-val').textContent = (d.steer >= 0 ? 'R ' : 'L ') + Math.round(Math.abs(d.steer) / 127 * 100) + '%';

  // Clutch / handbrake
  const cltPct = (d.clutch    / 255) * 100;
  const hbkPct = (d.handBrake / 255) * 100;
  $('clt-fill').style.setProperty('--fill-pct', cltPct + '%');
  $('hbk-fill').style.setProperty('--fill-pct', hbkPct + '%');
  $('clt-val').textContent = Math.round(cltPct) + '%';
  $('hbk-val').textContent = Math.round(hbkPct) + '%';

  // Tire slip ratio
  updateSlipCell('ts-fl', 'ts-fl-val', d.tireSlipRatioFL);
  updateSlipCell('ts-fr', 'ts-fr-val', d.tireSlipRatioFR);
  updateSlipCell('ts-rl', 'ts-rl-val', d.tireSlipRatioRL);
  updateSlipCell('ts-rr', 'ts-rr-val', d.tireSlipRatioRR);

  // Wheel speeds — compare to expected ω (v / r, r≈0.33 m)
  const expectedOmega = d.speed > 0.5 ? d.speed / 0.33 : 0;
  updateWheelCell('ws-fl', 'ws-fl-val', d.wheelSpeedFL, expectedOmega);
  updateWheelCell('ws-fr', 'ws-fr-val', d.wheelSpeedFR, expectedOmega);
  updateWheelCell('ws-rl', 'ws-rl-val', d.wheelSpeedRL, expectedOmega);
  updateWheelCell('ws-rr', 'ws-rr-val', d.wheelSpeedRR, expectedOmega);

  // Fuel (0–1 normalised → %)
  const fuelPct = Math.round(d.fuel * 100);
  $('fuel-val').textContent  = fuelPct;
  $('fuel-fill').style.width = fuelPct + '%';
  $('fuel-fill').style.background =
    fuelPct > 25 ? '#2ecc71' : fuelPct > 10 ? '#f39c12' : '#e74c3c';
});

window.fh6.onRaceStart((d) => {
  inRace = true;
  const cls = CAR_CLASSES[d.carClass] ?? '?';
  $('race-label').textContent = `${cls}${d.carPI} · REC`;
  $('race-label').style.color = '#e74c3c';
  $('race-pos').textContent   = 'P1';
  $('race-bar').classList.add('in-race');
});

window.fh6.onRaceEnd(() => {
  inRace = false;
  $('race-label').textContent = 'FREE ROAM';
  $('race-label').style.color = 'rgba(255,255,255,0.45)';
  $('race-pos').textContent   = '--';
  $('race-time').textContent  = '--:--.---';
  $('race-bar').classList.remove('in-race');
});
