// Standalone interactive map — no scrollytelling, just explore mode
import { loadGeoData } from './data/loadGeo.js';
import { setupProjection, getPathGenerator } from './geo/projection.js';
import { renderHeroMap, preRenderAllYears, getCachedYear } from './render/heroMap.js';
import { LAYOUT, YEARS } from './config.js';
import { getStats, getGrowthStats } from './data/dataUtils.js';

let matched, geoData, geo, cbsData;
let canvas, ctx;
let currentYear = 2022;
let lockedNeighbourhood = null;

async function init() {
  const result = await loadGeoData();
  matched = result.matched;
  geoData = result.data;
  geo = result.geo;

  const cbsResp = await fetch('/data/cbs-zzp-joined.json');
  cbsData = await cbsResp.json();

  setupProjection(result.geo);

  canvas = document.getElementById('explore-canvas');
  canvas.width = LAYOUT.heroWidth;
  canvas.height = LAYOUT.heroHeight;
  ctx = canvas.getContext('2d');

  renderHeroMap(ctx, matched, currentYear, geo);
  preRenderAllYears(matched, YEARS, geo);

  setupYearSelector();
  updateStats();
  setupHover();
}

function drawYear(year) {
  ctx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);
  const cached = getCachedYear(year);
  if (cached) ctx.drawImage(cached, 0, 0);
  else renderHeroMap(ctx, matched, year, geo);
  document.getElementById('explore-year-overlay').textContent = year;
}

function setupYearSelector() {
  const container = document.getElementById('year-selector');
  for (const year of YEARS) {
    const btn = document.createElement('button');
    btn.className = `year-btn ${year === currentYear ? 'active' : ''}`;
    btn.textContent = year;
    btn.addEventListener('click', () => {
      currentYear = year;
      drawYear(year);
      document.querySelectorAll('.year-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.textContent) === year));
      updateStats();
      updateLockedTooltip();
    });
    container.appendChild(btn);
  }
}

function updateStats() {
  const el = document.getElementById('stats-display');
  if (!el || !geoData) return;
  const totals = geoData.totals[currentYear];
  if (!totals) return;
  const total = totals.zzp + totals.geen;
  const pct = ((totals.zzp / total) * 100).toFixed(1);
  el.innerHTML = `<strong>${totals.zzp.toLocaleString('nl-NL')}</strong> ZZP-ers in Rotterdam — ${pct}%`;
}

function buildTooltipHTML(data, isLocked) {
  const stats = getStats(data, currentYear);
  const growth = getGrowthStats(data, currentYear);
  const vals = YEARS.map(y => { const d = data.years[y]; return (!d || d.zzp == null || d.geen == null) ? 0 : d.zzp / (d.zzp + d.geen); });
  const maxVal = Math.max(...vals, 0.01);
  const sparkW = 140, sparkH = 28;
  let sparkPath = '', currentDot = '';
  const ci = YEARS.indexOf(currentYear);
  for (let i = 0; i < vals.length; i++) {
    const sx = (i / (vals.length - 1)) * sparkW, sy = sparkH - (vals[i] / maxVal) * sparkH;
    sparkPath += i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
    if (i === ci) currentDot = `<circle cx="${sx}" cy="${sy}" r="3" fill="#C0392B" />`;
  }
  let growthHTML = '';
  if (growth && currentYear !== growth.earliestYear) {
    const sign = growth.ppChange >= 0 ? '+' : '';
    const color = growth.ppChange >= 0 ? '#8B1A1A' : '#2C3E50';
    growthHTML = `<div class="tt-growth"><span class="tt-growth-label">Sinds ${growth.earliestYear}:</span> <span class="tt-growth-value" style="color:${color}">${sign}${growth.ppChange.toFixed(1)}pp</span> <span class="tt-growth-rel" style="color:${color}">(${sign}${growth.relativeGrowth.toFixed(0)}% relatief)</span></div>`;
  }
  let incomeHTML = '';
  if (cbsData) {
    const e = cbsData.joined.find(j => j.naam.toLowerCase() === data.name.toLowerCase());
    if (e?.inkomenPerOntvanger) incomeHTML = `<div class="tt-total">Gem. inkomen: €${e.inkomenPerOntvanger.toLocaleString('nl-NL')}${e.wozGemiddeld ? ' · WOZ: €' + e.wozGemiddeld.toLocaleString('nl-NL') : ''}</div>`;
  }
  return `${isLocked ? '<div class="tt-close" title="Sluiten">✕</div>' : ''}<div class="tt-name">${data.name}</div><div class="tt-year">${currentYear}</div><div class="tt-stats"><span class="tt-zzp">${stats.zzp.toLocaleString('nl-NL')} ZZP-ers</span> <span class="tt-ratio">(${(stats.ratio * 100).toFixed(1)}%)</span></div><div class="tt-total">${stats.total.toLocaleString('nl-NL')} totaal</div>${incomeHTML}${growthHTML}<div class="tt-sparkline"><svg width="${sparkW}" height="${sparkH}"><path d="${sparkPath}" fill="none" stroke="#8B1A1A" stroke-width="1.5" opacity="0.6"/>${currentDot}</svg><div class="tt-spark-labels"><span>2009</span><span>2022</span></div></div>`;
}

function setupHover() {
  const tooltip = document.getElementById('tooltip');
  const pathGen = getPathGenerator();
  const hitPaths = matched.map(({ feature, data }) => ({ path: pathGen(feature) ? new Path2D(pathGen(feature)) : null, data }));
  const hitCanvas = new OffscreenCanvas(LAYOUT.heroWidth, LAYOUT.heroHeight);
  const hitCtx = hitCanvas.getContext('2d');

  function hitTest(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left) * (LAYOUT.heroWidth / rect.width);
    const y = (cy - rect.top) * (LAYOUT.heroHeight / rect.height);
    for (const { path, data } of hitPaths) { if (path && hitCtx.isPointInPath(path, x, y)) return data; }
    return null;
  }

  function show(data, px, py) {
    tooltip.style.display = 'block'; tooltip.style.left = `${px+16}px`; tooltip.style.top = `${py-10}px`;
    tooltip.innerHTML = buildTooltipHTML(data, !!lockedNeighbourhood);
    const r = tooltip.getBoundingClientRect();
    if (r.right > window.innerWidth - 10) tooltip.style.left = `${px - r.width - 16}px`;
    if (r.bottom > window.innerHeight - 10) tooltip.style.top = `${py - r.height - 10}px`;
    if (lockedNeighbourhood) { const c = tooltip.querySelector('.tt-close'); if (c) c.addEventListener('click', e => { e.stopPropagation(); unlock(); }); }
  }

  function unlock() { lockedNeighbourhood = null; tooltip.style.display = 'none'; tooltip.classList.remove('locked'); }

  canvas.addEventListener('mousemove', e => { if (lockedNeighbourhood) return; const d = hitTest(e.clientX, e.clientY); if (d) { show(d, e.clientX, e.clientY); canvas.style.cursor = 'pointer'; } else { tooltip.style.display = 'none'; canvas.style.cursor = 'default'; } });
  canvas.addEventListener('click', e => { const d = hitTest(e.clientX, e.clientY); if (lockedNeighbourhood) { if (d?.id === lockedNeighbourhood.data.id) unlock(); else if (d) { lockedNeighbourhood = { data: d }; tooltip.classList.add('locked'); show(d, e.clientX, e.clientY); } else unlock(); } else if (d) { lockedNeighbourhood = { data: d }; tooltip.classList.add('locked'); show(d, e.clientX, e.clientY); } });
  canvas.addEventListener('mouseleave', () => { if (!lockedNeighbourhood) tooltip.style.display = 'none'; });
}

function updateLockedTooltip() {
  if (!lockedNeighbourhood) return;
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = buildTooltipHTML(lockedNeighbourhood.data, true);
  const c = tooltip.querySelector('.tt-close'); if (c) c.addEventListener('click', e => { e.stopPropagation(); lockedNeighbourhood = null; tooltip.style.display = 'none'; tooltip.classList.remove('locked'); });
}

init().catch(console.error);
