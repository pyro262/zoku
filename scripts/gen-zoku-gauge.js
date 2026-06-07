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

function segs(r, w, start, end, colors, gap = 1) {
  const sweep = end - start;
  return colors.map((c, i) => {
    const s = start + (sweep / colors.length) * i + gap;
    const e = start + (sweep / colors.length) * (i + 1) - gap;
    return `<path d="${arc(r, s, e)}" fill="none" stroke="${c}"
      stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('\n  ');
}

function smoothArc(r, w, start, end, steps = 40) {
  const sweep = end - start;
  return Array.from({ length: steps }, (_, i) => {
    const t  = i / steps;
    const s  = start + sweep * t;
    const e  = start + sweep * ((i + 1) / steps);
    let color;
    if (t < 0.33)      color = lerp('#00d4ff', '#9b59b6', t / 0.33);
    else if (t < 0.66) color = lerp('#9b59b6', '#f39c12', (t - 0.33) / 0.33);
    else               color = lerp('#f39c12', '#e74c3c', (t - 0.66) / 0.34);
    return `<path d="${arc(r, s, e)}" fill="none" stroke="${color}"
      stroke-width="${w}" stroke-linecap="butt"/>`;
  }).join('\n  ');
}

function tickMarks(r, w, start, end, count, majorEvery) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const deg = start + (end - start) * (i / count);
    const major = i % majorEvery === 0;
    const inner = r - w * (major ? 1.4 : 0.8);
    const outer = r + w * 0.35;
    const a = pt(inner, deg);
    const b = pt(outer, deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${major ? 0.75 : 0.28})"
      stroke-width="${major ? 2.5 : 1.2}"/>`;
  }).join('\n  ');
}

function lerp(a, b, t) {
  const h = s => parseInt(s.slice(1), 16);
  const r = c => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  const ca = r(h(a)), cb = r(h(b));
  return `rgb(${Math.round(ca[0]+(cb[0]-ca[0])*t)},${Math.round(ca[1]+(cb[1]-ca[1])*t)},${Math.round(ca[2]+(cb[2]-ca[2])*t)})`;
}

const PLASMA = ['#00d4ff', '#3498db', '#9b59b6', '#f39c12', '#e74c3c'];
const GLOW   = `<filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const GLOW2  = `<filter id="glow2"><feGaussianBlur stdDeviation="7" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

// ── 1: Watermark 族 behind gauge, segmented arc, ZOKU bottom ─────────────────
const v1 = () => {
  const [R, W, S, E] = [88, 14, 95, 85+360];
  const ndeg = S+(E-S)*0.72, nTip=pt(R,ndeg), nb1=pt(9,ndeg+90), nb2=pt(9,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="6"/>
  <!-- Dim watermark kanji -->
  <text x="${cx}" y="${cy+14}" font-family="'Yu Gothic','MS Gothic',serif" font-size="148"
    fill="rgba(155,89,182,0.08)" text-anchor="middle" dominant-baseline="middle">族</text>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${W}" stroke-linecap="round"/>
  ${segs(R,W,S,E,PLASMA,1)}
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="11" fill="#9b59b6"/><circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
  <text x="${cx}" y="${cy+30}" font-family="Arial" font-size="22" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
</svg>`;
};

// ── 2: 族 hub (glowing cyan), ZOKU bottom, fine ticks, thin needle ───────────
const v2 = () => {
  const [R, W, S, E] = [90, 11, 110, 70+360];
  const ndeg = S+(E-S)*0.70, nTip=pt(R+4,ndeg), nb1=pt(5,ndeg+90), nb2=pt(5,ndeg-90);
  const fine = Array.from({length:21},(_,i)=>{
    const deg=S+(E-S)*(i/20), major=i%5===0;
    const inner=R-W*(major?1.6:0.9), outer=R-W*0.1;
    const a=pt(inner,deg), b=pt(outer,deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(255,255,255,${major?.7:.25})" stroke-width="${major?2:1}"/>`;
  }).join('');
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${W}"/>
  ${segs(R,W,S,E,PLASMA,0.8)}
  ${fine}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="#00d4ff" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="20" fill="#0d0820" stroke="#00d4ff" stroke-width="2"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="22"
    fill="#00d4ff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="${SIZE-30}" font-family="Arial" font-size="18" font-weight="bold"
    fill="rgba(255,255,255,0.85)" text-anchor="middle" letter-spacing="4">ZOKU</text>
</svg>`;
};

// ── 3: ZOKU at top, 族 hub purple, smooth gradient arc ───────────────────────
const v3 = () => {
  const [R, W, S, E] = [86, 16, 100, 80+360];
  const ndeg = S+(E-S)*0.72, nTip=pt(R,ndeg), nb1=pt(10,ndeg+90), nb2=pt(10,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.40}" fill="none" stroke="rgba(0,212,255,0.12)" stroke-width="1"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${W}" stroke-linecap="round"/>
  ${smoothArc(R,W,S,E,40)}
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="22" fill="#1a0a2e" stroke="#9b59b6" stroke-width="2.5"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="24"
    fill="#9b59b6" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="32" font-family="Arial" font-size="22" font-weight="bold"
    fill="white" text-anchor="middle" letter-spacing="3">ZOKU</text>
</svg>`;
};

// ── 4: Dual arc + 族 hub + ZOKU + "族" subtitle ───────────────────────────────
const v4 = () => {
  const [OR,OW,IR,IW,S,E] = [90,10,68,7,95,85+360];
  const ndeg = S+(E-S)*0.72, nTip=pt(OR+3,ndeg), nb1=pt(6,ndeg+90), nb2=pt(6,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <path d="${arc(OR,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${OW}"/>
  <path d="${arc(IR,S,E)}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${IW}"/>
  ${segs(OR,OW,S,E,PLASMA,1.5)}
  ${segs(IR,IW,S,E,['#2ecc71','#2ecc71','#f39c12','#e74c3c'],1.5)}
  ${tickMarks(OR,OW,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="20" fill="#0d0820" stroke="#9b59b6" stroke-width="2"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="22"
    fill="#9b59b6" text-anchor="middle" dominant-baseline="middle">族</text>
  <text x="${cx}" y="${cy+30}" font-family="Arial" font-size="19" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
  <text x="${cx}" y="${cy+46}" font-family="Arial" font-size="9"
    fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="3">族</text>
</svg>`;
};

// ── 5: Minimal thin arc, line needle, large 族 hub, ZOKU wide-tracked ─────────
const v5 = () => {
  const [R, W, S, E] = [88, 7, 95, 85+360];
  const ndeg = S+(E-S)*0.72;
  const nTip=pt(R+8,ndeg), nBase=pt(18,ndeg+180);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="4"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${W}" stroke-linecap="round"/>
  ${smoothArc(R,W,S,E,36)}
  ${tickMarks(R,W,S,E,20,5)}
  <!-- Line needle -->
  <line x1="${nBase.x}" y1="${nBase.y}" x2="${nTip.x}" y2="${nTip.y}"
    stroke="white" stroke-width="2.5" stroke-linecap="round" filter="url(#glow)"/>
  <!-- Large 族 hub -->
  <circle cx="${cx}" cy="${cy}" r="30" fill="#0d0820" stroke="#9b59b6" stroke-width="2"/>
  <text x="${cx}" y="${cy+2}" font-family="'Yu Gothic','MS Gothic',serif" font-size="32"
    fill="#9b59b6" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="${SIZE-26}" font-family="Arial" font-size="14" font-weight="bold"
    fill="rgba(255,255,255,0.7)" text-anchor="middle" letter-spacing="8">ZOKU</text>
</svg>`;
};

// ── 6: Hexagonal outer frame, 族 cyan hub, smooth arc ────────────────────────
const v6 = () => {
  const [R, W, S, E] = [84, 13, 100, 80+360];
  const ndeg = S+(E-S)*0.72, nTip=pt(R,ndeg), nb1=pt(9,ndeg+90), nb2=pt(9,ndeg-90);
  const hexR = SIZE*.46;
  const hexPts = Array.from({length:6},(_,i)=>{
    const a=(60*i-30)*Math.PI/180;
    return `${cx+hexR*Math.cos(a)},${cy+hexR*Math.sin(a)}`;
  }).join(' ');
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <polygon points="${hexPts}" fill="url(#bg)" stroke="#9b59b6" stroke-width="5"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${W}" stroke-linecap="round"/>
  ${smoothArc(R,W,S,E,40)}
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="22" fill="#0d0820" stroke="#00d4ff" stroke-width="2"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="24"
    fill="#00d4ff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="${cy+32}" font-family="Arial" font-size="20" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
</svg>`;
};

// ── 7: Triple ring borders, segmented arc, 族 hub, ZOKU + telemetry ──────────
const v7 = () => {
  const [R, W, S, E] = [82, 14, 95, 85+360];
  const ndeg = S+(E-S)*0.72, nTip=pt(R,ndeg), nb1=pt(10,ndeg+90), nb2=pt(10,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}${GLOW2}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.43}" fill="none" stroke="rgba(0,212,255,0.2)" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.40}" fill="none" stroke="rgba(155,89,182,0.12)" stroke-width="1"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${W}" stroke-linecap="round"/>
  <g filter="url(#glow2)">${segs(R,W,S,E,PLASMA,1)}</g>
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="22" fill="#0d0820" stroke="#9b59b6" stroke-width="2.5"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="24"
    fill="#9b59b6" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="${cy+32}" font-family="Arial" font-size="20" font-weight="bold"
    fill="white" text-anchor="middle">ZOKU</text>
  <text x="${cx}" y="${cy+46}" font-family="Arial" font-size="9"
    fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="3">TELEMETRY</text>
</svg>`;
};

// ── 8: Warm palette (gold/red dominant), 族 red hub, ZOKU top ─────────────────
const v8 = () => {
  const [R, W, S, E] = [88, 14, 95, 85+360];
  const warm = ['#f39c12','#e67e22','#e74c3c','#c0392b','#9b59b6'];
  const ndeg = S+(E-S)*0.72, nTip=pt(R,ndeg), nb1=pt(9,ndeg+90), nb2=pt(9,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1f0a0a"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#e74c3c" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.42}" fill="none" stroke="rgba(243,156,18,0.15)" stroke-width="1"/>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${W}" stroke-linecap="round"/>
  ${segs(R,W,S,E,warm,1)}
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="22" fill="#1f0a0a" stroke="#e74c3c" stroke-width="2.5"/>
  <text x="${cx}" y="${cy+1}" font-family="'Yu Gothic','MS Gothic',serif" font-size="24"
    fill="#e74c3c" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="32" font-family="Arial" font-size="22" font-weight="bold"
    fill="white" text-anchor="middle" letter-spacing="2">ZOKU</text>
</svg>`;
};

// ── 9: 族 large centre with gauge overlaid, ZOKU bottom, double needle ────────
const v9 = () => {
  const [R, W, S, E] = [90, 10, 95, 85+360];
  const ndeg = S+(E-S)*0.72;
  const nTip=pt(R+2,ndeg), nb1=pt(7,ndeg+90), nb2=pt(7,ndeg-90);
  const nTip2=pt(14,ndeg+180), nb3=pt(4,ndeg+90), nb4=pt(4,ndeg-90);
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    <linearGradient id="kgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,212,255,0.25)"/>
      <stop offset="100%" stop-color="rgba(155,89,182,0.12)"/></linearGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <!-- Large semi-transparent 族 -->
  <text x="${cx}" y="${cy+14}" font-family="'Yu Gothic','MS Gothic',serif" font-size="130"
    fill="url(#kgrad)" text-anchor="middle" dominant-baseline="middle">族</text>
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${W}"/>
  ${segs(R,W,S,E,PLASMA,1)}
  ${tickMarks(R,W,S,E,10,5)}
  <!-- Main needle -->
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <!-- Counter needle (opposite) -->
  <polygon points="${nTip2.x},${nTip2.y} ${nb3.x},${nb3.y} ${nb4.x},${nb4.y}"
    fill="rgba(0,212,255,0.5)"/>
  <circle cx="${cx}" cy="${cy}" r="8" fill="#9b59b6"/>
  <circle cx="${cx}" cy="${cy}" r="3" fill="white"/>
  <text x="${cx}" y="${SIZE-28}" font-family="Arial" font-size="20" font-weight="bold"
    fill="white" text-anchor="middle" letter-spacing="3">ZOKU</text>
</svg>`;
};

// ── 10: Asymmetric needle stop, 族 hub, ZOKU + kanji stacked, inner tick ring ─
const v10 = () => {
  const [R, W, S, E] = [86, 13, 120, 60+360];  // 300° sweep
  const ndeg = S+(E-S)*0.72, nTip=pt(R-2,ndeg), nb1=pt(9,ndeg+90), nb2=pt(9,ndeg-90);
  const innerTickR = 62;
  const innerTicks = Array.from({length:11},(_,i)=>{
    const deg=S+(E-S)*(i/10);
    const a=pt(innerTickR,deg), b=pt(innerTickR-8,deg);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="rgba(0,212,255,${i%5===0?.45:.2})" stroke-width="${i%5===0?2:1}"/>`;
  }).join('');
  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1a0a2e"/><stop offset="100%" stop-color="#080612"/></radialGradient>
    <radialGradient id="hub" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#2a1a4e"/><stop offset="100%" stop-color="#0d0820"/></radialGradient>
    ${GLOW}
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.48}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.46}" fill="none" stroke="#9b59b6" stroke-width="5"/>
  <circle cx="${cx}" cy="${cy}" r="${SIZE*.37}" fill="none" stroke="rgba(155,89,182,0.18)" stroke-width="1"/>
  ${innerTicks}
  <path d="${arc(R,S,E)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${W}" stroke-linecap="round"/>
  ${smoothArc(R,W,S,E,40)}
  ${tickMarks(R,W,S,E,10,5)}
  <polygon points="${nTip.x},${nTip.y} ${nb1.x},${nb1.y} ${nb2.x},${nb2.y}" fill="white" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="24" fill="url(#hub)" stroke="#9b59b6" stroke-width="2"/>
  <text x="${cx}" y="${cy-4}" font-family="'Yu Gothic','MS Gothic',serif" font-size="18"
    fill="#00d4ff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">族</text>
  <text x="${cx}" y="${cy+12}" font-family="Arial" font-size="11" font-weight="bold"
    fill="rgba(255,255,255,0.6)" text-anchor="middle" letter-spacing="1">ZOKU</text>
</svg>`;
};

async function generate() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });

  const variants = [
    [v1,  'zoku-01-watermark'],
    [v2,  'zoku-02-cyan-hub'],
    [v3,  'zoku-03-top-label'],
    [v4,  'zoku-04-dual-arc'],
    [v5,  'zoku-05-minimal'],
    [v6,  'zoku-06-hexagon'],
    [v7,  'zoku-07-triple-ring'],
    [v8,  'zoku-08-warm'],
    [v9,  'zoku-09-large-kanji'],
    [v10, 'zoku-10-inner-ticks'],
  ];

  for (const [fn, name] of variants) {
    const png = await sharp(Buffer.from(fn()), { density: 300 }).png().toBuffer();
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, png);
    console.log(`${name}`);
  }
  console.log('\nDone — all in build/');
}

generate().catch(err => { console.error(err.message); process.exit(1); });
