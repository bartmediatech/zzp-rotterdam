import { isIncludedFeature } from '../geo/projection.js';

// Load Rotterdam GeoJSON and match to neighbourhood data

// Manual overrides for names that don't match directly
const NAME_OVERRIDES = {
  'cs-kwartier': 'CS Kwartier',
  's-gravenland': "'s-Gravenland",
  'kop-van-zuid---entrepot': 'Kop van Zuid - Entrepot',
};

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/^buurt\s+/i, '')
    .replace(/[''`]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadGeoData() {
  const [geoResp, dataResp] = await Promise.all([
    fetch('/data/rotterdam-buurten.geojson'),
    fetch('/data/neighbourhoods.json'),
  ]);
  const geo = await geoResp.json();
  const data = await dataResp.json();

  // Build lookup from normalized data names
  const dataByNorm = new Map();
  const dataById = new Map();
  for (const n of data.neighbourhoods) {
    dataByNorm.set(normalize(n.name), n);
    dataById.set(n.id, n);
  }

  // Match GeoJSON features to data
  const matched = [];
  const unmatched = [];

  for (const feature of geo.features) {
    const geoName = feature.properties.statnaam;
    const normGeo = normalize(geoName);

    // Try direct match
    let dataEntry = dataByNorm.get(normGeo);

    // Try with id-style matching
    if (!dataEntry) {
      const idStyle = normGeo.replace(/\s+/g, '-');
      dataEntry = dataById.get(idStyle);
    }

    // Try overrides
    if (!dataEntry) {
      for (const [overrideId, overrideName] of Object.entries(NAME_OVERRIDES)) {
        if (normalize(overrideName) === normGeo) {
          dataEntry = dataById.get(overrideId);
          break;
        }
      }
    }

    // Try partial match
    if (!dataEntry) {
      for (const [norm, entry] of dataByNorm) {
        if (norm.includes(normGeo) || normGeo.includes(norm)) {
          dataEntry = entry;
          break;
        }
      }
    }

    if (dataEntry) {
      matched.push({ feature, data: dataEntry });
    } else {
      unmatched.push(geoName);
    }
  }

  if (unmatched.length > 0) {
    console.warn('Unmatched GeoJSON neighbourhoods:', unmatched);
  }
  // Filter to center Rotterdam only (exclude western areas)
  const centerMatched = matched.filter(m => isIncludedFeature(m.feature));
  const centerGeo = {
    type: 'FeatureCollection',
    features: geo.features.filter(isIncludedFeature),
  };

  console.log(`Matched ${matched.length}/${geo.features.length}, showing ${centerMatched.length} (center only)`);

  return { matched: centerMatched, geo: centerGeo, data };
}
