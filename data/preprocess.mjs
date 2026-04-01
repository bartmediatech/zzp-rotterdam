import { readFile, writeFile } from 'fs/promises';
import { read, utils } from 'xlsx';

const XLSX_PATH = new URL('./raw/ZZP-ers - Buurten [93].xlsx', import.meta.url);
const OUT_PATH = new URL('./neighbourhoods.json', import.meta.url);

const YEARS = [2009, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];

const buf = await readFile(XLSX_PATH);
const wb = read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

// Row 0-2 are headers, row 3 onwards is data
// Row structure: [name, zzp2009, geen2009, zzp2014, geen2014, ...]
const headerRow = rows[1]; // year labels
const dataRows = rows.slice(3);

const neighbourhoods = [];
const totals = {};

for (const row of dataRows) {
  const rawName = String(row[0] || '').trim();
  if (!rawName) continue;

  // Skip the metadata rows at the bottom
  if (['Speciale waarden', 'Eenheid', 'Bron', 'Website', ''].includes(rawName)) continue;
  if (rawName.startsWith('.')) continue;

  // Handle the totals row
  const cleanName = rawName.replace(/^Buurt\s+/i, '').replace(/^Gemeente\s+/i, '');
  const isTotal = rawName.toLowerCase().startsWith('gemeente');

  const years = {};
  let hasAnyData = false;

  for (let yi = 0; yi < YEARS.length; yi++) {
    const zzpCol = 1 + yi * 2;
    const geenCol = 2 + yi * 2;
    const zzpRaw = row[zzpCol];
    const geenRaw = row[geenCol];

    const zzp = zzpRaw === '.' ? null : (zzpRaw === '' || zzpRaw == null) ? null : Number(zzpRaw);
    const geen = geenRaw === '.' ? null : (geenRaw === '' || geenRaw == null) ? null : Number(geenRaw);

    if (zzp !== null || geen !== null) hasAnyData = true;
    years[YEARS[yi]] = { zzp, geen };
  }

  if (!hasAnyData) continue;

  if (isTotal) {
    for (const [y, d] of Object.entries(years)) {
      totals[y] = d;
    }
    continue;
  }

  const id = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  neighbourhoods.push({ id, name: cleanName, years });
}

const output = {
  meta: {
    years: YEARS,
    particleRatio: 15,
    source: 'CBS, bewerking OBI',
    city: 'Rotterdam'
  },
  neighbourhoods,
  totals
};

await writeFile(OUT_PATH, JSON.stringify(output, null, 2));
console.log(`Wrote ${neighbourhoods.length} neighbourhoods to neighbourhoods.json`);

// Print some stats
let maxPop = 0;
let minPop = Infinity;
for (const n of neighbourhoods) {
  const pop2022 = (n.years[2022]?.zzp || 0) + (n.years[2022]?.geen || 0);
  if (pop2022 > maxPop) maxPop = pop2022;
  if (pop2022 > 0 && pop2022 < minPop) minPop = pop2022;
}
console.log(`Population range (2022): ${minPop} — ${maxPop}`);
console.log(`Total 2022: ${totals[2022]?.zzp} zzp + ${totals[2022]?.geen} geen = ${(totals[2022]?.zzp || 0) + (totals[2022]?.geen || 0)}`);
