-- Real totals observed on 2026-09-17, not demo data. Run AFTER schema.sql.
-- Does not replace an existing successful observation for that day.
select public.save_catalog_counts($snapshot$
[
  {
    "day": "2026-09-17",
    "market": "US",
    "url": "https://www.adidas.com/us/search",
    "total": 11516,
    "checked_at": "2026-09-17T17:40:55.702320+00:00",
    "status": "success",
    "error": null
  },
  {
    "day": "2026-09-17",
    "market": "CA",
    "url": "https://www.adidas.ca/en/search",
    "total": 4540,
    "checked_at": "2026-09-17T17:40:56.847105+00:00",
    "status": "success",
    "error": null
  },
  {
    "day": "2026-09-17",
    "market": "CA-FR",
    "url": "https://www.adidas.ca/fr/search",
    "total": 4532,
    "checked_at": "2026-09-17T17:40:57.065830+00:00",
    "status": "success",
    "error": null
  }
]
$snapshot$::jsonb);
