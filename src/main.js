import { loadGeoData } from './data/loadGeo.js';
import { setupProjection } from './geo/projection.js';
import { renderHeroMap, preRenderAllYears, getCachedYear } from './render/heroMap.js';
import { LAYOUT, YEARS, COLORS } from './config.js';
import { getStats, getGrowthStats } from './data/dataUtils.js';
import { getPathGenerator } from './geo/projection.js';

let matched = null;
let geoData = null;
let geo = null;
let currentYear = 2009;
let currentYearIndex = 0;
let heroCanvas, heroCtx;

// Animation state
let isPlaying = true;
let holdTimer = 0;
const HOLD_DURATION = 2500;  // ms to show each year
const FADE_DURATION = 400;   // ms for cross-fade
const END_PAUSE = 3000;      // ms to pause at end before looping
let fadeProgress = 0;
let isFading = false;
let lastTimestamp = 0;

async function init() {
  const result = await loadGeoData();
  matched = result.matched;
  geoData = result.data;
  geo = result.geo;

  setupProjection(result.geo);

  heroCanvas = document.getElementById('hero-canvas');
  heroCanvas.width = LAYOUT.heroWidth;
  heroCanvas.height = LAYOUT.heroHeight;
  heroCtx = heroCanvas.getContext('2d');

  // Render first year
  renderHeroMap(heroCtx, matched, currentYear, geo);
  updateStatsDisplay();

  setupYearSelector();
  setupSmallMultiples();
  setupHover();
  setupPlayPause();

  // Pre-render all years, then start animation
  requestIdleCallback(() => {
    preRenderAllYears(matched, YEARS, geo);
    updateSmallMultiples();
    // Start animation loop
    lastTimestamp = performance.now();
    requestAnimationFrame(animationFrame);
  });

  document.body.classList.add('loaded');
}

// --- Animation ---

function animationFrame(timestamp) {
  if (!isPlaying) {
    lastTimestamp = timestamp;
    requestAnimationFrame(animationFrame);
    return;
  }

  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (isFading) {
    // Cross-fading between current year and next
    fadeProgress += dt;
    if (fadeProgress >= FADE_DURATION) {
      // Fade complete — advance to next year
      isFading = false;
      fadeProgress = 0;
      currentYearIndex = (currentYearIndex + 1) % YEARS.length;
      currentYear = YEARS[currentYearIndex];
      drawYear(currentYear);
      syncUI();
      holdTimer = 0;
    } else {
      // Draw cross-fade
      const t = fadeProgress / FADE_DURATION;
      const nextIndex = (currentYearIndex + 1) % YEARS.length;
      const nextYear = YEARS[nextIndex];
      drawCrossFade(currentYear, nextYear, t);
    }
  } else {
    // Holding on current year
    holdTimer += dt;
    const holdTime = (currentYearIndex === YEARS.length - 1) ? END_PAUSE : HOLD_DURATION;
    if (holdTimer >= holdTime) {
      // Start fading to next year
      if (currentYearIndex === YEARS.length - 1) {
        // Loop back to start
        currentYearIndex = -1; // will become 0 after fade
      }
      isFading = true;
      fadeProgress = 0;
    }
  }

  requestAnimationFrame(animationFrame);
}

function drawYear(year) {
  const cached = getCachedYear(year);
  if (cached) {
    heroCtx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);
    heroCtx.drawImage(cached, 0, 0);
  } else {
    heroCtx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);
    renderHeroMap(heroCtx, matched, year, geo);
  }
}

function drawCrossFade(yearA, yearB, t) {
  const cachedA = getCachedYear(yearA);
  const cachedB = getCachedYear(yearB);
  heroCtx.clearRect(0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight);

  if (cachedA) {
    heroCtx.globalAlpha = 1 - t;
    heroCtx.drawImage(cachedA, 0, 0);
  }
  if (cachedB) {
    heroCtx.globalAlpha = t;
    heroCtx.drawImage(cachedB, 0, 0);
  }
  heroCtx.globalAlpha = 1;
}

function syncUI() {
  // Update year buttons
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.textContent) === currentYear);
  });
  // Update small multiples
  document.querySelectorAll('.sm-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.year) === currentYear);
  });
  // Update year overlay
  const overlay = document.getElementById('year-overlay');
  if (overlay) overlay.textContent = currentYear;
  // Update stats
  updateStatsDisplay();
  // Update locked tooltip if one is active
  updateLockedTooltip();
}

// --- Year selector ---

function setupYearSelector() {
  const container = document.getElementById('year-selector');

  for (const year of YEARS) {
    const btn = document.createElement('button');
    btn.className = `year-btn ${year === currentYear ? 'active' : ''}`;
    btn.textContent = year;
    btn.addEventListener('click', () => {
      // Pause animation and jump to this year
      isPlaying = false;
      updatePlayButton();
      selectYear(year);
    });
    container.appendChild(btn);
  }
}

function selectYear(year) {
  currentYear = year;
  currentYearIndex = YEARS.indexOf(year);
  holdTimer = 0;
  isFading = false;
  fadeProgress = 0;

  drawYear(year);
  syncUI();
}

// --- Play/Pause ---

function setupPlayPause() {
  const btn = document.getElementById('play-pause');
  if (!btn) return;
  btn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      lastTimestamp = performance.now();
      holdTimer = 0;
    }
    updatePlayButton();
  });
  updatePlayButton();
}

function updatePlayButton() {
  const btn = document.getElementById('play-pause');
  if (!btn) return;
  btn.textContent = isPlaying ? '❚❚' : '▶';
  btn.title = isPlaying ? 'Pauzeer' : 'Afspelen';
}

// --- Small multiples ---

function setupSmallMultiples() {
  const container = document.getElementById('small-multiples');

  for (const year of YEARS) {
    const item = document.createElement('div');
    item.className = `sm-item ${year === currentYear ? 'active' : ''}`;
    item.dataset.year = year;

    const cvs = document.createElement('canvas');
    cvs.width = LAYOUT.smallMultipleWidth;
    cvs.height = LAYOUT.smallMultipleHeight;
    cvs.className = 'sm-canvas';
    item.appendChild(cvs);

    const label = document.createElement('span');
    label.className = 'sm-label';
    label.textContent = year;
    item.appendChild(label);

    item.addEventListener('click', () => {
      isPlaying = false;
      updatePlayButton();
      selectYear(year);
    });
    container.appendChild(item);
  }
}

function updateSmallMultiples() {
  document.querySelectorAll('.sm-item').forEach(item => {
    const year = parseInt(item.dataset.year);
    const cached = getCachedYear(year);
    if (!cached) return;

    const cvs = item.querySelector('.sm-canvas');
    const ctx = cvs.getContext('2d');
    ctx.drawImage(cached, 0, 0, LAYOUT.heroWidth, LAYOUT.heroHeight,
      0, 0, LAYOUT.smallMultipleWidth, LAYOUT.smallMultipleHeight);
  });
}

// --- Tooltip HTML generation ---

function buildTooltipHTML(data, isLocked) {
  const stats = getStats(data, currentYear);
  const growth = getGrowthStats(data, currentYear);

  // Sparkline
  const vals = YEARS.map(y => {
    const d = data.years[y];
    if (!d || d.zzp == null || d.geen == null) return 0;
    return d.zzp / (d.zzp + d.geen);
  });
  const maxVal = Math.max(...vals, 0.01);
  const sparkW = 140, sparkH = 28;
  let sparkPath = '';
  let currentDot = '';
  const currentIdx = YEARS.indexOf(currentYear);
  for (let i = 0; i < vals.length; i++) {
    const sx = (i / (vals.length - 1)) * sparkW;
    const sy = sparkH - (vals[i] / maxVal) * sparkH;
    sparkPath += i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
    if (i === currentIdx) {
      currentDot = `<circle cx="${sx}" cy="${sy}" r="3" fill="#C0392B" />`;
    }
  }

  // Growth indicator
  let growthHTML = '';
  if (growth && currentYear !== growth.earliestYear) {
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

  return `
    ${isLocked ? '<div class="tt-close" title="Sluiten">✕</div>' : ''}
    <div class="tt-name">${data.name}</div>
    <div class="tt-year">${currentYear}</div>
    <div class="tt-stats">
      <span class="tt-zzp">${stats.zzp.toLocaleString('nl-NL')} ZZP-ers</span>
      <span class="tt-ratio">(${(stats.ratio * 100).toFixed(1)}%)</span>
    </div>
    <div class="tt-total">${stats.total.toLocaleString('nl-NL')} totaal</div>
    ${growthHTML}
    <div class="tt-sparkline">
      <svg width="${sparkW}" height="${sparkH}">
        <path d="${sparkPath}" fill="none" stroke="#8B1A1A" stroke-width="1.5" opacity="0.6"/>
        ${currentDot}
      </svg>
      <div class="tt-spark-labels">
        <span>2009</span><span>2022</span>
      </div>
      <div class="tt-spark-caption">ZZP-er % over de tijd</div>
    </div>
  `;
}

// --- Hover + Click-to-lock ---

let lockedNeighbourhood = null; // { data, x, y } when locked

function setupHover() {
  const tooltip = document.getElementById('tooltip');
  const pathGen = getPathGenerator();
  const hitPaths = matched.map(({ feature, data }) => {
    const geoPath = pathGen(feature);
    return { path: geoPath ? new Path2D(geoPath) : null, data };
  });
  const hitCanvas = new OffscreenCanvas(LAYOUT.heroWidth, LAYOUT.heroHeight);
  const hitCtx = hitCanvas.getContext('2d');

  function hitTest(clientX, clientY) {
    const rect = heroCanvas.getBoundingClientRect();
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

  function renderTooltip(data, posX, posY) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${posX + 16}px`;
    tooltip.style.top = `${posY - 10}px`;

    tooltip.innerHTML = buildTooltipHTML(data, !!lockedNeighbourhood);

    // Keep tooltip on screen
    const tr = tooltip.getBoundingClientRect();
    if (tr.right > window.innerWidth - 10) {
      tooltip.style.left = `${posX - tr.width - 16}px`;
    }
    if (tr.bottom > window.innerHeight - 10) {
      tooltip.style.top = `${posY - tr.height - 10}px`;
    }

    // Wire close button if locked
    if (lockedNeighbourhood) {
      const closeBtn = tooltip.querySelector('.tt-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          unlockTooltip();
        });
      }
    }
  }

  function unlockTooltip() {
    lockedNeighbourhood = null;
    tooltip.style.display = 'none';
    tooltip.classList.remove('locked');
    heroCanvas.style.cursor = 'default';
  }

  // Mousemove: show hover tooltip (only when not locked)
  heroCanvas.addEventListener('mousemove', (e) => {
    if (lockedNeighbourhood) return; // don't move tooltip when locked

    const data = hitTest(e.clientX, e.clientY);
    if (data) {
      renderTooltip(data, e.clientX, e.clientY);
      heroCanvas.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      heroCanvas.style.cursor = 'default';
    }
  });

  // Click: lock/unlock tooltip
  heroCanvas.addEventListener('click', (e) => {
    const data = hitTest(e.clientX, e.clientY);

    if (lockedNeighbourhood) {
      if (data && data.id === lockedNeighbourhood.data.id) {
        // Clicking same neighbourhood: unlock
        unlockTooltip();
      } else if (data) {
        // Clicking different neighbourhood: switch lock
        lockedNeighbourhood = { data, x: e.clientX, y: e.clientY };
        tooltip.classList.add('locked');
        renderTooltip(data, e.clientX, e.clientY);
        // Pause animation so user can compare years
        isPlaying = false;
        updatePlayButton();
      } else {
        // Clicking empty space: unlock
        unlockTooltip();
      }
    } else if (data) {
      // Lock onto this neighbourhood
      lockedNeighbourhood = { data, x: e.clientX, y: e.clientY };
      tooltip.classList.add('locked');
      renderTooltip(data, e.clientX, e.clientY);
      // Pause animation
      isPlaying = false;
      updatePlayButton();
    }
  });

  heroCanvas.addEventListener('mouseleave', () => {
    if (!lockedNeighbourhood) {
      tooltip.style.display = 'none';
    }
  });
}

// Called from syncUI when year changes — update locked tooltip if active
function updateLockedTooltip() {
  if (!lockedNeighbourhood) return;
  const tooltip = document.getElementById('tooltip');
  const { data } = lockedNeighbourhood;

  tooltip.innerHTML = buildTooltipHTML(data, true);

  const closeBtn = tooltip.querySelector('.tt-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      lockedNeighbourhood = null;
      tooltip.style.display = 'none';
      tooltip.classList.remove('locked');
    });
  }
}

// --- Stats ---

function updateStatsDisplay() {
  const el = document.getElementById('stats-display');
  if (!el || !geoData) return;

  const totals = geoData.totals[currentYear];
  if (!totals) return;

  const total = totals.zzp + totals.geen;
  const pct = ((totals.zzp / total) * 100).toFixed(1);
  el.innerHTML = `<strong>${totals.zzp.toLocaleString('nl-NL')}</strong> ZZP-ers in Rotterdam — ${pct}% van de beroepsbevolking`;
}

init().catch(console.error);
