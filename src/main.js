import scrollama from 'scrollama';
import { loadGeoData } from './data/loadGeo.js';
import { setupProjection, getPathGenerator } from './geo/projection.js';
import { renderHeroMap, preRenderAllYears, getCachedYear } from './render/heroMap.js';
import { LAYOUT, YEARS, COLORS } from './config.js';
import { getStats, getGrowthStats, ratioScale, inkColorScale } from './data/dataUtils.js';

let matched = null;
let geoData = null;
let geo = null;
let cbsData = null;

// Scrolly canvas
let heroCanvas, heroCtx;
// Explore canvas
let exploreCanvas, exploreCtx;
let currentExploreYear = 2022;

// Highlight state
const TOP_GROWTH = ['Carnisse', 'Tarwewijk', 'Oud Charlois', 'Spangen', 'Hillesluis'];
const BOTTOM_GROWTH = ['Kralingen Oost', 'Stadsdriehoek', 'Cool'];
const CONTRAST_WARM = ['Molenlaankwartier', 'Zestienhoven', 'Nieuwe Werk', 'Hillegersberg Zuid'];
const CONTRAST_COOL = ['Carnisse', 'Tarwewijk', 'Hillesluis', 'Bloemhof', 'Spangen'];

async function init() {
  const result = await loadGeoData();
  matched = result.matched;
  geoData = result.data;
  geo = result.geo;

  // Load CBS joined data
  const cbsResp = await fetch('/data/cbs-zzp-joined.json');
  cbsData = await cbsResp.json();

  setupProjection(result.geo);

  // Setup scrolly canvas
  heroCanvas = document.getElementById('hero-canvas');
  heroCanvas.width = LAYOUT.heroWidth;
  heroCanvas.height = LAYOUT.heroHeight;
  heroCtx = heroCanvas.getContext('2d');

  // Initial render
  renderHeroMap(heroCtx, matched, 2009, geo);

  // Pre-render all years
  preRenderAllYears(matched, YEARS, geo);

  // Setup scrollama
  setupScrollama();

  // Setup explore section
  setupExplore();

  document.body.classList.add('loaded');
}

// ===== SCROLLAMA =====

function setupScrollama() {
  const scroller = scrollama();

  scroller
    .setup({
      step: '.step',
      offset: 0.5,
      progress: true,
      debug: false,
    })
    .onStepEnter(handleStepEnter)
    .onStepProgress(handleStepProgress);
}

// Scroll-controlled year scrubbing for Act 1
function handleStepProgress({ element, progress }) {
  const act = element.dataset.act;
  const step = element.dataset.step;

  if (act === '1' && step === 'scrub') {
    // Map scroll progress (0-1) to year index (0 = 2009, 9 = 2022)
    const yearIndex = Math.min(YEARS.length - 1, Math.floor(progress * YEARS.length));
    const year = YEARS[yearIndex];
    drawScrollyYear(year);
  }
}

function handleStepEnter({ element }) {
  const act = element.dataset.act;
  const step = element.dataset.step;

  // Mark active step
  document.querySelectorAll('.step').forEach(s => s.classList.remove('is-active'));
  element.classList.add('is-active');

  const overlay = document.getElementById('year-overlay');
  const annotation = document.getElementById('map-annotation');

  if (act === '1') {
    resetMapTransform();
    annotation.textContent = '';
    if (step === 'intro') {
      drawScrollyYear(2009);
      overlay.textContent = '2009';
    } else if (step === 'scrub') {
      // Year is controlled by handleStepProgress, start at 2009
      drawScrollyYear(2009);
    } else if (step === '2022') {
      // Show 2022 and highlight top buurten
      drawScrollyYear(2022);
      overlay.textContent = '2022';
      highlightNeighbourhoods(['Molenlaankwartier', 'Terbregge', 'Hillegersberg Zuid'], '#5A6B7A');
      annotation.textContent = 'Buurten met het hoogste ZZP-aandeel (2022)';
    } else if (step === 'transition') {
      drawScrollyYear(2022);
      overlay.textContent = '2022';
    }
  }

  else if (act === '2') {
    overlay.textContent = '2022';
    if (step === 'reveal') {
      resetMapTransform();
      drawScrollyYear(2022);
      highlightNeighbourhoods(TOP_GROWTH, '#8B1A1A');
      annotation.textContent = 'Gemarkeerd: buurten met de sterkste ZZP-groei';
    } else if (step === 'top5') {
      // Zoom into Rotterdam-Zuid where the top growth buurten are
      zoomToSouth();
      drawScrollyYear(2022);
      highlightNeighbourhoods(TOP_GROWTH, '#8B1A1A');
      annotation.textContent = 'Gemarkeerd: buurten met de sterkste ZZP-groei';
    } else if (step === 'bottom') {
      resetMapTransform();
      drawScrollyYear(2022);
      highlightNeighbourhoods(BOTTOM_GROWTH, '#5A6B7A');
      annotation.textContent = 'Gemarkeerd: buurten met de minste ZZP-groei';
    }
  }

  else if (act === '3') {
    resetMapTransform();
    overlay.textContent = '2022';
    annotation.textContent = '';
    if (step === 'setup') {
      // Still the normal 2022 map — the question is posed, no visual change yet
      drawScrollyYear(2022);
    } else if (step === 'recolor') {
      // NOW the income overlay appears — reader just read what the colors mean
      drawIncomeMap();
      annotation.textContent = 'Inkleuring: gemiddeld inkomen per buurt (CBS 2022)';
    } else if (step === 'contrast') {
      drawIncomeMap();
      highlightNeighbourhoods(['Molenlaankwartier', 'Hillesluis'], null);
      annotation.textContent = '€74.600 vs €30.600 gemiddeld inkomen';
    } else if (step === 'scatter') {
      drawIncomeMap();
      annotation.textContent = 'Correlatie ZZP-aandeel vs inkomen: r = 0,70';
    }
  }

  else if (act === '4') {
    resetMapTransform();
    overlay.textContent = '2022';
    if (step === 'katendrecht') {
      drawScrollyYear(2022);
      highlightNeighbourhoods(['Katendrecht'], '#C0392B');
      annotation.textContent = 'Katendrecht: +5,4pp groei, €50.500 inkomen, WOZ €448.000';
    } else if (step === 'bridge') {
      drawIncomeMap();
      highlightNeighbourhoods(['Katendrecht'], '#C0392B');
      annotation.textContent = '';
    }
  }

  else if (act === '5') {
    annotation.textContent = '';
    if (step === 'stats') {
      drawIncomeMap();
      overlay.textContent = '';
      annotation.textContent = 'Lage-inkomensbuurten: +4,5pp — Hoge-inkomensbuurten: +3,4pp';
    } else if (step === 'future' || step === 'end') {
      drawScrollyYear(2022);
      overlay.textContent = '2022';
      annotation.textContent = '';
    }
  }
}

// ===== DRAWING FUNCTIONS =====

function drawScrollyYear(year) {
  const cached = getCachedYear(year);
  heroCtx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);
  if (cached) {
    heroCtx.drawImage(cached, 0, 0);
  } else {
    renderHeroMap(heroCtx, matched, year, geo);
  }
  document.getElementById('year-overlay').textContent = year;
}

// ===== MAP ZOOM / TRANSFORM =====

function zoomToSouth() {
  // Zoom the canvas to focus on Rotterdam-Zuid (lower portion of the map)
  const canvas = heroCanvas;
  canvas.style.transition = 'transform 0.6s ease';
  canvas.style.transformOrigin = '40% 75%'; // focus on south-west area
  canvas.style.transform = 'scale(1.8)';
}

function resetMapTransform() {
  const canvas = heroCanvas;
  canvas.style.transition = 'transform 0.6s ease';
  canvas.style.transform = 'scale(1)';
}

function highlightNeighbourhoods(names, color) {
  const pathGen = getPathGenerator();
  const nameSet = new Set(names.map(n => n.toLowerCase()));

  heroCtx.save();
  // Dim everything first
  heroCtx.fillStyle = 'rgba(245, 240, 232, 0.55)';
  heroCtx.fillRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);

  // Redraw highlighted neighbourhoods on top
  for (const { feature, data } of matched) {
    if (!nameSet.has(data.name.toLowerCase())) continue;
    const geoPath = pathGen(feature);
    if (!geoPath) continue;
    const path = new Path2D(geoPath);

    // Clip to this neighbourhood and redraw from cache
    heroCtx.save();
    heroCtx.clip(path);
    const cached = getCachedYear(parseInt(document.getElementById('year-overlay').textContent) || 2022);
    if (cached) heroCtx.drawImage(cached, 0, 0);
    heroCtx.restore();

    // Add colored border
    if (color) {
      heroCtx.save();
      heroCtx.strokeStyle = color;
      heroCtx.lineWidth = 2.5;
      heroCtx.globalAlpha = 0.8;
      heroCtx.stroke(path);
      heroCtx.restore();
    }
  }
  heroCtx.restore();
}

function drawIncomeMap() {
  // Redraw the map but with income-based coloring
  const pathGen = getPathGenerator();
  const { heroWidth, heroHeight } = LAYOUT;

  // Start from the paper texture (cached 2022 as base)
  const cached = getCachedYear(2022);
  heroCtx.clearRect(0, 0, heroWidth, heroHeight);
  if (cached) heroCtx.drawImage(cached, 0, 0);

  // Overlay income-based coloring
  if (!cbsData) return;
  const medianIncome = cbsData.meta.medianIncome;

  for (const { feature, data } of matched) {
    const geoPath = pathGen(feature);
    if (!geoPath) continue;
    const path = new Path2D(geoPath);

    // Find CBS data for this neighbourhood
    const cbsEntry = cbsData.joined.find(j =>
      j.naam.toLowerCase() === data.name.toLowerCase()
    );
    if (!cbsEntry || !cbsEntry.inkomenPerOntvanger) continue;

    const income = cbsEntry.inkomenPerOntvanger;
    const isHigh = income >= medianIncome;

    heroCtx.save();
    heroCtx.globalAlpha = 0.2;
    heroCtx.fillStyle = isHigh ? '#8B1A1A' : '#2C3E50';
    heroCtx.fill(path);
    heroCtx.restore();
  }

  document.getElementById('year-overlay').textContent = '2022';
}

// ===== EXPLORE SECTION =====

function setupExplore() {
  exploreCanvas = document.getElementById('explore-canvas');
  if (!exploreCanvas) return;
  exploreCanvas.width = LAYOUT.heroWidth;
  exploreCanvas.height = LAYOUT.heroHeight;
  exploreCtx = exploreCanvas.getContext('2d');

  // Draw 2022
  drawExploreYear(2022);

  // Year buttons
  const container = document.getElementById('year-selector');
  for (const year of YEARS) {
    const btn = document.createElement('button');
    btn.className = `year-btn ${year === 2022 ? 'active' : ''}`;
    btn.textContent = year;
    btn.addEventListener('click', () => {
      currentExploreYear = year;
      drawExploreYear(year);
      document.querySelectorAll('.year-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.textContent) === year)
      );
      updateStatsDisplay();
      updateLockedTooltip();
    });
    container.appendChild(btn);
  }

  updateStatsDisplay();
  setupHover();
}

function drawExploreYear(year) {
  const cached = getCachedYear(year);
  exploreCtx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);
  if (cached) {
    exploreCtx.drawImage(cached, 0, 0);
  } else {
    renderHeroMap(exploreCtx, matched, year, geo);
  }
  const overlay = document.getElementById('explore-year-overlay');
  if (overlay) overlay.textContent = year;
}

// ===== HOVER + TOOLTIP (explore section) =====

let lockedNeighbourhood = null;

function buildTooltipHTML(data, isLocked) {
  const stats = getStats(data, currentExploreYear);
  const growth = getGrowthStats(data, currentExploreYear);

  const vals = YEARS.map(y => {
    const d = data.years[y];
    if (!d || d.zzp == null || d.geen == null) return 0;
    return d.zzp / (d.zzp + d.geen);
  });
  const maxVal = Math.max(...vals, 0.01);
  const sparkW = 140, sparkH = 28;
  let sparkPath = '';
  let currentDot = '';
  const currentIdx = YEARS.indexOf(currentExploreYear);
  for (let i = 0; i < vals.length; i++) {
    const sx = (i / (vals.length - 1)) * sparkW;
    const sy = sparkH - (vals[i] / maxVal) * sparkH;
    sparkPath += i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
    if (i === currentIdx) {
      currentDot = `<circle cx="${sx}" cy="${sy}" r="3" fill="#C0392B" />`;
    }
  }

  let growthHTML = '';
  if (growth && currentExploreYear !== growth.earliestYear) {
    const sign = growth.ppChange >= 0 ? '+' : '';
    const color = growth.ppChange >= 0 ? '#8B1A1A' : '#2C3E50';
    const relSign = growth.relativeGrowth >= 0 ? '+' : '';
    growthHTML = `
      <div class="tt-growth">
        <span class="tt-growth-label">Sinds ${growth.earliestYear}:</span>
        <span class="tt-growth-value" style="color:${color}">${sign}${growth.ppChange.toFixed(1)}pp</span>
        <span class="tt-growth-rel" style="color:${color}">(${relSign}${growth.relativeGrowth.toFixed(0)}% relatief)</span>
      </div>
    `;
  }

  // Add CBS income if available
  let incomeHTML = '';
  if (cbsData) {
    const cbsEntry = cbsData.joined.find(j => j.naam.toLowerCase() === data.name.toLowerCase());
    if (cbsEntry && cbsEntry.inkomenPerOntvanger) {
      incomeHTML = `<div class="tt-total">Gem. inkomen: €${cbsEntry.inkomenPerOntvanger.toLocaleString('nl-NL')}${cbsEntry.wozGemiddeld ? ' · WOZ: €' + cbsEntry.wozGemiddeld.toLocaleString('nl-NL') : ''}</div>`;
    }
  }

  return `
    ${isLocked ? '<div class="tt-close" title="Sluiten">✕</div>' : ''}
    <div class="tt-name">${data.name}</div>
    <div class="tt-year">${currentExploreYear}</div>
    <div class="tt-stats">
      <span class="tt-zzp">${stats.zzp.toLocaleString('nl-NL')} ZZP-ers</span>
      <span class="tt-ratio">(${(stats.ratio * 100).toFixed(1)}%)</span>
    </div>
    <div class="tt-total">${stats.total.toLocaleString('nl-NL')} totaal</div>
    ${incomeHTML}
    ${growthHTML}
    <div class="tt-sparkline">
      <svg width="${sparkW}" height="${sparkH}">
        <path d="${sparkPath}" fill="none" stroke="#8B1A1A" stroke-width="1.5" opacity="0.6"/>
        ${currentDot}
      </svg>
      <div class="tt-spark-labels"><span>2009</span><span>2022</span></div>
      <div class="tt-spark-caption">ZZP-er % over de tijd</div>
    </div>
  `;
}

function setupHover() {
  if (!exploreCanvas) return;
  const tooltip = document.getElementById('tooltip');
  const pathGen = getPathGenerator();
  const hitPaths = matched.map(({ feature, data }) => {
    const geoPath = pathGen(feature);
    return { path: geoPath ? new Path2D(geoPath) : null, data };
  });
  const hitCanvas = new OffscreenCanvas(LAYOUT.heroWidth, LAYOUT.heroHeight);
  const hitCtx = hitCanvas.getContext('2d');

  function hitTest(clientX, clientY) {
    const rect = exploreCanvas.getBoundingClientRect();
    const scaleX = LAYOUT.heroWidth / rect.width;
    const scaleY = LAYOUT.heroHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    for (const { path, data } of hitPaths) {
      if (!path) continue;
      if (hitCtx.isPointInPath(path, x, y)) return data;
    }
    return null;
  }

  function showTooltip(data, posX, posY) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${posX + 16}px`;
    tooltip.style.top = `${posY - 10}px`;
    tooltip.innerHTML = buildTooltipHTML(data, !!lockedNeighbourhood);
    const tr = tooltip.getBoundingClientRect();
    if (tr.right > window.innerWidth - 10) tooltip.style.left = `${posX - tr.width - 16}px`;
    if (tr.bottom > window.innerHeight - 10) tooltip.style.top = `${posY - tr.height - 10}px`;
    if (lockedNeighbourhood) wireCloseButton();
  }

  function wireCloseButton() {
    const closeBtn = tooltip.querySelector('.tt-close');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); unlock(); });
  }

  function unlock() {
    lockedNeighbourhood = null;
    tooltip.style.display = 'none';
    tooltip.classList.remove('locked');
  }

  exploreCanvas.addEventListener('mousemove', (e) => {
    if (lockedNeighbourhood) return;
    const data = hitTest(e.clientX, e.clientY);
    if (data) {
      showTooltip(data, e.clientX, e.clientY);
      exploreCanvas.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      exploreCanvas.style.cursor = 'default';
    }
  });

  exploreCanvas.addEventListener('click', (e) => {
    const data = hitTest(e.clientX, e.clientY);
    if (lockedNeighbourhood) {
      if (data && data.id === lockedNeighbourhood.data.id) { unlock(); }
      else if (data) {
        lockedNeighbourhood = { data, x: e.clientX, y: e.clientY };
        tooltip.classList.add('locked');
        showTooltip(data, e.clientX, e.clientY);
      } else { unlock(); }
    } else if (data) {
      lockedNeighbourhood = { data, x: e.clientX, y: e.clientY };
      tooltip.classList.add('locked');
      showTooltip(data, e.clientX, e.clientY);
    }
  });

  exploreCanvas.addEventListener('mouseleave', () => {
    if (!lockedNeighbourhood) tooltip.style.display = 'none';
  });
}

function updateLockedTooltip() {
  if (!lockedNeighbourhood) return;
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = buildTooltipHTML(lockedNeighbourhood.data, true);
  const closeBtn = tooltip.querySelector('.tt-close');
  if (closeBtn) closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    lockedNeighbourhood = null;
    tooltip.style.display = 'none';
    tooltip.classList.remove('locked');
  });
}

function updateStatsDisplay() {
  const el = document.getElementById('stats-display');
  if (!el || !geoData) return;
  const totals = geoData.totals[currentExploreYear];
  if (!totals) return;
  const total = totals.zzp + totals.geen;
  const pct = ((totals.zzp / total) * 100).toFixed(1);
  el.innerHTML = `<strong>${totals.zzp.toLocaleString('nl-NL')}</strong> ZZP-ers in Rotterdam — ${pct}% van de beroepsbevolking`;
}

init().catch(console.error);
