import { geoIdentity, geoPath } from 'd3';
import { LAYOUT } from '../config.js';

let projection = null;
let pathGenerator = null;

// Longitude cutoff: exclude everything west of center Rotterdam
const MIN_LON = 4.44;

// Compute average longitude of a feature's coordinates
function featureAvgLon(feature) {
  // For Polygon: coordinates = [ring, ...] where ring = [[lon,lat], ...]
  // For MultiPolygon: coordinates = [[ring, ...], ...]
  const geom = feature.geometry;
  let sum = 0, count = 0;

  function processRing(ring) {
    for (const pt of ring) {
      if (typeof pt[0] === 'number') {
        sum += pt[0]; count++;
      }
    }
  }

  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) processRing(ring);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) processRing(ring);
    }
  }

  return count > 0 ? sum / count : 0;
}

export function isIncludedFeature(feature) {
  return featureAvgLon(feature) >= MIN_LON;
}

export function setupProjection(geoJSON) {
  const { heroWidth, heroHeight, margin } = LAYOUT;
  const w = heroWidth - margin.left - margin.right;
  const h = heroHeight - margin.top - margin.bottom;

  const centerFeatures = {
    type: 'FeatureCollection',
    features: geoJSON.features.filter(isIncludedFeature),
  };

  projection = geoIdentity()
    .reflectY(true)
    .fitSize([w, h], centerFeatures);

  const [tx, ty] = projection.translate();
  projection.translate([tx + margin.left, ty + margin.top]);

  pathGenerator = geoPath(projection);

  return { projection, pathGenerator };
}

export function getProjection() { return projection; }
export function getPathGenerator() { return pathGenerator; }

export function project(lonLat) {
  return projection(lonLat);
}
