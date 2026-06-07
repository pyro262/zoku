const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const SIZES = [256, 64, 32, 16];

function pt(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx, cy, r, startDeg, endDeg) {
  const s = pt(cx, cy, r, startDeg);
  const e = pt(cx, cy, r, endDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function buildSVG(size) {
  const cx = size / 2;
  const cy = size / 2;

  const arcR   = size * 0.344;
  const arcW   = size * 0.055;
  const S = 95, E = 85 + 360;
  const warm   = ['#f39c12', '#e67e22', '#e74c3c', '#c0392b', '#9b59b6'];
  const sweep  = E - S;
  const gap    = size >= 64 ? 1 : 0.4;

  // Coloured arc segments
  const arcSegs = warm.map((c, i) => {
    const s = S + (sweep / warm.length) * i + gap;
    const e = S + (sweep / warm.length) * (i + 1) - gap;
    return `<path d="${arc(cx, cy, arcR, s, e)}" fill="none" stroke="${c}"
      stroke-width="${arcW}" stroke-linecap="round"/>`;
  }).join('\n  ');

  // Tick marks
  const tickCount = size >= 64 ? 10 : 5;
  const majorEvery = size >= 64 ? 5 : 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const deg = S + sweep * (i / tickCount);
    const major = i % majorEvery === 0;
    const inner = arcR - arcW * (major ? 1.4 : 0.8);
    const outer = arcR + arcW * 0.35;
    const a = pt(cx, cy, inner, deg);
    const b = pt(cx, cy, outer, deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${major ? 0.75 : 0.28})"
      stroke-width="${major ? size * 0.01 : size * 0.005}"/>`;
  }).join('\n  ');

  // Needle
  const ndeg  = S + sweep * 0.72;
  const nTip  = pt(cx, cy, arcR, ndeg);
  const nb1   = pt(cx, cy, size * 0.035, ndeg + 90);
  const nb2   = pt(cx, cy, size * 0.035, ndeg - 90);

  // Hub & kanji — only on larger sizes
  const hubR     = size * 0.11;
  const fontSize = size * 0.105;
  // Yu Gothic unavailable in librsvg — use generic serif and manual y offset
  // Baseline sits ~0.75em from top of em box; shift up by 0.25em to visually centre
  const kanjiY   = cy + fontSize * 0.28;
  const hub = size >= 32 ? `
  <circle cx="${cx}" cy="${cy}" r="${hubR}" fill="#1f0a0a" stroke="#e74c3c" stroke-width="${size * 0.01}"/>
  <text x="${cx}" y="${kanjiY}" font-family="serif"
    font-size="${fontSize}" fill="#e74c3c"
    text-anchor="middle" dominant-baseline="auto"
    filter="url(#glow)">族</text>` : `
  <circle cx="${cx}" cy="${cy}" r="${hubR}" fill="#e74c3c"/>`;

  // ZOKU label — just below hub circle, only 64px+
  const zokuY = cy + hubR + size * 0.1;
  const label = size >= 64
    ? `<text x="${cx}" y="${zokuY}" font-family="Arial, sans-serif"
        font-size="${size * 0.075}" font-weight="bold" fill="white"
        text-anchor="middle" letter-spacing="${size * 0.008}">ZOKU</text>`
    : '';

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1f0a0a"/>
      <stop offset="100%" stop-color="#080612"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${size * 0.016}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.46}" fill="none"
    stroke="#e74c3c" stroke-width="${size * 0.024}"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.42}" fill="none"
    stroke="rgba(243,156,18,0.15)" stroke-width="${Math.max(1, size * 0.004)}"/>

  <!-- Arc track -->
  <path d="${arc(cx, cy, arcR, S, E)}" fill="none"
    stroke="rgba(255,255,255,0.07)" stroke-width="${arcW}" stroke-linecap="round"/>

  <!-- Coloured segments -->
  ${arcSegs}

  <!-- Ticks -->
  ${ticks}

  <!-- Needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}"
    fill="white" filter="url(#glow)"/>

  <!-- Hub + 族 -->
  ${hub}

  <!-- ZOKU -->
  ${label}
</svg>`;
}

async function generate() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Generating final icon...');
  const pngBuffers = await Promise.all(SIZES.map(async (size) => {
    const png = await sharp(Buffer.from(buildSVG(size)), { density: 300 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    console.log(`  ${size}x${size}`);
    return png;
  }));

  fs.writeFileSync(path.join(outDir, 'icon.png'), pngBuffers[0]);

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('Done — build/icon.ico + build/icon.png');
}

generate().catch(err => { console.error(err.message); process.exit(1); });
