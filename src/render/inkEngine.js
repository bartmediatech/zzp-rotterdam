import { INK } from '../config.js';
import { createRandom, gaussian } from '../utils/random.js';
import { getRatio, ratioScale, inkColorScale, densityScale } from '../data/dataUtils.js';

// Scatter random points inside a GeoJSON polygon using rejection sampling
function scatterPointsInPolygon(feature, count, rng, pathGen) {
  const points = [];
  const bounds = pathGen.bounds(feature);
  const [x0, y0] = bounds[0];
  const [x1, y1] = bounds[1];
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 1 || h < 1) return points;

  const testCanvas = new OffscreenCanvas(Math.ceil(w) + 2, Math.ceil(h) + 2);
  const testCtx = testCanvas.getContext('2d');
  const testPath = new Path2D();

  const geoPath = pathGen(feature);
  if (!geoPath) return points;
  testPath.addPath(new Path2D(geoPath), new DOMMatrix().translate(-x0, -y0));

  let attempts = 0;
  const maxAttempts = count * 20;

  while (points.length < count && attempts < maxAttempts) {
    const x = x0 + rng() * w;
    const y = y0 + rng() * h;
    if (testCtx.isPointInPath(testPath, x - x0, y - y0)) {
      points.push([x, y]);
    }
    attempts++;
  }

  return points;
}

// Draw an ink spot — a soft, organic circular mark
function drawInkSpot(ctx, x, y, color, intensity, rng) {
  const baseRadius = INK.spotRadiusMin + intensity * (INK.spotRadiusMax - INK.spotRadiusMin);
  const radius = baseRadius * (0.6 + rng() * 0.8);
  const alpha = INK.spotAlphaMin + intensity * (INK.spotAlphaMax - INK.spotAlphaMin);

  ctx.save();

  // Main spot — soft radial gradient
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.globalAlpha = alpha * (0.5 + rng() * 0.5);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Irregular edge — a few smaller satellite dots for organic feel
  if (rng() > 0.5) {
    const satellites = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < satellites; s++) {
      const angle = rng() * Math.PI * 2;
      const dist = radius * (0.6 + rng() * 0.6);
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;
      const sr = radius * (0.15 + rng() * 0.25);
      ctx.globalAlpha = alpha * (0.2 + rng() * 0.3);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// Draw neighbourhood boundary
function drawBoundary(ctx, feature, pathGen) {
  const geoPath = pathGen(feature);
  if (!geoPath) return;

  ctx.save();
  ctx.globalAlpha = INK.borderAlpha;
  ctx.strokeStyle = INK.borderColor;
  ctx.lineWidth = INK.borderWidth;
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(geoPath));
  ctx.restore();
}

// Draw ink wash (translucent fill for the neighbourhood polygon)
function drawWash(ctx, feature, color, intensity, pathGen) {
  const alpha = INK.washAlphaMin + intensity * (INK.washAlphaMax - INK.washAlphaMin);
  if (alpha < 0.003) return;

  const geoPath = pathGen(feature);
  if (!geoPath) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(geoPath));
  ctx.restore();
}

// Render all ink for a single neighbourhood at a given year
export function renderNeighbourhoodInk(ctx, feature, neighbourhoodData, year, pathGen) {
  const ratio = getRatio(neighbourhoodData, year);
  if (ratio == null) return;

  const stats = neighbourhoodData.years[year];
  const zzpCount = stats.zzp;
  const intensity = ratioScale(ratio); // 0-1
  const color = inkColorScale(intensity);
  const spotCount = Math.floor(densityScale(zzpCount));

  const seed = hashString(neighbourhoodData.id + year);
  const rng = createRandom(seed);

  // 1. Light wash fill (if enabled)
  drawWash(ctx, feature, color, intensity, pathGen);

  // 2. Ink spots inside the polygon
  const geoPath = pathGen(feature);
  if (!geoPath) return;
  const clipPath = new Path2D(geoPath);

  ctx.save();
  ctx.clip(clipPath);

  const points = scatterPointsInPolygon(feature, spotCount, rng, pathGen);
  for (const [x, y] of points) {
    drawInkSpot(ctx, x, y, color, intensity, rng);
  }

  ctx.restore();
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
