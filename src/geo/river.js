import { COLORS } from '../config.js';
import { project } from './projection.js';
import { createRandom } from '../utils/random.js';

// Nieuwe Maas through center Rotterdam (only visible portion, lon >= 4.44)
// Control points as [lon, lat, width] — width is relative river width at that point
const MAAS_CONTROL_POINTS = [
  [4.440, 51.905, 1.0],   // west entry (Delfshaven area)
  [4.455, 51.907, 0.95],  // Schiemond
  [4.470, 51.910, 0.90],  // Katendrecht west
  [4.482, 51.912, 0.85],  // Kop van Zuid
  [4.495, 51.914, 0.85],  // Noordereiland west
  [4.505, 51.916, 0.80],  // Noordereiland center
  [4.515, 51.914, 0.80],  // Noordereiland east
  [4.530, 51.910, 0.75],  // Feijenoord
  [4.550, 51.906, 0.70],  // bend south
  [4.570, 51.903, 0.65],  // De Esch
  [4.590, 51.901, 0.60],  // IJsselmonde east
  [4.610, 51.900, 0.55],  // east exit
];

const BASE_RIVER_WIDTH = 14; // pixels at widest

export function renderRiver(ctx) {
  const rng = createRandom(42);

  // Project all points
  const pts = MAAS_CONTROL_POINTS
    .map(([lon, lat, w]) => {
      const p = project([lon, lat]);
      return p ? { x: p[0], y: p[1], w: w * BASE_RIVER_WIDTH } : null;
    })
    .filter(Boolean);

  if (pts.length < 3) return;

  // Compute smooth top and bottom bank points with perpendicular offsets
  const topBank = [];
  const botBank = [];

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const curr = pts[i];
    const next = pts[Math.min(pts.length - 1, i + 1)];

    // Tangent direction (averaged from prev→curr and curr→next)
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular (normal)
    const nx = -dy / len;
    const ny = dx / len;

    const halfW = curr.w / 2;
    topBank.push({ x: curr.x + nx * halfW, y: curr.y + ny * halfW });
    botBank.push({ x: curr.x - nx * halfW, y: curr.y - ny * halfW });
  }

  ctx.save();

  // 1. River body — smooth filled shape
  ctx.beginPath();

  // Top bank: smooth cubic through points
  ctx.moveTo(topBank[0].x, topBank[0].y);
  for (let i = 1; i < topBank.length; i++) {
    const p0 = topBank[i - 1];
    const p1 = topBank[i];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }
  const lastTop = topBank[topBank.length - 1];
  ctx.lineTo(lastTop.x, lastTop.y);

  // Bottom bank (reverse): smooth cubic
  const lastBot = botBank[botBank.length - 1];
  ctx.lineTo(lastBot.x, lastBot.y);
  for (let i = botBank.length - 2; i >= 0; i--) {
    const p0 = botBank[i + 1];
    const p1 = botBank[i];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }

  ctx.closePath();

  // Soft blue-grey wash fill
  ctx.fillStyle = COLORS.riverFill;
  ctx.globalAlpha = 0.5;
  ctx.fill();

  // 2. Subtle second wash layer for depth
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = COLORS.riverEdge;
  ctx.fill();

  // 3. Bank edges — thin, slightly wobbly calligraphic lines
  for (const bank of [topBank, botBank]) {
    ctx.beginPath();
    ctx.moveTo(bank[0].x, bank[0].y);
    for (let i = 1; i < bank.length; i++) {
      const p0 = bank[i - 1];
      const p1 = bank[i];
      const wobbleX = (rng() - 0.5) * 1.0;
      const wobbleY = (rng() - 0.5) * 1.0;
      const mx = (p0.x + p1.x) / 2 + wobbleX;
      const my = (p0.y + p1.y) / 2 + wobbleY;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    const last = bank[bank.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = COLORS.riverEdge;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
  }

  ctx.restore();
}
