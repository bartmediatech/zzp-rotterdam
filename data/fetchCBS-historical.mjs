import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fetch multiple years of CBS Kerncijfers to get WOZ + demographics over time
// CBS table IDs per year:
const CBS_TABLES = {
  2009: '70904ned',  // Kerncijfers 2009
  2014: '82339NED',  // Kerncijfers 2014
  2017: '83765NED',  // Kerncijfers 2017
  2022: '85984NED',  // Kerncijfers 2022
};

// The field names differ slightly across years, but WOZ and age are consistent
// We'll fetch 2009 and 2022 to compute change

async function fetchCBSYear(tableId, year) {
  const base = `https://opendata.cbs.nl/ODataApi/odata/${tableId}/TypedDataSet`;
  const filter = "$filter=startswith(WijkenEnBuurten,'BU0599')";
  const url = `${base}?${filter}&$top=500&$format=json`;

  console.log(`Fetching CBS ${year} (table ${tableId})...`);
  const resp = await fetch(url);
  const data = await resp.json();

  let rows = data.value;
  // CBS OData paginates — check for next link
  let nextUrl = data['odata.nextLink'] || data['@odata.nextLink'];
  while (nextUrl) {
    const nextResp = await fetch(nextUrl);
    const nextData = await nextResp.json();
    rows = rows.concat(nextData.value);
    nextUrl = nextData['odata.nextLink'] || nextData['@odata.nextLink'];
  }

  console.log(`  Got ${rows.length} rows for ${year}`);
  return rows;
}

// Fetch 2009 and 2022
const data2009 = await fetchCBSYear('70904ned', 2009);
const data2022 = await fetchCBSYear('85984NED', 2022);

// Find the WOZ field name in each dataset
function findWozField(rows) {
  const keys = Object.keys(rows[0] || {});
  return keys.find(k => k.toLowerCase().includes('woz') && k.toLowerCase().includes('gemiddelde'));
}

function findAgeFields(rows) {
  const keys = Object.keys(rows[0] || {});
  return {
    pct25_45: keys.find(k => k.includes('25Tot45')),
    pct45_65: keys.find(k => k.includes('45Tot65')),
    pct65plus: keys.find(k => k.includes('65Jaar')),
    pct15_25: keys.find(k => k.includes('15Tot25')),
  };
}

function findIncomeField(rows) {
  const keys = Object.keys(rows[0] || {});
  return keys.find(k => k.toLowerCase().includes('gemiddeldinkomen') && k.toLowerCase().includes('ontvanger'));
}

const woz2009Field = findWozField(data2009);
const woz2022Field = findWozField(data2022);
const age2009Fields = findAgeFields(data2009);
const age2022Fields = findAgeFields(data2022);

console.log(`\nWOZ field 2009: ${woz2009Field}`);
console.log(`WOZ field 2022: ${woz2022Field}`);
console.log(`Age fields 2009:`, age2009Fields);
console.log(`Age fields 2022:`, age2022Fields);

// Build lookup maps by CBS code
function buildMap(rows) {
  const map = {};
  for (const row of rows) {
    const code = (row.WijkenEnBuurten || '').trim();
    if (code.startsWith('BU0599')) {
      map[code] = row;
    }
  }
  return map;
}

const map2009 = buildMap(data2009);
const map2022 = buildMap(data2022);

// Load our existing joined data
const joinedData = JSON.parse(await readFile(join(__dirname, 'cbs-zzp-joined.json'), 'utf-8'));
const joined = joinedData.joined;

// Enrich with historical comparison
console.log('\n=== WOZ CHANGE 2009→2022 vs ZZP GROWTH ===');
const enriched = [];

for (const row of joined) {
  const r2009 = map2009[row.cbsCode];
  const r2022 = map2022[row.cbsCode];

  const woz2009 = r2009 ? r2009[woz2009Field] : null;
  const woz2022 = r2022 ? r2022[woz2022Field] : null;
  const wozChange = (woz2009 && woz2022) ? woz2022 - woz2009 : null;
  const wozChangePct = (woz2009 && woz2022 && woz2009 > 0) ? ((woz2022 - woz2009) / woz2009) * 100 : null;

  // Age demographics 2022
  const pct25_45_2022 = r2022 ? r2022[age2022Fields.pct25_45] : null;
  const pct25_45_2009 = r2009 ? r2009[age2009Fields.pct25_45] : null;

  enriched.push({
    ...row,
    woz2009,
    woz2022: row.wozGemiddeld,
    wozChange,
    wozChangePct,
    pct25_45_2022,
    pct25_45_2009,
    pct25_45_change: (pct25_45_2022 != null && pct25_45_2009 != null) ? pct25_45_2022 - pct25_45_2009 : null,
  });
}

// Filter to meaningful rows
const meaningful = enriched.filter(r => r.zzpRatioChange != null && r.total2022 > 500);

// Sort by ZZP ratio change
meaningful.sort((a, b) => (b.zzpRatioChange || 0) - (a.zzpRatioChange || 0));

console.log('\nTOP 15 ZZP GROWTH + WOZ + AGE DATA:');
console.log('Buurt                    | ZZP Δ   | Inkomen  | WOZ 2009  | WOZ 2022  | WOZ Δ%    | 25-45 2022');
console.log('-'.repeat(105));
for (const r of meaningful.slice(0, 15)) {
  const zzpD = r.zzpRatioChange != null ? `+${(r.zzpRatioChange*100).toFixed(1)}pp` : 'n/a';
  const inc = r.inkomenPerOntvanger ? `€${r.inkomenPerOntvanger}k` : 'n/a';
  const w09 = r.woz2009 ? `€${r.woz2009}k` : 'n/a';
  const w22 = r.woz2022 ? `€${r.woz2022}k` : 'n/a';
  const wD = r.wozChangePct != null ? `${r.wozChangePct > 0 ? '+' : ''}${r.wozChangePct.toFixed(0)}%` : 'n/a';
  const age = r.pct25_45_2022 != null ? `${r.pct25_45_2022}%` : 'n/a';
  console.log(`${r.naam.padEnd(25)} | ${zzpD.padEnd(7)} | ${inc.padEnd(8)} | ${w09.padEnd(9)} | ${w22.padEnd(9)} | ${wD.padEnd(9)} | ${age}`);
}

// Correlation: ZZP growth vs WOZ growth
const withBoth = meaningful.filter(r => r.wozChangePct != null && r.zzpRatioChange != null);
const n = withBoth.length;
const corrZzpWoz = (() => {
  const xs = withBoth.map(r => r.zzpRatioChange);
  const ys = withBoth.map(r => r.wozChangePct);
  const mx = xs.reduce((a,b) => a+b) / n;
  const my = ys.reduce((a,b) => a+b) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return num / den;
})();

console.log(`\nCorrelation (ZZP ratio CHANGE vs WOZ CHANGE %): r = ${corrZzpWoz.toFixed(3)}`);

// Correlation: ZZP growth vs young adults share
const withAge = meaningful.filter(r => r.pct25_45_2022 != null && r.zzpRatioChange != null);
const corrZzpAge = (() => {
  const xs = withAge.map(r => r.zzpRatioChange);
  const ys = withAge.map(r => r.pct25_45_2022);
  const nn = xs.length;
  const mx = xs.reduce((a,b) => a+b) / nn;
  const my = ys.reduce((a,b) => a+b) / nn;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return num / den;
})();

console.log(`Correlation (ZZP ratio CHANGE vs % age 25-45): r = ${corrZzpAge.toFixed(3)}`);

// Save enriched data
await writeFile(join(__dirname, 'cbs-zzp-enriched.json'), JSON.stringify({ enriched: meaningful }, null, 2));
console.log(`\nSaved enriched data (${meaningful.length} buurten)`);
