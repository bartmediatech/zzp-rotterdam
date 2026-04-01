import { scaleLinear, scaleSequential } from 'd3';
import { interpolateRgbBasis } from 'd3';
import { COLORS } from '../config.js';

// Compute freelancer ratio for a neighbourhood at a given year
export function getRatio(neighbourhoodData, year) {
  const d = neighbourhoodData.years[year];
  if (!d || d.zzp == null || d.geen == null) return null;
  const total = d.zzp + d.geen;
  if (total === 0) return null;
  return d.zzp / total;
}

// Ink darkness scale: ratio → [0, 1]
// Rotterdam ratios range ~2% to ~15%, with most between 4-10%
export const ratioScale = scaleLinear()
  .domain([0.03, 0.15])
  .range([0, 1])
  .clamp(true);

// Ink color scale: 0 → 1 mapped to color stops
// Stays light for most of the range, only gets dark/warm at the top
export const inkColorScale = scaleSequential()
  .domain([0, 1])
  .interpolator(interpolateRgbBasis([
    '#D4DCE8', // very light blue-grey for lowest ratios
    COLORS.inkDilute,
    COLORS.inkMedium,
    COLORS.inkDark,
    COLORS.inkAccent,
  ]));

// Spot density scale: ZZP count → number of ink spots
export const densityScale = scaleLinear()
  .domain([10, 1500])
  .range([3, 60])
  .clamp(true);

// Get all stats for a neighbourhood at a year
export function getStats(neighbourhoodData, year) {
  const d = neighbourhoodData.years[year];
  if (!d || d.zzp == null || d.geen == null) {
    return { zzp: 0, geen: 0, total: 0, ratio: 0 };
  }
  const total = d.zzp + d.geen;
  return {
    zzp: d.zzp,
    geen: d.geen,
    total,
    ratio: total > 0 ? d.zzp / total : 0,
  };
}

// Compute the relative change in ZZP ratio between the earliest and a given year
// Returns { ppChange, relativeGrowth, earliestYear, earliestRatio, currentRatio }
// ppChange = percentage point change (e.g. 5% → 9% = +4.0pp)
// relativeGrowth = relative increase of the ratio itself (e.g. 5% → 9% = +80%)
export function getGrowthStats(neighbourhoodData, year) {
  // Find earliest available year
  const allYears = [2009, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
  let earliestYear = null;
  let earliestRatio = null;

  for (const y of allYears) {
    const r = getRatio(neighbourhoodData, y);
    if (r !== null) {
      earliestYear = y;
      earliestRatio = r;
      break;
    }
  }

  const currentRatio = getRatio(neighbourhoodData, year);
  if (earliestRatio === null || currentRatio === null || earliestYear === year) {
    return null;
  }

  const ppChange = (currentRatio - earliestRatio) * 100; // in percentage points
  const relativeGrowth = earliestRatio > 0 ? ((currentRatio - earliestRatio) / earliestRatio) * 100 : 0;

  return {
    ppChange,
    relativeGrowth,
    earliestYear,
    earliestRatio,
    currentRatio,
  };
}
