// Design tokens for the ink flow visualization

export const COLORS = {
  paperBase: '#F5F0E8',
  paperGrain: '#E8E0D4',

  // Ink gradient (low → high freelancer ratio)
  inkDilute: '#B8C4D4',
  inkMedium: '#5A6B7A',
  inkDark: '#2C3E50',
  inkAccent: '#8B1A1A',

  // River
  riverFill: '#D0D8E4',
  riverEdge: '#8898AA',

  // UI
  textPrimary: '#2C3440',
  textSecondary: '#7A8694',
  textLight: '#A0AAB4',
  yearHighlight: '#C0392B',
  border: '#D4CFC4',
};

export const LAYOUT = {
  width: 1100,
  heroWidth: 920,
  heroHeight: 660,
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  smallMultipleWidth: 88,
  smallMultipleHeight: 64,
  smallMultipleGap: 6,
};

export const INK = {
  // Ink spots
  spotRadiusMin: 2.0,
  spotRadiusMax: 6.0,
  spotAlphaMin: 0.12,
  spotAlphaMax: 0.45,

  // Ink wash (disabled — accumulates too much across 80 neighbourhoods)
  washAlphaMin: 0.0,
  washAlphaMax: 0.0,

  // Neighbourhood borders (map outline)
  borderAlpha: 0.6,
  borderWidth: 1.5,
  borderColor: '#667788',
};

export const YEARS = [2009, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
