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

// ── Design 1: 族 Kanji ────────────────────────────────────────────────────────
function design1() {
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
    <linearGradient id="kanji" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="50%" stop-color="#9b59b6"/>
      <stop offset="100%" stop-color="#e74c3c"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="7"/>
  <!-- Subtle inner ring -->
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.38}" fill="none" stroke="rgba(0,212,255,0.15)" stroke-width="1.5"/>
  <!-- Kanji 族 -->
  <text x="${cx}" y="${cy + 18}" font-family="'Yu Gothic', 'MS Gothic', serif"
    font-size="148" font-weight="bold" fill="url(#kanji)" filter="url(#glow)"
    text-anchor="middle" dominant-baseline="middle">族</text>
  <!-- ZOKU subtitle -->
  <text x="${cx}" y="${SIZE - 30}" font-family="Arial, sans-serif"
    font-size="20" font-weight="bold" fill="rgba(255,255,255,0.45)"
    text-anchor="middle" letter-spacing="8">ZOKU</text>
</svg>`;
}

// ── Design 2: Neon Z ──────────────────────────────────────────────────────────
function design2() {
  // Bold Z shape using polygon points
  const pad = 44;
  const top = pad;
  const bot = SIZE - pad;
  const thick = 36;
  // Z: top-left to top-right, diagonal to bottom-left, bottom-left to bottom-right
  const zPoints = [
    `${pad},${top}`,
    `${SIZE - pad},${top}`,
    `${SIZE - pad},${top + thick}`,
    `${pad + thick * 1.2},${bot - thick}`,
    `${SIZE - pad},${bot - thick}`,
    `${SIZE - pad},${bot}`,
    `${pad},${bot}`,
    `${pad},${bot - thick}`,
    `${SIZE - pad - thick * 1.2},${top + thick}`,
    `${pad},${top + thick}`,
  ].join(' ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
    <linearGradient id="zgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="55%" stop-color="#9b59b6"/>
      <stop offset="100%" stop-color="#e74c3c"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="40" fill="url(#bg)"/>
  <!-- Speed lines -->
  ${[0.25, 0.45, 0.65, 0.80].map(t => {
    const y = top + (bot - top) * t;
    const x1 = pad * 0.4;
    const x2 = SIZE - pad * 0.4;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="rgba(155,89,182,0.12)" stroke-width="1.5"/>`;
  }).join('\n  ')}
  <!-- Z shape -->
  <polygon points="${zPoints}" fill="url(#zgrad)" filter="url(#glow)"/>
  <!-- Border -->
  <rect width="${SIZE}" height="${SIZE}" rx="40" fill="none"
    stroke="#9b59b6" stroke-width="6"/>
</svg>`;
}

// ── Design 3: Full-circle gauge ───────────────────────────────────────────────
function design3() {
  // Full 340° sweep gauge (10° gap at bottom)
  const arcR = 88;
  const arcW = 14;
  const start = 95;   // just past 6 o'clock going clockwise
  const end   = 85 + 360;  // 340° sweep

  const seg = (end - start) / 5;
  const colors = ['#00d4ff', '#3498db', '#9b59b6', '#f39c12', '#e74c3c'];
  const segments = colors.map((c, i) => {
    const s = start + seg * i;
    const e = start + seg * (i + 1) - 0.5;
    return `<path d="${arc(arcR, s, e)}" fill="none" stroke="${c}"
      stroke-width="${arcW}" stroke-linecap="butt"/>`;
  }).join('\n  ');

  // Needle at 72%
  const needleDeg = start + (end - start) * 0.72;
  const nTip = pt(arcR - 4, needleDeg);
  const nBase1 = pt(8, needleDeg + 90);
  const nBase2 = pt(8, needleDeg - 90);

  // Tick marks
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const deg = start + (end - start) * (i / 10);
    const inner = i % 5 === 0 ? arcR - arcW * 1.2 : arcR - arcW * 0.7;
    const outer = arcR + arcW * 0.3;
    const a = pt(inner, deg);
    const b = pt(outer, deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${i % 5 === 0 ? '0.7' : '0.3'})"
      stroke-width="${i % 5 === 0 ? 2.5 : 1.2}"/>`;
  }).join('\n  ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE * 0.46}" fill="none" stroke="#9b59b6" stroke-width="6"/>
  <!-- Arc track -->
  <path d="${arc(arcR, start, end)}" fill="none"
    stroke="rgba(255,255,255,0.08)" stroke-width="${arcW}" stroke-linecap="round"/>
  <!-- Coloured segments -->
  ${segments}
  <!-- Ticks -->
  ${ticks}
  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nBase1.x},${nBase1.y} ${nBase2.x},${nBase2.y}"
    fill="white"/>
  <!-- Hub -->
  <circle cx="${cx}" cy="${cy}" r="10" fill="#9b59b6"/>
  <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
  <!-- Labels -->
  <text x="${cx}" y="${cy + 28}" font-family="Arial" font-size="22" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
  <text x="${cx}" y="${cy + 46}" font-family="Arial" font-size="11"
    fill="rgba(255,255,255,0.4)" text-anchor="middle" letter-spacing="3">TELEMETRY</text>
</svg>`;
}

// ── Design 4: Hexagon data ────────────────────────────────────────────────────
function design4() {
  // Hexagon outline
  const hexR = SIZE * 0.46;
  const hexPts = Array.from({ length: 6 }, (_, i) => {
    const a = (60 * i - 30) * Math.PI / 180;
    return `${cx + hexR * Math.cos(a)},${cy + hexR * Math.sin(a)}`;
  }).join(' ');

  // Inner hex
  const hexR2 = SIZE * 0.36;
  const hexPts2 = Array.from({ length: 6 }, (_, i) => {
    const a = (60 * i - 30) * Math.PI / 180;
    return `${cx + hexR2 * Math.cos(a)},${cy + hexR2 * Math.sin(a)}`;
  }).join(' ');

  // Data nodes on inner hex vertices
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (60 * i - 30) * Math.PI / 180;
    const x = cx + hexR2 * Math.cos(a);
    const y = cy + hexR2 * Math.sin(a);
    const colors = ['#00d4ff','#9b59b6','#e74c3c','#f39c12','#2ecc71','#3498db'];
    return `<circle cx="${x}" cy="${y}" r="6" fill="${colors[i]}"/>`;
  }).join('\n  ');

  // Spokes
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const a = (60 * i - 30) * Math.PI / 180;
    const x = cx + hexR2 * Math.cos(a);
    const y = cy + hexR2 * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"
      stroke="rgba(155,89,182,0.3)" stroke-width="1"/>`;
  }).join('\n  ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
    <linearGradient id="zgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#9b59b6"/>
    </linearGradient>
  </defs>
  <polygon points="${hexPts}" fill="url(#bg)" stroke="#9b59b6" stroke-width="6"/>
  <polygon points="${hexPts2}" fill="none" stroke="rgba(0,212,255,0.2)" stroke-width="1.5"/>
  ${spokes}
  ${nodes}
  <text x="${cx}" y="${cy + 10}" font-family="Arial" font-size="38" font-weight="bold"
    fill="url(#zgrad)" text-anchor="middle" dominant-baseline="middle">ZOKU</text>
  <text x="${cx}" y="${cy + 36}" font-family="Arial" font-size="11"
    fill="rgba(255,255,255,0.35)" text-anchor="middle" letter-spacing="4">族</text>
</svg>`;
}

// ── Design 5: Touge / Rising lines ───────────────────────────────────────────
function design5() {
  // Inspired by Japanese racing livery: bold horizontal stripes + rising sun arc
  const stripes = [0.35, 0.50, 0.65].map((t, i) => {
    const y = SIZE * t;
    const width = [SIZE * 0.7, SIZE * 0.85, SIZE * 0.7][i];
    const x = (SIZE - width) / 2;
    const colors = ['#00d4ff', '#9b59b6', '#e74c3c'];
    const h = [6, 10, 6][i];
    return `<rect x="${x}" y="${y - h / 2}" width="${width}" height="${h}"
      rx="3" fill="${colors[i]}" opacity="0.85"/>`;
  }).join('\n  ');

  // Rising sun arcs (bottom-center)
  const sunArcs = [40, 60, 80].map((r, i) => {
    const opacity = [0.15, 0.25, 0.35][i];
    return `<path d="${arc(r, 180, 360)}" fill="none"
      stroke="#f39c12" stroke-width="${[8, 5, 3][i]}" opacity="${opacity}"
      stroke-linecap="round"/>`;
  }).join('\n  ');

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
    <linearGradient id="title" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#9b59b6"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="32" fill="url(#bg)"/>
  <!-- Rising sun arcs at bottom -->
  <g transform="translate(${cx}, ${SIZE - 20})">${
    [40, 60, 80].map((r, i) => {
      const opacity = [0.12, 0.22, 0.32][i];
      const s = pt(r, 180);
      const e = pt(r, 360);
      return `<path d="M ${s.x - cx},${s.y - (SIZE-20)} A ${r} ${r} 0 0 1 ${e.x - cx},${e.y - (SIZE-20)}"
        fill="none" stroke="#f39c12" stroke-width="${[10, 6, 3][i]}" opacity="${opacity}"
        stroke-linecap="round"/>`;
    }).join('')
  }</g>
  <!-- Stripes -->
  ${stripes}
  <!-- Main text -->
  <text x="${cx}" y="${cy - 10}" font-family="Arial" font-size="64" font-weight="bold"
    fill="url(#title)" text-anchor="middle" dominant-baseline="middle"
    letter-spacing="4">ZOKU</text>
  <!-- Kanji below -->
  <text x="${cx}" y="${cy + 36}" font-family="'Yu Gothic', serif" font-size="28"
    fill="rgba(255,255,255,0.3)" text-anchor="middle">族</text>
  <!-- Border -->
  <rect width="${SIZE}" height="${SIZE}" rx="32" fill="none"
    stroke="#9b59b6" stroke-width="5"/>
</svg>`;
}

async function generate() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });

  const designs = [design1, design2, design3, design4, design5];
  const names   = ['kanji', 'neon-z', 'full-gauge', 'hexagon', 'touge'];

  for (let i = 0; i < designs.length; i++) {
    const svg = Buffer.from(designs[i]());
    const png = await sharp(svg, { density: 300 }).png().toBuffer();
    const file = path.join(outDir, `icon-${i + 1}-${names[i]}.png`);
    fs.writeFileSync(file, png);
    console.log(`Design ${i + 1} (${names[i]}): ${file}`);
  }

  console.log('\nDone. View the PNGs to pick your favourite.');
}

generate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
