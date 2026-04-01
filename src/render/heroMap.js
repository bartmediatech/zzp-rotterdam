import { LAYOUT, INK } from '../config.js';
import { renderPaper } from './paperTexture.js';
import { renderRiver } from '../geo/river.js';
import { renderNeighbourhoodInk } from './inkEngine.js';
import { getPathGenerator } from '../geo/projection.js';

const yearCache = new Map();

function drawMapBorders(ctx, geo, pathGen) {
  if (!geo || !geo.features) return;

  ctx.save();
  ctx.strokeStyle = INK.borderColor;
  ctx.lineWidth = INK.borderWidth;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = INK.borderAlpha;

  for (const feature of geo.features) {
    const geoPath = pathGen(feature);
    if (!geoPath) continue;
    ctx.stroke(new Path2D(geoPath));
  }
  ctx.restore();
}

export function renderHeroMap(ctx, matched, year, geo, options = {}) {
  const { useCache = true } = options;
  const { heroWidth, heroHeight } = LAYOUT;

  if (useCache && yearCache.has(year)) {
    ctx.drawImage(yearCache.get(year), 0, 0);
    return;
  }

  const pathGen = getPathGenerator();
  const offscreen = new OffscreenCanvas(heroWidth, heroHeight);
  const offCtx = offscreen.getContext('2d');

  // 1. Paper texture
  renderPaper(offCtx, heroWidth, heroHeight);

  // 2. Map borders (under ink)
  drawMapBorders(offCtx, geo, pathGen);

  // 3. Ink spots per neighbourhood
  for (const { feature, data } of matched) {
    renderNeighbourhoodInk(offCtx, feature, data, year, pathGen);
  }

  // 4. River on top
  renderRiver(offCtx);

  // 5. Borders again on top (thin, so ink doesn't fully obscure them)
  drawMapBorders(offCtx, geo, pathGen);

  yearCache.set(year, offscreen);
  ctx.drawImage(offscreen, 0, 0);
}

export function preRenderAllYears(matched, years, geo) {
  const { heroWidth, heroHeight } = LAYOUT;
  const pathGen = getPathGenerator();

  for (const year of years) {
    if (yearCache.has(year)) continue;

    const offscreen = new OffscreenCanvas(heroWidth, heroHeight);
    const offCtx = offscreen.getContext('2d');

    renderPaper(offCtx, heroWidth, heroHeight);
    drawMapBorders(offCtx, geo, pathGen);

    for (const { feature, data } of matched) {
      renderNeighbourhoodInk(offCtx, feature, data, year, pathGen);
    }

    renderRiver(offCtx);
    drawMapBorders(offCtx, geo, pathGen);
    yearCache.set(year, offscreen);
  }
}

export function getCachedYear(year) {
  return yearCache.get(year);
}
