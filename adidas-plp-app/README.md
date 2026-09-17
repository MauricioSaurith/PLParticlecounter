# PLP Article Counter · Adidas US & Canada

Simple Flask app for GitHub and Vercel. Uses `curl_cffi` with `impersonate="chrome"`; no Playwright.

## Features

- US and Canada tabs, matching grayscale design.
- Reported total, unique product count, progressive loading, average price and sale count.
- Excel download after all pages pass validation; USD for US, CAD for Canada.
- Names, IDs, prices, discounts, category, sport, division, variants, ratings, reviews and links where available.
- US also provides listed sizes. The Canadian response does not include sizes, so those cells remain blank.
- Changing tabs clears the previous result; tabs are disabled while a request is running.

## Run locally

Python 3.12 recommended:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5055. On Windows activate with `.venv\Scripts\activate`.

## Deploy on Vercel

1. Upload these files to GitHub, replacing the previous app files.
2. Import the repository into Vercel.
3. **Root Directory must be the folder containing `app.py` and `vercel.json`.** In the existing PLParticlecounter repository this is `adidas-plp-app`.
4. Use the Flask framework preset and Python 3.12. Do not override the build command or output directory.
5. Deploy, then test both tabs and Excel downloads from the deployed connection.

See https://vercel.com/docs/frameworks/backend/flask for Flask hosting conventions. Static files are in `public/`. Each API call fetches one page, with a 25-second upstream timeout and a 60-second Vercel function limit. No database or API key is required.

## Endpoints and Canada build identifier

US uses:

```
https://www.adidas.com/api/plp/content-engine?sitePath=us&query=<plp>&start=<offset>
```

Canada uses the actual JSON URL observed in the site's network requests:

```
https://www.adidas.ca/plp-app/_next/data/<build-id>/en/<plp>.json?start=<offset>&path=en&taxonomy=<plp>
```

Canada's total is `pageProps.info.count`; records are in `pageProps.products`. This is a different schema from US (`raw.itemList`). The Canadian adapter maps it to the app's shared fields, preserves sale/original prices, handles sold-out flags and converts missing-value markers such as ratingCount=-99 to empty cells.

The verified default build identifier is `4-H--qpodQDqFEmQRZp2f`. **Adidas may change it when deploying its site.** If Canada's data URL returns 404, check that the category exists and obtain the current JSON Request URL in the Canadian site's Network panel. In Vercel, set environment variable `ADIDAS_CA_BUILD_ID` to the segment immediately after `/_next/data/` and redeploy. This ID is public, not a credential. Automatic discovery is not implemented because direct HTML requests were not consistently accessible from the scraper connection.

## Accepted links

- US: `https://www.adidas.com/us/<plp>`.
- Canada English: `https://www.adidas.ca/en/<plp>`.
- Canada French: `https://www.adidas.ca/fr/<plp>`.
- Use `search` in place of `<plp>` for the full catalog.
- An optional `?start=96` is accepted, but the count starts at the beginning.
- Other query parameters are rejected rather than silently ignoring filters.
- No arbitrary upstream domains or redirects are allowed.

## Counting and export

The app verifies the expected page size, stable total, unique IDs across pages and unchanged first-page IDs at the end. This is a consistency check, not an atomic snapshot of a changing catalog. Color variants inside a card are not added to the count; separately listed product IDs count separately.

The UI enables export only after a complete run. Export is generated in memory from the loaded browser data, validating count, unique IDs and currency. It is not an authenticity certificate or a second fetch from Adidas. No server-side history is stored. Errors never become an invented zero count.

Large exports are generated in the browser, with a request safety ceiling of 100,000 products. Price/sold-out information does not guarantee stock in a particular size. This small app has no authentication or per-user quotas; configure Vercel access controls/rate limiting for wider use.

## Validation

The Canadian URL supplied by the user returned HTTP 200 via curl_cffi. The updated Flask endpoints fetched **115 unique products over 48 + 48 + 19 records**, rechecked the first page and generated an Excel workbook with 115 data rows and CAD headers. This is a result of one execution, not a hardcoded catalog count. The previous Canadian `content-engine` route returned 403; it is no longer used.

Fourteen automated tests cover URL validation, market separation, schema mapping, Canadian pricing, missing values, stale build IDs, errors and Excel exports:

```sh
python -m unittest discover -s tests -v
```

Local success does not guarantee access from Vercel's IPs. This update has not been pushed to GitHub or deployed to Vercel automatically.

Based on the approach shared by Truong Huy: https://github.com/quochuy242/AdidasScraper

## Canadian filter details

After querying Canada, Available filters shows the groups and their option counts, with expandable option names and matching product counts (including zero). Price is shown as a range. Data comes from the first page of the current query; group counts are not hardcoded. This live check returned 11 groups, including Colour with 10 options and Size with 23. Filters are displayed in the app; the product Excel is unchanged.

## US filter details

US now displays the same expandable filter groups, option totals and matching product counts as Canada. It reads `raw.filterList`, normalizes `displayName`, and treats the price slider as a range in USD. Counts are returned dynamically for each URL. The product workbook remains unchanged. A live US check returned 12 groups; all 17 automated tests passed.

## Daily catalog history (new)

The Products screen now supports US, Canada English and Canada French, including
`/search`. Large XLSX files are built in the browser, so product data does not
have to be posted back through Vercel's request-size limit. The table previews
200 rows; the workbook includes every validated product and all 16 columns.
The request safety ceiling is 100,000 products, not a 3,000-product export cap.
Keep the page open during loading; interrupted downloads currently restart.
Adidas can change its catalog during a long scan; inconsistent scans fail rather
than being labelled complete. Matching counts and stable first-page IDs are
consistency checks, not a transactional snapshot of Adidas' inventory.

### First-time setup

1. Create a Supabase project under your own account. Run `supabase/schema.sql`
   in its SQL editor. This creates the history table and the restricted write RPC.
   Then run `supabase/initial-observation-2026-09-17.sql` to preserve the three real
   totals observed on September 17 (with their actual UTC observation times).
   These are reported totals, not a validated full product export.
2. In Vercel, keep Root Directory = `adidas-plp-app`. Add production variables:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (server secret, never publishable/anon),
   and a random `CRON_SECRET` with at least 32 characters. Never put secrets in GitHub
   or chat. A legacy service_role key is also supported.
3. Deploy. `vercel.json` schedules `/api/cron/catalog-counts` at 13:00 UTC daily
   (08:00 Bogotá). Hobby scheduling may run within that hour, not at an exact minute.
   Cron runs on the production deployment, without an open browser.
4. For the first observation, use Vercel's Cron Jobs Run control, or call the endpoint
   with `Authorization: Bearer <CRON_SECRET>` from a trusted server. Check the result
   and the Catalog history tab. Nothing is automatically backfilled.

One record per Bogotá calendar date and catalog is stored. The first successful
observation for a date is preserved on retries. A failed observation may be replaced
by success, but failure never replaces success or becomes a zero count. The graph
shows up to 366 days; older observations remain stored. Public visitors can read
these catalog totals through the app; only the authenticated cron can write them.
The server secret stays server-side; table access by anon/authenticated roles is
revoked. Missing configuration produces a clear setup message, never mock history.

The three reported listing totals may include sold-out articles. They are not
counts of immediately purchasable inventory, and English/French Canada are not
summed together. The daily job fetches only totals, not daily product snapshots.
Downloads contain product details as observed during that particular scan.
