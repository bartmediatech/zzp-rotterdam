import { writeFile } from 'fs/promises';

// Fetch CBS buurt boundaries — use NON-generalized version for visible internal borders
// The generalized version has shared edges that don't render as visible boundaries
const URL = 'https://cartomap.github.io/nl/wgs84/buurt_2022.geojson';
// Alternative: try PDOK WFS for detailed boundaries
// For now, let's add a simplification tolerance to slightly offset shared edges

console.log('Fetching CBS buurt GeoJSON (~30MB)...');
const resp = await fetch(URL);
const data = await resp.json();

// Filter to Rotterdam (gemeente code GM0599)
const rotterdam = {
  type: 'FeatureCollection',
  features: data.features.filter(f => {
    const code = f.properties.gemeentecode || f.properties.GM_CODE || f.properties.gmCode;
    return code === 'GM0599';
  })
};

console.log(`Filtered: ${rotterdam.features.length} Rotterdam buurten out of ${data.features.length} total`);

// Log some feature property keys to understand the structure
if (rotterdam.features.length > 0) {
  console.log('Sample properties:', Object.keys(rotterdam.features[0].properties));
  console.log('Sample:', JSON.stringify(rotterdam.features[0].properties, null, 2));
}

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, 'rotterdam-buurten.geojson');
await writeFile(outPath, JSON.stringify(rotterdam));
console.log(`Wrote ${outPath}`);
