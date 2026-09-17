"""Daily catalog totals, stored in Supabase; secrets never reach the browser."""
import json
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError
from zoneinfo import ZoneInfo
from flask import jsonify, request
from scraper import fetch_page, AdidasError

CATALOGS = {'US': 'https://www.adidas.com/us/search', 'CA': 'https://www.adidas.ca/en/search',
            'CA-FR': 'https://www.adidas.ca/fr/search'}

class StorageError(RuntimeError):
    pass


def database(path, body=None):
    origin = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SECRET_KEY', '')
    if not origin.startswith('https://') or not key:
        raise StorageError('Catalog history is not connected yet. Configure Supabase in Vercel.')
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    # Legacy service-role JWTs need Authorization; new secret keys use apikey only.
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    req = Request(origin + '/rest/v1/' + path, headers=headers,
                  data=json.dumps(body).encode() if body is not None else None)
    try:
        with urlopen(req, timeout=10) as response:
            payload = response.read()
            return json.loads(payload) if payload else None
    except (URLError, ValueError, OSError) as exc:
        raise StorageError('History storage is unavailable. Check the database configuration.') from exc


def observation(market, day):
    checked = datetime.now(timezone.utc).isoformat()
    row = dict(day=day, market=market, url=CATALOGS[market], checked_at=checked,
               total=None, status='error', error=None)
    try:
        result = fetch_page(CATALOGS[market], market=market, count_only=True)
        row.update(total=result['total'], status='success', checked_at=result['fetched_at'])
    except AdidasError as exc:
        row['error'] = str(exc)
    except Exception:
        row['error'] = 'The catalog could not be checked.'
    return row


def register_history(app):
    @app.get('/api/history')
    def history():
        since = (datetime.now(ZoneInfo('America/Bogota')).date() - timedelta(days=365)).isoformat()
        try:
            rows = []
            for offset in range(0, 1500, 500):
                batch = database('catalog_counts?select=day,market,total,status,checked_at,error&day=gte.' + since + '&order=day.asc,market.asc&limit=500&offset=' + str(offset))
                if not isinstance(batch, list):
                    raise StorageError('History storage returned an invalid response.')
                rows.extend(batch)
                if len(batch) < 500:
                    break
            return jsonify(rows=rows, timezone='America/Bogota', catalogs=CATALOGS)
        except StorageError as exc:
            return jsonify(error=str(exc)), 503

    @app.get('/api/cron/catalog-counts')
    def record_counts():
        secret = os.environ.get('CRON_SECRET', '')
        if not secret or not secrets.compare_digest(request.headers.get('Authorization', ''), 'Bearer ' + secret):
            return jsonify(error='Unauthorized'), 401
        day = datetime.now(ZoneInfo('America/Bogota')).date().isoformat()
        with ThreadPoolExecutor(max_workers=3) as pool:
            rows = list(pool.map(lambda market: observation(market, day), CATALOGS))
        try:
            database('rpc/save_catalog_counts', {'observations': rows})
        except StorageError as exc:
            return jsonify(error=str(exc)), 503
        # Failed requests are stored as gaps, never as zero products.
        ok = all(row['status'] == 'success' for row in rows)
        return jsonify(day=day, rows=rows), 200 if ok else 502
