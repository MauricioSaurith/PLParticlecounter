# Validation — 2026-09-17

- 24 Python tests pass: existing US/CA behavior, French search mapping, count-only
  handling, protected cron, failed observations, storage configuration and history
  pagination past 1,000 database records.
- JavaScript syntax checks pass for app.js, history.js and xlsx.js.
- A synthetic workbook containing 11,516 products / 16 columns was generated with
  the browser XLSX writer and opened using openpyxl. Verified last ID, numeric
  prices, accents/XML characters, frozen panes and literal formula-like strings.
- Live first/last pages passed for US (11,516 initially), CA EN (4,540), CA FR (4,532).
- Two complete US scan attempts stopped when Adidas changed its reported total.
  The second passed 7,680 products without duplicate IDs before stopping. A full
  live catalog export has NOT yet passed end-to-end. The app deliberately rejects
  changed catalogs rather than exporting a partial list as complete.
- Browser UI checked: French catalog URL, history setup message, graph and table
  with an isolated test fixture including a failed day. Fixture server was stopped;
  no demo history is included in production.
- Supabase schema/RPC and Vercel scheduling still need live integration validation
  after the user's Supabase project and Vercel environment variables are configured.
- No production deployment of this update has been performed.
