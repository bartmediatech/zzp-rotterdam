# Design: ZZP-ers Rotterdam — "De Twee Gezichten" Scrollytelling Investigation

## Context

We've built an ink-flow map of ZZP-er density in Rotterdam centre (2009–2022), deployed on GitHub (bartmediatech/zzp-rotterdam). Now we want to turn it into a scrollytelling data investigation.

**Research findings** (grounded in CBS/KVK data, not assumptions):
- ZZP growth in NL was 85% over 2014–2024, but top sectors are business services (27%), construction (14%), and healthcare (13%) — not just "creative class"
- Healthcare saw 135% growth in female ZZP-ers specifically
- Growth is slowing in 2024-2025 due to schijnzelfstandigheid enforcement
- No existing research links ZZP concentration to gentrification at neighbourhood level — this is an original angle
- CBS SES-WOA scores (combining wealth, education, employment) are available per buurt
- The same "ZZP-er" label hides wildly different economic realities: a €120/hr IT consultant vs a construction worker forced into self-employment

**Core thesis: "De Twee Gezichten van de ZZP-er"** — The same growth trend means very different things in different neighbourhoods. Some areas see high-income freelancing (consultants, creatives) in gentrifying zones. Others see working-class self-employment (construction, healthcare, platform economy) in cheaper areas. Overlaying income/SES data on the ZZP map reveals which face each neighbourhood wears.

---

## Part 1: Quick Portfolio Embed (do now)

Deploy to Vercel as static site, embed in bartvanson.nl via Elementor HTML widget.

1. `npm run build` → `dist/`
2. `vercel deploy --prod` → production URL
3. Elementor HTML widget: `<iframe src="URL" width="100%" height="800" style="border:none;"></iframe>`

---

## Part 2: Scrollytelling Narrative (5 acts)

### Act 1 — De Groei
*"In 2009 was 5% van de Rotterdamse beroepsbevolking ZZP-er. In 2022 is dat bijna 10%. Maar de groei is niet overal gelijk."*

→ Existing animated ink map, 2009→2022. Establishes the base phenomenon.
→ Key stat: Rotterdam's ZZP growth mirrors the national trend (85% nationally, ~97% in Rotterdam based on our data: 24K→47K)

### Act 2 — De Hotspots
*"In sommige buurten verdubbelde het aandeel ZZP-ers bijna..."*

→ Map highlights top-5 fastest-growing neighbourhoods (computed from data: ratio change 2009→2022). Zoom in, name them.
→ Counter-examples: neighbourhoods where ZZP share barely changed. Map dims everything except the extremes.
→ Question posed to reader: "Wat hebben deze buurten gemeen?"

### Act 3 — De Twee Gezichten
*"Dezelfde stijging vertelt twee totaal verschillende verhalen."*

→ This is the core reveal. Overlay CBS SES-WOA scores (or income data) onto the map.
→ Split the map into two groups:
  - **Warm ink (vermillion)**: high-ZZP + high-income neighbourhoods → "de consultant-ZZP-er" (Kralingen, Hillegersberg, Stadsdriehoek)
  - **Cool ink (indigo)**: high-ZZP + low/mid-income neighbourhoods → "de werkvloer-ZZP-er" (Charlois, Bloemhof, Feijenoord?)
→ Small sidebar: nationally, top ZZP sectors are business services (27%), construction (14%), healthcare (13%)
→ Scatter plot: ZZP ratio vs. average income per neighbourhood. The two clusters become visible.

### Act 4 — De Verschuiving
*"De woningmarkt vertelt de rest van het verhaal."*

→ Overlay WOZ-waarden change (2009→2022) on the map.
→ Question: do the "consultant-ZZP" neighbourhoods also have the steepest housing price increases?
→ If yes: freelancers as both signal and accelerant of neighbourhood change.
→ If no: more nuanced — ZZP growth driven by different forces in different areas.
→ Timeline: show how WOZ and ZZP moved in tandem (or didn't) for selected neighbourhoods.

### Act 5 — Het Kruispunt
*"2022 is een kantelpunt. De groei vertraagt, de regels veranderen."*

→ Context: schijnzelfstandigheid enforcement starting 2023-2024, ZZP growth slowing 44%
→ Return to full map, now with the reader's enriched understanding
→ Interactive mode: explore neighbourhoods with full tooltip (existing feature)
→ Open question: "Welk gezicht van de ZZP-er zal Rotterdam in 2030 laten zien?"
→ Sources, methodology, credits

---

## Part 3: Data Exploration Phase (immediate next work)

Before building Acts 3-4, we need to verify the data exists and the correlations hold.

### CBS data to fetch (all at buurt level):

| Dataset | Source | Key for our story |
|---------|--------|-------------------|
| SES-WOA scores | CBS statusscore per buurt | Splits "rich ZZP" vs "working-class ZZP" neighbourhoods |
| Gemiddeld inkomen | CBS Kerncijfers wijken en buurten | Direct income comparison |
| WOZ-waarden | CBS Kerncijfers wijken en buurten | Housing price trajectory |
| Opleidingsniveau | CBS statusscore components | Education level per buurt |
| Leeftijdsopbouw | CBS Kerncijfers wijken en buurten | Age demographics |

### Exploration steps:

1. Fetch CBS "Kerncijfers wijken en buurten 2022" for Rotterdam (OData API or CSV download)
2. Fetch CBS SES-WOA scores per buurt (2022)
3. Join with our ZZP data by neighbourhood name/CBS buurtcode
4. Compute: ZZP ratio change vs. income, vs. WOZ, vs. SES score
5. Plot correlations — do we see the two-cluster pattern?
6. If yes → the narrative holds, proceed to scrollytelling
7. If no → adjust the thesis based on what the data shows

### Key hypothesis to test:
- Scatter plot of (ZZP ratio 2022) vs (gemiddeld inkomen) → expect two groups, not one linear trend
- Scatter plot of (ZZP ratio change 2009→2022) vs (WOZ change) → expect positive correlation in high-income areas, weaker in low-income

---

## Technical approach

- **Scrollama** for scroll-triggered transitions (lightweight, proven)
- **GSAP** for map animations (zoom, highlight, layer transitions)
- Keep vanilla JS + Vite + D3 + Canvas 2D
- CBS data preprocessed to JSON at build time
- Sticky map with scrolling text panels (classic scrollytelling pattern)
- Same ink-on-paper aesthetic, EB Garamond typography

---

## Verification

1. Portfolio embed: current viz loads in iframe on bartvanson.nl
2. CBS data: successfully fetch SES-WOA + income + WOZ for ≥50 Rotterdam buurten
3. Two-cluster hypothesis: scatter plot shows meaningful grouping (or we learn something different)
4. At least 3 of the 5 narrative acts have data support
