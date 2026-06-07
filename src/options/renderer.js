let original = {};

function pct(val, min, max) {
  return ((val - min) / (max - min) * 100).toFixed(1) + '%';
}

function setSlider(id, value, min, max, labelId, labelFmt) {
  const el = document.getElementById(id);
  el.value = value;
  el.style.setProperty('--pct', pct(value, min, max));
  document.getElementById(labelId).textContent = labelFmt(value);
}

// ── Load config ──────────────────────────

window.options.getConfig().then((cfg) => {
  original = { ...cfg };

  setSlider('opacity', Math.round(cfg.widgetOpacity * 100), 0, 100, 'opacity-val', (v) => v + '%');
  setSlider('scale',   Math.round(cfg.overlayScale * 100),  50, 150, 'scale-val',   (v) => v + '%');

  document.querySelector(`input[name="theme"][value="${cfg.theme}"]`).checked = true;

  document.getElementById('auto-theme').checked = cfg.autoTheme;
  document.getElementById('freeRoamTheme').value = cfg.freeRoamTheme;
  document.getElementById('raceTheme').value = cfg.raceTheme;
  document.getElementById('startWithWindows').checked = cfg.startWithWindows;

  updateAutoThemeVisibility();
});

// ── Slider live preview ──────────────────

document.getElementById('opacity').addEventListener('input', (e) => {
  const v = +e.target.value;
  e.target.style.setProperty('--pct', pct(v, 0, 100));
  document.getElementById('opacity-val').textContent = v + '%';
  window.options.applyLive({ widgetOpacity: v / 100 });
});

document.getElementById('scale').addEventListener('input', (e) => {
  const v = +e.target.value;
  e.target.style.setProperty('--pct', pct(v, 50, 150));
  document.getElementById('scale-val').textContent = v + '%';
  window.options.applyLive({ overlayScale: v / 100 });
});

// ── Auto-theme toggle ────────────────────

function updateAutoThemeVisibility() {
  const checked = document.getElementById('auto-theme').checked;
  document.getElementById('auto-theme-opts').classList.toggle('hidden', !checked);
}

document.getElementById('auto-theme').addEventListener('change', updateAutoThemeVisibility);

// ── OK / Cancel ──────────────────────────

document.getElementById('btn-ok').addEventListener('click', () => {
  window.options.save({
    widgetOpacity:    +document.getElementById('opacity').value / 100,
    overlayScale:     +document.getElementById('scale').value / 100,
    theme:            document.querySelector('input[name="theme"]:checked')?.value ?? 'default',
    autoTheme:        document.getElementById('auto-theme').checked,
    freeRoamTheme:    document.getElementById('freeRoamTheme').value,
    raceTheme:        document.getElementById('raceTheme').value,
    startWithWindows: document.getElementById('startWithWindows').checked,
  });
});

document.getElementById('btn-cancel').addEventListener('click', () => {
  window.options.cancel(original);
});
