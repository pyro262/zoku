const SESSION_COLORS = ['#00d4ff', '#f39c12', '#2ecc71', '#9b59b6'];
const MAX_SESSIONS = 4;

let sessions = [];
let colorByChannel = 'spd';
let currentTime = 0;
let channelRanges = { spd: { min: 0, max: 200 }, thr: { min: 0, max: 255 }, brk: { min: 0, max: 255 } };
let mapTransform = { offsetX: 0, offsetZ: 0, scale: 1 };
let offscreenCanvas = null;
let framePending = false;

// ── Helpers ──────────────────────────────────

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

function lerpColor(a, b, t) {
  const p = (s) => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
  const [ar,ag,ab] = p(a), [br,bg,bb] = p(b);
  const r = Math.round(ar + (br-ar)*t), g = Math.round(ag + (bg-ag)*t), bv = Math.round(ab + (bb-ab)*t);
  return '#' + [r,g,bv].map(v => v.toString(16).padStart(2,'0')).join('');
}

function valueToColor(val, min, max) {
  const t = max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0;
  if (t < 0.25) return lerpColor('#1e3a5f', '#3498db', t / 0.25);
  if (t < 0.5)  return lerpColor('#3498db', '#2ecc71', (t - 0.25) / 0.25);
  if (t < 0.75) return lerpColor('#2ecc71', '#f39c12', (t - 0.5)  / 0.25);
  return lerpColor('#f39c12', '#e74c3c', (t - 0.75) / 0.25);
}

// Binary search — frames are sorted by t
function nearestFrameIdx(frames, t) {
  if (!frames.length) return -1;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo-1].t - t) < Math.abs(frames[lo].t - t)) lo--;
  return lo;
}

function getMaxDuration() {
  let max = 0;
  for (const s of sessions) { const last = s.frames.at(-1)?.t ?? 0; if (last > max) max = last; }
  return max;
}

// ── GPS → Canvas ─────────────────────────────

function computeMapTransform(w, h, pad = 36) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of sessions) {
    if (!s.visible) continue;
    for (const f of s.frames) {
      if (f.x < minX) minX = f.x; if (f.x > maxX) maxX = f.x;
      if (f.z < minZ) minZ = f.z; if (f.z > maxZ) maxZ = f.z;
    }
  }
  if (!isFinite(minX)) return;
  const rX = Math.max(maxX - minX, 1), rZ = Math.max(maxZ - minZ, 1);
  const scale = Math.min((w - pad*2) / rX, (h - pad*2) / rZ);
  mapTransform = {
    offsetX: (w - rX * scale) / 2 - minX * scale,
    offsetZ: (h - rZ * scale) / 2 - minZ * scale,
    scale,
  };
}

function gpsToCanvas(x, z) {
  return {
    cx: x * mapTransform.scale + mapTransform.offsetX,
    cy: z * mapTransform.scale + mapTransform.offsetZ,
  };
}

// ── Rendering ────────────────────────────────

function renderTrackOffscreen() {
  const canvas = document.getElementById('map-canvas');
  offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
  const ctx = offscreenCanvas.getContext('2d');
  const range = channelRanges[colorByChannel];

  for (const sess of sessions) {
    if (!sess.visible || sess.frames.length < 2) continue;
    const frames = sess.frames;
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i], prev = frames[i-1];
      const { cx: x1, cy: y1 } = gpsToCanvas(prev.x, prev.z);
      const { cx: x2, cy: y2 } = gpsToCanvas(f.x, f.z);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = valueToColor(f[colorByChannel], range.min, range.max);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

function drawMap() {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (offscreenCanvas) ctx.drawImage(offscreenCanvas, 0, 0);

  // Cursor dots on top
  for (const sess of sessions) {
    if (!sess.visible || sess.cursorIdx < 0) continue;
    const f = sess.frames[sess.cursorIdx];
    if (!f) continue;
    const { cx, cy } = gpsToCanvas(f.x, f.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = sess.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function fullRedraw() {
  const canvas = document.getElementById('map-canvas');
  computeMapTransform(canvas.width, canvas.height);
  renderTrackOffscreen();
  drawMap();
}

// ── Time / Scrubber ───────────────────────────

function setCurrentTime(t) {
  currentTime = Math.max(0, Math.min(t, getMaxDuration()));
  for (const sess of sessions) {
    sess.cursorIdx = nearestFrameIdx(sess.frames, currentTime);
  }
  const pct = getMaxDuration() > 0 ? (currentTime / getMaxDuration() * 100) : 0;
  const scrubber = document.getElementById('time-scrubber');
  scrubber.value = Math.round(currentTime * 1000);
  scrubber.style.setProperty('--pct', pct.toFixed(2) + '%');
  document.getElementById('tl-label').textContent = formatTime(currentTime);
  updateTelemetryTable();
  if (!framePending) {
    framePending = true;
    requestAnimationFrame(() => { drawMap(); framePending = false; });
  }
}

function updateScrubberMax() {
  const maxT = getMaxDuration();
  const scrubber = document.getElementById('time-scrubber');
  scrubber.max = Math.round(maxT * 1000);
  document.getElementById('tl-end').textContent = formatTime(maxT);
}

// ── Telemetry table ───────────────────────────

const TELEM_ROWS = [
  { key: 't',    label: 'Time',     fmt: (v) => formatTime(v) },
  { key: 'lap',  label: 'Lap',      fmt: (v) => v === 0 ? 'Sprint' : String(v) },
  { key: 'spd',  label: 'Speed',    fmt: (v) => v.toFixed(1) + ' mph' },
  { key: 'gear', label: 'Gear',     fmt: (v) => gearLabel(v) },
  { key: 'rpm',  label: 'RPM',      fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'thr',  label: 'Throttle', fmt: (v) => Math.round(v / 255 * 100) + '%' },
  { key: 'brk',  label: 'Brake',    fmt: (v) => Math.round(v / 255 * 100) + '%' },
  { key: 'ttFL', label: 'Tire FL',  fmt: (v) => Math.round(v) + '°F' },
  { key: 'ttFR', label: 'Tire FR',  fmt: (v) => Math.round(v) + '°F' },
  { key: 'ttRL', label: 'Tire RL',  fmt: (v) => Math.round(v) + '°F' },
  { key: 'ttRR', label: 'Tire RR',  fmt: (v) => Math.round(v) + '°F' },
];

function buildTelemetryTable() {
  const head = document.getElementById('telem-head');
  const body = document.getElementById('telem-body');

  if (!sessions.length) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td colspan="5" style="color:rgba(255,255,255,0.3);padding:8px 6px">Load sessions to compare</td></tr>';
    return;
  }

  head.innerHTML = '<th></th>' + sessions.map((s, i) =>
    `<th style="color:${s.color}">S${i+1}</th>`
  ).join('');

  body.innerHTML = TELEM_ROWS.map(({ key, label }) =>
    `<tr>
      <td class="tl">${label}</td>
      ${sessions.map((_, i) => `<td id="tv-${i}-${key}">--</td>`).join('')}
    </tr>`
  ).join('');
}

function updateTelemetryTable() {
  for (let i = 0; i < sessions.length; i++) {
    const f = sessions[i].frames[sessions[i].cursorIdx];
    if (!f) continue;
    for (const { key, fmt } of TELEM_ROWS) {
      const el = document.getElementById(`tv-${i}-${key}`);
      if (el) el.textContent = fmt(f[key] ?? 0);
    }
  }
}

// ── Session list ──────────────────────────────

function updateSessionList() {
  const list = document.getElementById('session-list');
  if (!sessions.length) {
    list.innerHTML = '<div class="empty-hint">No sessions loaded</div>';
    return;
  }
  list.innerHTML = sessions.map((s, i) => `
    <div class="session-card" style="border-color:${s.color}">
      <div class="sc-header">
        <span class="sc-dot" style="background:${s.color}"></span>
        <span class="sc-name" title="${s.name}">${s.name}</span>
        <button class="sc-btn-vis ${s.visible ? '' : 'dim'}" data-idx="${i}" title="Toggle">◉</button>
        <button class="sc-btn-rm" data-idx="${i}" title="Remove">✕</button>
      </div>
      <div class="sc-meta">${s.meta.carClass ?? '?'}${s.meta.carPI ?? ''} · ${s.meta.drivetrain ?? '?'} · ${formatTime(s.meta.durationSec ?? 0)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.sc-btn-vis').forEach((btn) =>
    btn.addEventListener('click', () => {
      const s = sessions[+btn.dataset.idx]; s.visible = !s.visible;
      updateSessionList();
      fullRedraw();
    })
  );

  list.querySelectorAll('.sc-btn-rm').forEach((btn) =>
    btn.addEventListener('click', () => {
      sessions.splice(+btn.dataset.idx, 1);
      sessions.forEach((s, i) => { s.color = SESSION_COLORS[i]; });
      onSessionsChanged();
    })
  );
}

// ── Channel ranges ────────────────────────────

function computeChannelRanges() {
  let spdMax = 1;
  for (const s of sessions) for (const f of s.frames) if (f.spd > spdMax) spdMax = f.spd;
  channelRanges = { spd: { min: 0, max: spdMax }, thr: { min: 0, max: 255 }, brk: { min: 0, max: 255 } };
}

// ── Load / clear ──────────────────────────────

function loadSession(name, data) {
  if (sessions.length >= MAX_SESSIONS) {
    alert(`Max ${MAX_SESSIONS} sessions. Remove one first.`); return;
  }
  if (!Array.isArray(data?.frames) || !data.frames.length) {
    alert(`${name}: not a valid Zoku session file.`); return;
  }
  if (sessions.find((s) => s.name === name)) return;

  // Trim trailing zero-padded frames from raceEnd debounce window
  const frames = data.frames.slice();
  while (frames.length > 0) {
    const last = frames[frames.length - 1];
    if (last.t === 0 && last.x === 0 && last.z === 0) frames.pop();
    else break;
  }
  if (!frames.length) { alert(`${name}: no valid frames.`); return; }
  data = { ...data, frames };

  sessions.push({
    name,
    meta: data.meta ?? {},
    frames: data.frames,
    color: SESSION_COLORS[sessions.length],
    visible: true,
    cursorIdx: 0,
  });
  onSessionsChanged();
  document.getElementById('map-hint').classList.add('hidden');
}

function onSessionsChanged() {
  setPlaying(false);
  computeChannelRanges();
  updateScrubberMax();
  updateSessionList();
  buildTelemetryTable();
  if (sessions.length === 0) {
    document.getElementById('map-hint').classList.remove('hidden');
    const canvas = document.getElementById('map-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    offscreenCanvas = null;
  } else {
    fullRedraw();
  }
}

// ── Canvas sizing ─────────────────────────────

function resizeCanvas() {
  const canvas = document.getElementById('map-canvas');
  const panel = document.getElementById('map-panel');
  const w = panel.clientWidth, h = panel.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    if (sessions.length) fullRedraw();
  }
}

// ── Map mouse interaction ─────────────────────

function initMapInteraction() {
  const canvas = document.getElementById('map-canvas');
  let isPanning = false;
  let panStart = null;
  let panOrigin = null;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    panStart = { x: e.clientX, y: e.clientY };
    panOrigin = { offsetX: mapTransform.offsetX, offsetZ: mapTransform.offsetZ };
    e.preventDefault();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (!isPanning && Math.hypot(dx, dy) > 4) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
      }
      if (isPanning) {
        mapTransform.offsetX = panOrigin.offsetX + dx;
        mapTransform.offsetZ = panOrigin.offsetZ + dy;
        if (!framePending) {
          framePending = true;
          requestAnimationFrame(() => { renderTrackOffscreen(); drawMap(); framePending = false; });
        }
      }
      return; // always skip hover-scrub while mouse button is held
    }

    // Hover scrub — snap cursor to nearest track point
    if (!sessions.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);

    let bestTime = -1, bestDist = Infinity;
    for (const sess of sessions) {
      if (!sess.visible) continue;
      for (let i = 0; i < sess.frames.length; i += 5) {
        const f = sess.frames[i];
        const { cx, cy } = gpsToCanvas(f.x, f.z);
        const d = Math.hypot(cx - mx, cy - my);
        if (d < bestDist) { bestDist = d; bestTime = f.t; }
      }
    }
    if (bestDist < 50 && bestTime >= 0) setCurrentTime(bestTime);
  });

  canvas.addEventListener('mouseup', () => {
    panStart = null;
    isPanning = false;
    panOrigin = null;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('mouseleave', () => {
    panStart = null;
    isPanning = false;
    panOrigin = null;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!sessions.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(0.05, Math.min(100, mapTransform.scale * factor));
    // Zoom toward mouse cursor
    mapTransform.offsetX = mx - (mx - mapTransform.offsetX) * (newScale / mapTransform.scale);
    mapTransform.offsetZ = my - (my - mapTransform.offsetZ) * (newScale / mapTransform.scale);
    mapTransform.scale = newScale;
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(() => { renderTrackOffscreen(); drawMap(); framePending = false; });
    }
  }, { passive: false });

  // Double-click to reset fit
  canvas.addEventListener('dblclick', () => {
    if (!sessions.length) return;
    fullRedraw();
  });
}

// ── Drag-drop onto map panel ──────────────────

function initDragDrop() {
  const panel = document.getElementById('map-panel');
  panel.addEventListener('dragover', (e) => e.preventDefault());
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach((file) => {
      if (!file.name.endsWith('.json')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { loadSession(file.name, JSON.parse(ev.target.result)); }
        catch { alert(`Cannot read ${file.name}`); }
      };
      reader.readAsText(file);
    });
  });
}

// ── Playback ──────────────────────────────────

let playInterval = null;
let playSpeed = 1;
const PLAY_STEP_MS = 50;

function setPlaying(playing) {
  if (playInterval) { clearInterval(playInterval); playInterval = null; }
  if (playing && sessions.length) {
    playInterval = setInterval(() => {
      const max = getMaxDuration();
      if (currentTime >= max) { setPlaying(false); return; }
      setCurrentTime(currentTime + (PLAY_STEP_MS / 1000) * playSpeed);
    }, PLAY_STEP_MS);
  }
  document.getElementById('btn-play').textContent = (playing && sessions.length) ? '⏸' : '▶';
}

document.getElementById('btn-play').addEventListener('click', () => {
  if (!sessions.length) return;
  // If at end, restart from beginning
  if (!playInterval && currentTime >= getMaxDuration()) setCurrentTime(0);
  setPlaying(!playInterval);
});

document.getElementById('btn-start').addEventListener('click', () => {
  setPlaying(false);
  setCurrentTime(0);
});

document.getElementById('btn-end').addEventListener('click', () => {
  setPlaying(false);
  setCurrentTime(getMaxDuration());
});

document.getElementById('btn-back').addEventListener('click', () => {
  setCurrentTime(Math.max(0, currentTime - 10));
});

document.getElementById('btn-fwd').addEventListener('click', () => {
  setCurrentTime(Math.min(getMaxDuration(), currentTime + 10));
});

document.getElementById('play-speed').addEventListener('change', (e) => {
  playSpeed = +e.target.value;
});

// ── Wire up controls ──────────────────────────

document.getElementById('btn-load').addEventListener('click', async () => {
  const files = await window.viewer.openFiles();
  for (const f of files) loadSession(f.name, f.data);
});

document.getElementById('btn-clear').addEventListener('click', () => {
  sessions = [];
  onSessionsChanged();
});

document.getElementById('color-by').addEventListener('change', (e) => {
  colorByChannel = e.target.value;
  if (sessions.length) fullRedraw();
});

document.getElementById('time-scrubber').addEventListener('input', (e) => {
  setPlaying(false);
  setCurrentTime(+e.target.value / 1000);
});

// ── Opacity slider ────────────────────────────

(async () => {
  const stored = await window.viewer.getOpacity();
  const pct = Math.round(stored * 100);
  const slider = document.getElementById('opacity-slider');
  const label  = document.getElementById('opacity-val');
  slider.value = pct;
  label.textContent = pct + '%';
  slider.style.setProperty('--pct', pct + '%');
})();

document.getElementById('opacity-slider').addEventListener('input', (e) => {
  const pct = +e.target.value;
  document.getElementById('opacity-val').textContent = pct + '%';
  e.target.style.setProperty('--pct', pct + '%');
  window.viewer.setOpacity(pct / 100);
});

// ── Boot ──────────────────────────────────────

new ResizeObserver(resizeCanvas).observe(document.getElementById('map-panel'));
initMapInteraction();
initDragDrop();
buildTelemetryTable();
updateSessionList();
resizeCanvas();
