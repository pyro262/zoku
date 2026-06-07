const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const cx = SIZE / 2;
const cy = SIZE / 2;

function pt(r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(r, startDeg, endDeg) {
  const s = pt(r, startDeg);
  const e = pt(r, endDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function segments(r, w, start, end, colors, gap = 0.5) {
  const count = colors.length;
  const sweep = end - start;
  return colors.map((c, i) => {
    const s = start + (sweep / count) * i + gap;
    const e = start + (sweep / count) * (i + 1) - gap;
    return `<path d="${arc(r, s, e)}" fill="none" stroke="${c}"
      stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('\n  ');
}

function ticks(r, w, start, end, count, major) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const deg = start + (end - start) * (i / count);
    const isMajor = i % major === 0;
    const inner = r - w * (isMajor ? 1.3 : 0.8);
    const outer = r + w * 0.4;
    const a = pt(inner, deg);
    const b = pt(outer, deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${isMajor ? 0.7 : 0.3})"
      stroke-width="${isMajor ? 2.5 : 1.2}"/>`;
  }).join('\n  ');
}

function needle(deg, len, width = 3) {
  const tip   = pt(len, deg);
  const base1 = pt(width * 2, deg + 90);
  const base2 = pt(width * 2, deg - 90);
  return `<polygon points="${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}"
    fill="white" filter="url(#glow)"/>`;
}

const BG = `
  <radialGradient id="bg" cx="50%" cy="40%" r="65%">
    <stop offset="0%" stop-color="#1a0a2e"/>
    <stop offset="100%" stop-color="#080612"/>
  </radialGradient>`;

const GLOW = `
  <filter id="glow">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

const GLOW_STRONG = `
  <filter id="glow">
    <feGaussianBlur stdDeviation="5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

// ── Variant A: Glow arc, rounded segments, subtle double ring ─────────────────
function variantA() {
  const arcR = 88, arcW = 16;
  const start = 95, end = 85 + 360;
  const colors = ['#00d4ff', '#3498db', '#9b59b6', '#f39c12', '#e74c3c'];
  const ndeg = start + (end - start) * 0.72;
  const nTip = pt(arcR - 4, ndeg);
  const nb1  = pt(9, ndeg + 90);
  const nb2  = pt(9, ndeg - 90);

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>${BG}${GLOW_STRONG}
    <filter id="arcglow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <!-- Double border ring -->
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.42}" fill="none" stroke="rgba(0,212,255,0.15)" stroke-width="1"/>
  <!-- Arc track -->
  <path d="${arc(arcR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.07)" stroke-width="${arcW}" stroke-linecap="round"/>
  <!-- Coloured segments with glow -->
  <g filter="url(#arcglow)">${segments(arcR, arcW, start, end, colors, 1)}</g>
  <!-- Tick marks -->
  ${ticks(arcR, arcW, start, end, 10, 5)}
  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="11" fill="#9b59b6" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
  <text x="${cx}" y="${cy + 30}" font-family="Arial" font-size="22" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
  <text x="${cx}" y="${cy + 48}" font-family="'Yu Gothic', serif" font-size="14"
    fill="rgba(255,255,255,0.35)" text-anchor="middle">族</text>
</svg>`;
}

// ── Variant B: Wider gap, fine ticks, no subtitle, cyan needle ────────────────
function variantB() {
  const arcR = 90, arcW = 12;
  const start = 110, end = 70 + 360;  // 320° sweep, bigger gap at bottom
  const colors = ['#00d4ff', '#00d4ff', '#9b59b6', '#f39c12', '#e74c3c'];
  const ndeg = start + (end - start) * 0.68;
  const nTip = pt(arcR + 2, ndeg);
  const nb1  = pt(7, ndeg + 90);
  const nb2  = pt(7, ndeg - 90);

  // Fine ticks (20 intervals)
  const fineTicks = Array.from({ length: 21 }, (_, i) => {
    const deg = start + (end - start) * (i / 20);
    const isMajor = i % 5 === 0;
    const inner = isMajor ? arcR - arcW * 1.5 : arcR - arcW * 0.9;
    const outer = arcR - arcW * 0.1;
    const a = pt(inner, deg);
    const b = pt(outer, deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${isMajor ? 0.75 : 0.25})"
      stroke-width="${isMajor ? 2 : 1}"/>`;
  }).join('\n  ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>${BG}${GLOW}</defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <path d="${arc(arcR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.06)" stroke-width="${arcW}"/>
  ${segments(arcR, arcW, start, end, colors, 0.8)}
  ${fineTicks}
  <!-- Cyan needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="#00d4ff" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="9" fill="#1a0a2e" stroke="#00d4ff" stroke-width="3"/>
  <!-- Large ZOKU, centred -->
  <text x="${cx}" y="${cy + 12}" font-family="Arial" font-size="26" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
</svg>`;
}

// ── Variant C: Dual concentric arcs (outer RPM, inner throttle) ───────────────
function variantC() {
  const outerR = 92, outerW = 10;
  const innerR = 70, innerW = 8;
  const start = 95, end = 85 + 360;
  const outerColors = ['#00d4ff', '#3498db', '#9b59b6', '#f39c12', '#e74c3c'];
  const innerColors = ['#2ecc71', '#2ecc71', '#f39c12', '#e74c3c'];
  const ndeg = start + (end - start) * 0.72;
  const nTip = pt(outerR + 4, ndeg);
  const nb1  = pt(6, ndeg + 90);
  const nb2  = pt(6, ndeg - 90);

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>${BG}${GLOW}</defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <!-- Outer arc track -->
  <path d="${arc(outerR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.07)" stroke-width="${outerW}"/>
  <!-- Inner arc track -->
  <path d="${arc(innerR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.05)" stroke-width="${innerW}"/>
  <!-- Outer (RPM) segments -->
  ${segments(outerR, outerW, start, end, outerColors, 1.5)}
  <!-- Inner (throttle) segments -->
  ${segments(innerR, innerW, start, end, innerColors, 1.5)}
  <!-- Major ticks only -->
  ${ticks(outerR, outerW, start, end, 10, 5)}
  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="10" fill="#9b59b6"/>
  <circle cx="${cx}" cy="${cy}" r="4" fill="white"/>
  <text x="${cx}" y="${cy + 26}" font-family="Arial" font-size="20" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
  <text x="${cx}" y="${cy + 42}" font-family="Arial" font-size="9"
    fill="rgba(255,255,255,0.35)" text-anchor="middle" letter-spacing="3">TELEMETRY</text>
</svg>`;
}

// ── Variant D: Smooth gradient arc (no segments), bold bottom label ───────────
function variantD() {
  const arcR = 88, arcW = 18;
  const start = 95, end = 85 + 360;
  const ndeg = start + (end - start) * 0.72;
  const nTip = pt(arcR, ndeg);
  const nb1  = pt(10, ndeg + 90);
  const nb2  = pt(10, ndeg - 90);

  // Gradient along arc approximated by many thin segments
  const steps = 36;
  const sweep = end - start;
  const gradSegs = Array.from({ length: steps }, (_, i) => {
    const t  = i / steps;
    const s  = start + sweep * t;
    const e  = start + sweep * ((i + 1) / steps);
    // Interpolate colour: cyan→purple→yellow→red
    let color;
    if (t < 0.33)      color = lerpHex('#00d4ff', '#9b59b6', t / 0.33);
    else if (t < 0.66) color = lerpHex('#9b59b6', '#f39c12', (t - 0.33) / 0.33);
    else               color = lerpHex('#f39c12', '#e74c3c', (t - 0.66) / 0.34);
    return `<path d="${arc(arcR, s, e)}" fill="none" stroke="${color}"
      stroke-width="${arcW}" stroke-linecap="butt"/>`;
  }).join('\n  ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>${BG}${GLOW}</defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <!-- Arc track -->
  <path d="${arc(arcR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.06)" stroke-width="${arcW}" stroke-linecap="round"/>
  <!-- Smooth gradient arc -->
  ${gradSegs}
  <!-- Tick marks -->
  ${ticks(arcR, arcW, start, end, 10, 5)}
  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="12" fill="#0a0812" stroke="#9b59b6" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
  <!-- Bold label -->
  <text x="${cx}" y="${cy + 30}" font-family="Arial" font-size="26" font-weight="bold"
    fill="white" text-anchor="middle" letter-spacing="2">ZOKU</text>
</svg>`;
}

// ── Variant E: Off-centre dial, asymmetric, 族 kanji hub ─────────────────────
function variantE() {
  const arcR = 86, arcW = 13;
  const start = 130, end = 50 + 360; // 280° sweep
  const colors = ['#00d4ff', '#9b59b6', '#9b59b6', '#f39c12', '#e74c3c'];
  const ndeg  = start + (50 + 360 - 130) * 0.70;
  const nTip  = pt(arcR - 2, ndeg);
  const nb1   = pt(8, ndeg + 90);
  const nb2   = pt(8, ndeg - 90);

  // Decorative inner data ring (partial)
  const innerR = 58;

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>${BG}${GLOW}
    <radialGradient id="hub" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#2a1a4e"/>
      <stop offset="100%" stop-color="#0a0812"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <!-- Outer rings -->
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.35}" fill="none" stroke="rgba(155,89,182,0.2)" stroke-width="1"/>
  <!-- Inner decorative partial arc -->
  <path d="${arc(innerR, 130, 50 + 360)}" fill="none"
    stroke="rgba(0,212,255,0.18)" stroke-width="2" stroke-linecap="round"/>
  <!-- Main arc track -->
  <path d="${arc(arcR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.07)" stroke-width="${arcW}"/>
  ${segments(arcR, arcW, start, end, colors, 1)}
  ${ticks(arcR, arcW, start, end, 10, 5)}
  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="white" filter="url(#glow)"/>
  <!-- Hub with kanji -->
  <circle cx="${cx}" cy="${cy}" r="22" fill="url(#hub)" stroke="#9b59b6" stroke-width="2"/>
  <text x="${cx}" y="${cy + 1}" font-family="'Yu Gothic', 'MS Gothic', serif"
    font-size="22" fill="#00d4ff" text-anchor="middle" dominant-baseline="middle"
    filter="url(#glow)">族</text>
  <!-- ZOKU label bottom -->
  <text x="${cx}" y="${SIZE - 34}" font-family="Arial" font-size="18" font-weight="bold"
    fill="rgba(255,255,255,0.8)" text-anchor="middle" letter-spacing="4">ZOKU</text>
</svg>`;
}

function lerpHex(a, b, t) {
  const h = (s) => parseInt(s.slice(1), 16);
  const r = (c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  const ca = r(h(a)), cb = r(h(b));
  const ri = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const gi = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bi = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${ri},${gi},${bi})`;
}

async function generate() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });

  const variants = [
    { fn: variantA, name: 'gauge-a-glow' },
    { fn: variantB, name: 'gauge-b-finetick' },
    { fn: variantC, name: 'gauge-c-dual-arc' },
    { fn: variantD, name: 'gauge-d-smooth' },
    { fn: variantE, name: 'gauge-e-kanji-hub' },
  ];

  for (const { fn, name } of variants) {
    const svg = Buffer.from(fn());
    const png = await sharp(svg, { density: 300 }).png().toBuffer();
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, png);
    console.log(`${name}: ${file}`);
  }

  console.log('\nDone.');
}

generate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
