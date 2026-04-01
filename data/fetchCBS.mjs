import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CBS Kerncijfers wijken en buurten 2022 — Rotterdam buurten only
const BASE_URL = 'https://opendata.cbs.nl/ODataApi/odata/85984NED/TypedDataSet';
const FILTER = "$filter=startswith(WijkenEnBuurten,'BU0599')";
const SELECT = [
  'WijkenEnBuurten',
  'AantalInwoners_5',
  'k_0Tot15Jaar_8', 'k_15Tot25Jaar_9', 'k_25Tot45Jaar_10', 'k_45Tot65Jaar_11', 'k_65JaarOfOuder_12',
  'GemiddeldeWOZWaardeVanWoningen_39',
  'GemiddeldInkomenPerInkomensontvanger_77',
  'GemiddeldInkomenPerInwoner_78',
  'k_40PersonenMetLaagsteInkomen_79',
  'k_20PersonenMetHoogsteInkomen_80',
].join(',');

const url = `${BASE_URL}?${FILTER}&$select=${SELECT}&$format=json`;

console.log('Fetching CBS Kerncijfers 2022 for Rotterdam buurten...');
const resp = await fetch(url);
const data = await resp.json();
const rows = data.value;

console.log(`Got ${rows.length} buurten from CBS`);

// Clean up the data
const cleaned = rows.map(row => {
  const code = row.WijkenEnBuurten.trim(); // e.g. "BU05990110"
  return {
    cbsCode: code,
    inwoners: row.AantalInwoners_5,
    pct0_15: row.k_0Tot15Jaar_8,
    pct15_25: row.k_15Tot25Jaar_9,
    pct25_45: row.k_25Tot45Jaar_10,
    pct45_65: row.k_45Tot65Jaar_11,
    pct65plus: row.k_65JaarOfOuder_12,
    wozGemiddeld: row.GemiddeldeWOZWaardeVanWoningen_39,
    inkomenPerOntvanger: row.GemiddeldInkomenPerInkomensontvanger_77,
    inkomenPerInwoner: row.GemiddeldInkomenPerInwoner_78,
    pctLaagsteInkomen40: row.k_40PersonenMetLaagsteInkomen_79,
    pctHoogsteInkomen20: row.k_20PersonenMetHoogsteInkomen_80,
  };
}).filter(r => r.inwoners > 0); // skip empty buurten

console.log(`Cleaned: ${cleaned.length} buurten with residents`);

// Also fetch the buurt names from the dimension table
const dimUrl = `https://opendata.cbs.nl/ODataApi/odata/85984NED/WijkenEnBuurten?$filter=startswith(Key,'BU0599')&$format=json`;
const dimResp = await fetch(dimUrl);
const dimData = await dimResp.json();

const nameMap = {};
for (const item of dimData.value) {
  nameMap[item.Key.trim()] = item.Title.trim().replace(/^Buurt\s+/, '');
}

// Merge names
for (const row of cleaned) {
  row.naam = nameMap[row.cbsCode] || row.cbsCode;
}

// Print some stats
console.log('\nSample rows:');
for (const row of cleaned.slice(0, 5)) {
  console.log(`  ${row.naam}: WOZ €${row.wozGemiddeld}k, inkomen €${row.inkomenPerOntvanger}k, ${row.inwoners} inwoners`);
}

// Now load our ZZP data and join
const zzpData = JSON.parse(await (await import('fs')).promises.readFile(join(__dirname, 'neighbourhoods.json'), 'utf-8'));

// Match CBS rows to ZZP neighbourhoods
const joined = [];
for (const cbs of cleaned) {
  // Try matching by normalized name
  const cbsNorm = cbs.naam.toLowerCase().replace(/[-–]/g, ' ').replace(/['']/g, '').replace(/\s+/g, ' ').trim();

  const zzpMatch = zzpData.neighbourhoods.find(n => {
    const zzpNorm = n.name.toLowerCase().replace(/[-–]/g, ' ').replace(/['']/g, '').replace(/\s+/g, ' ').trim();
    return zzpNorm === cbsNorm || cbsNorm.includes(zzpNorm) || zzpNorm.includes(cbsNorm);
  });

  if (zzpMatch) {
    const zzp2009 = zzpMatch.years['2009'];
    const zzp2022 = zzpMatch.years['2022'];
    const ratio2009 = (zzp2009?.zzp != null && zzp2009?.geen != null)
      ? zzp2009.zzp / (zzp2009.zzp + zzp2009.geen) : null;
    const ratio2022 = (zzp2022?.zzp != null && zzp2022?.geen != null)
      ? zzp2022.zzp / (zzp2022.zzp + zzp2022.geen) : null;

    joined.push({
      naam: cbs.naam,
      cbsCode: cbs.cbsCode,
      // ZZP data
      zzpRatio2009: ratio2009,
      zzpRatio2022: ratio2022,
      zzpRatioChange: (ratio2009 != null && ratio2022 != null) ? ratio2022 - ratio2009 : null,
      zzp2022: zzp2022?.zzp || 0,
      total2022: zzp2022 ? (zzp2022.zzp + zzp2022.geen) : 0,
      // CBS data
      inwoners: cbs.inwoners,
      wozGemiddeld: cbs.wozGemiddeld,
      inkomenPerOntvanger: cbs.inkomenPerOntvanger,
      pctLaagsteInkomen40: cbs.pctLaagsteInkomen40,
      pctHoogsteInkomen20: cbs.pctHoogsteInkomen20,
      pct25_45: cbs.pct25_45,
    });
  }
}

console.log(`\nJoined: ${joined.length} buurten with both ZZP and CBS data`);

// Sort by ZZP ratio 2022 descending
joined.sort((a, b) => (b.zzpRatio2022 || 0) - (a.zzpRatio2022 || 0));

// Print analysis
console.log('\n=== TOP 10 HIGHEST ZZP RATIO (2022) ===');
for (const r of joined.slice(0, 10)) {
  console.log(`  ${r.naam}: ${(r.zzpRatio2022*100).toFixed(1)}% ZZP, inkomen €${r.inkomenPerOntvanger}k, WOZ €${r.wozGemiddeld}k`);
}

console.log('\n=== TOP 10 BIGGEST ZZP RATIO INCREASE (2009→2022) ===');
const byGrowth = joined.filter(r => r.zzpRatioChange != null).sort((a, b) => b.zzpRatioChange - a.zzpRatioChange);
for (const r of byGrowth.slice(0, 10)) {
  console.log(`  ${r.naam}: +${(r.zzpRatioChange*100).toFixed(1)}pp (${(r.zzpRatio2009*100).toFixed(1)}% → ${(r.zzpRatio2022*100).toFixed(1)}%), inkomen €${r.inkomenPerOntvanger}k`);
}

console.log('\n=== TWO FACES ANALYSIS ===');
const withData = joined.filter(r => r.zzpRatio2022 != null && r.inkomenPerOntvanger != null && r.total2022 > 500);
const medianIncome = withData.map(r => r.inkomenPerOntvanger).sort((a, b) => a - b)[Math.floor(withData.length/2)];
const medianZzp = withData.map(r => r.zzpRatio2022).sort((a, b) => a - b)[Math.floor(withData.length/2)];

console.log(`Median income: €${medianIncome}k, Median ZZP ratio: ${(medianZzp*100).toFixed(1)}%`);

const highIncHighZzp = withData.filter(r => r.inkomenPerOntvanger >= medianIncome && r.zzpRatio2022 >= medianZzp);
const lowIncHighZzp = withData.filter(r => r.inkomenPerOntvanger < medianIncome && r.zzpRatio2022 >= medianZzp);

console.log(`\nHigh-income + High-ZZP ("consultant face"): ${highIncHighZzp.length} buurten`);
for (const r of highIncHighZzp.slice(0, 8)) {
  console.log(`  ${r.naam}: ${(r.zzpRatio2022*100).toFixed(1)}% ZZP, €${r.inkomenPerOntvanger}k inkomen, WOZ €${r.wozGemiddeld}k`);
}

console.log(`\nLow-income + High-ZZP ("werkvloer face"): ${lowIncHighZzp.length} buurten`);
for (const r of lowIncHighZzp.slice(0, 8)) {
  console.log(`  ${r.naam}: ${(r.zzpRatio2022*100).toFixed(1)}% ZZP, €${r.inkomenPerOntvanger}k inkomen, WOZ €${r.wozGemiddeld}k`);
}

// Compute correlation: ZZP ratio vs income
const n = withData.length;
const sumX = withData.reduce((s, r) => s + r.zzpRatio2022, 0);
const sumY = withData.reduce((s, r) => s + r.inkomenPerOntvanger, 0);
const sumXY = withData.reduce((s, r) => s + r.zzpRatio2022 * r.inkomenPerOntvanger, 0);
const sumX2 = withData.reduce((s, r) => s + r.zzpRatio2022 ** 2, 0);
const sumY2 = withData.reduce((s, r) => s + r.inkomenPerOntvanger ** 2, 0);
const corr = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
console.log(`\nCorrelation (ZZP ratio 2022 vs income): r = ${corr.toFixed(3)}`);

// WOZ correlation
const withWoz = withData.filter(r => r.wozGemiddeld != null);
const nw = withWoz.length;
const corrWoz = (() => {
  const sx = withWoz.reduce((s, r) => s + r.zzpRatio2022, 0);
  const sy = withWoz.reduce((s, r) => s + r.wozGemiddeld, 0);
  const sxy = withWoz.reduce((s, r) => s + r.zzpRatio2022 * r.wozGemiddeld, 0);
  const sx2 = withWoz.reduce((s, r) => s + r.zzpRatio2022 ** 2, 0);
  const sy2 = withWoz.reduce((s, r) => s + r.wozGemiddeld ** 2, 0);
  return (nw * sxy - sx * sy) / Math.sqrt((nw * sx2 - sx ** 2) * (nw * sy2 - sy ** 2));
})();
console.log(`Correlation (ZZP ratio 2022 vs WOZ): r = ${corrWoz.toFixed(3)}`);

// Save joined data
const outPath = join(__dirname, 'cbs-zzp-joined.json');
await writeFile(outPath, JSON.stringify({ joined, meta: { medianIncome, medianZzp, corrIncome: corr, corrWoz: corrWoz } }, null, 2));
console.log(`\nSaved joined data to ${outPath}`);
