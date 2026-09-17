"""Adidas US: el mismo endpoint JSON y curl_cffi del proyecto original."""
import math
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qsl
from curl_cffi import requests

MAX_PRODUCTS = 100000  # Request safety ceiling, not a catalog truncation limit.
# This identifier belongs to Adidas' deployment, not to a user/session.
# Override it in Vercel if Adidas changes its Next.js build.
CA_BUILD_ID = os.environ.get('ADIDAS_CA_BUILD_ID', '4-H--qpodQDqFEmQRZp2f')
MARKETS = {
    'US': {'origin': 'https://www.adidas.com', 'path': 'us', 'currency': 'USD'},
    'CA': {'origin': 'https://www.adidas.ca', 'path': 'en', 'currency': 'CAD'},
    'CA-FR': {'origin': 'https://www.adidas.ca', 'path': 'fr', 'currency': 'CAD'},
}


def market_for_url(url):
    p = urlsplit(url)
    return ('CA-FR' if p.path.startswith('/fr/') else 'CA') if p.netloc == 'www.adidas.ca' else 'US'



class InputError(ValueError):
    pass


class AdidasError(RuntimeError):
    pass


def normalize_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        raise InputError('Enter an Adidas US or Canada URL.')
    p = urlsplit(value.strip())
    config = MARKETS[market_for_url(value)]
    if p.scheme != 'https' or 'https://' + p.netloc != config['origin'] or not re.fullmatch('/' + config['path'] + r'/[a-zA-Z0-9_-]+/?', p.path):
        raise InputError('Use an Adidas US /us/ or Adidas Canada /en/ or /fr/ category URL.')
    if any(k != 'start' for k, _ in parse_qsl(p.query, keep_blank_values=True)):
        raise InputError('Use a category URL without filter parameters. The start parameter is supported.')
    return config['origin'] + p.path.rstrip('/')


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def product(item, market="US"):
    config = MARKETS[market]
    pid = item.get('productId')
    if not isinstance(pid, str) or not re.fullmatch(r'[A-Za-z0-9]+', pid):
        raise AdidasError('The API returned a product without a valid ID.')
    original = number(item.get('price'))
    current = number(item.get('salePrice'))
    if current is None:
        current = original
    link = item.get('link', '')
    link = config['origin'] + link if isinstance(link, str) and link.startswith('/' + config['path'] + '/') else ''
    sizes = item.get('availableSizes')
    colors = item.get('colorVariations')
    return dict(id=pid, name=item.get('displayName') or '', subtitle=item.get('subTitle') or '',
                price=current, original_price=original, currency=config['currency'],
                discount=round((1-current/original)*100, 2) if original and current is not None and 0 <= current < original else 0,
                category=item.get('category') or '', sport=item.get('sport') or '',
                division=item.get('division') or '',
                sizes=', '.join(str(s) for s in sizes if s != 'hidden') if isinstance(sizes, list) else '',
                color_variants=len(set(colors)) if isinstance(colors, list) else None,
                rating=number(item.get('rating')), reviews=number(item.get('ratingCount')),
                orderable='Yes' if item.get('orderable') in (1, True, '1') else ('No' if item.get('orderable') in (0, False, '0') else ''),
                url=link)


def canada_product(item, filters, market="CA"):
    prices = {p['type']: p.get('value') for p in item.get('priceData', {}).get('prices', [])}
    original = number(prices.get('original'))
    current = number(prices.get('sale'))
    if current is None:
        current = original
    if current is None:
        raise AdidasError('Canada returned an unsupported price format.')
    selected = {f.get('on'): f.get('name', '') for f in filters}
    link = item.get('url', '')
    origin = MARKETS[market]['origin']
    language = MARKETS[market]['path']
    relative = link[len(origin):] if isinstance(link, str) and link.startswith(origin + '/' + language + '/') else ''
    sold_out = item.get('priceData', {}).get('isSoldOut')
    rating = number(item.get('rating'))
    reviews = number(item.get('ratingCount'))
    return product({
        'productId': item.get('id'), 'displayName': item.get('title'),
        'subTitle': '' if item.get('subTitle') == 'NOT_IMPLEMENTED' else item.get('subTitle'),
        'price': original, 'salePrice': current, 'link': relative,
        'category': selected.get('division', ''),
        'sport': selected.get('sport_' + language + '_ca', ''),
        'division': '' if item.get('category') == 'NOT_IMPLEMENTED' else item.get('category'),
        'colorVariations': item.get('colourVariations'),
        'rating': rating if rating is not None and rating >= 0 else None,
        'ratingCount': reviews if reviews is not None and reviews >= 0 else None,
        'orderable': (0 if sold_out else 1) if isinstance(sold_out, bool) else None,
    }, market)



def canada_filters(raw):
    groups = raw.get('filters')
    if not isinstance(groups, list):
        return None
    result = []
    for group in groups:
        values = group.get('values', [])
        slider = group.get('visualization') == 'slider'
        result.append({
            'id': group.get('id', ''),
            'name': 'Price' if group.get('id') == 'price_slider' else group.get('title') or group.get('id', ''),
            'kind': 'range' if slider else 'options',
            'option_count': len(values),
            'options': [{'name': v.get('name', ''), 'value': v.get('value', ''),
                         'product_count': v.get('count')} for v in values],
        })
    return result


def us_filters(raw):
    groups = raw.get('filterList')
    if not isinstance(groups, list):
        return None
    # Normalize the US API's field names into the shared filter view.
    return canada_filters({'filters': [
        {'id': group.get('filtername') or group.get('id', ''),
         'title': group.get('title', ''),
         'visualization': group.get('visualization'),
         'values': [{'name': str(value.get('displayName', '')),
                     'value': value.get('value', ''), 'count': value.get('count')}
                    for value in group.get('values', [])]}
        for group in groups
    ]})


def fetch_page(url, start=0, market=None, count_only=False):
    url = normalize_url(url)
    detected = market_for_url(url)
    if market is not None and market != detected:
        raise InputError("The URL does not match the selected market.")
    config = MARKETS[detected]
    if type(start) is not int or not 0 <= start < MAX_PRODUCTS:
        raise InputError('Page is outside the allowed range.')
    try:
        taxonomy = url.rsplit('/', 1)[-1]
        if detected in ('CA', 'CA-FR'):
            if not re.fullmatch(r'[A-Za-z0-9_-]+', CA_BUILD_ID):
                raise AdidasError('Invalid ADIDAS_CA_BUILD_ID configuration.')
            endpoint = f"{config['origin']}/plp-app/_next/data/{CA_BUILD_ID}/{config['path']}/{taxonomy}.json"
            params = {'start': start, 'path': config['path'], 'taxonomy': taxonomy}
        else:
            endpoint = config['origin'] + '/api/plp/content-engine'
            params = {'sitePath': config['path'], 'query': taxonomy, 'start': start}
        r = requests.get(endpoint, params=params,
                         impersonate='chrome', timeout=25, allow_redirects=False)
    except requests.RequestsError as exc:
        raise AdidasError('Unable to connect to Adidas. Please try again later.') from exc
    if detected in ('CA', 'CA-FR') and r.status_code == 404:
        raise AdidasError('Canada data URL was not found. The category may be invalid or Adidas may have changed its build. Check ADIDAS_CA_BUILD_ID.')
    if r.status_code != 200:
        raise AdidasError(f'Adidas returned HTTP {r.status_code}. This request cannot be completed from this connection.')
    try:
        if detected in ('CA', 'CA-FR'):
            raw = r.json()['pageProps']
            if raw.get('sitePath') != config['path'] or raw.get('taxonomy') != ('all' if taxonomy == 'search' else taxonomy) or raw.get('context', {}).get('locale') != config['path'] + '_CA':
                raise AdidasError('Canada returned a different market or category.')
            listing = raw['info']
            rows = [] if count_only else [canada_product(i, raw.get('selectedFilters', []), detected) for i in raw['products']]
        else:
            raw = r.json()['raw']
            listing = raw['itemList']
            rows = [] if count_only else [product(i, detected) for i in listing['items']]
        total, size, actual = listing['count'], int(listing['viewSize']), int(listing['startIndex'])
        if type(total) is not int or total < 0 or not 1 <= size <= 200 or actual != start:
            raise ValueError()
        if not count_only and (len(rows) != min(size, max(0, total-start)) or len({i['id'] for i in rows}) != len(rows)):
            raise AdidasError('The page is incomplete or contains duplicates. Please try again.')
    except (ValueError, TypeError, KeyError) as exc:
        raise AdidasError('Adidas did not return the expected product list. Access may be blocked or the API may have changed.') from exc
    return dict(filters=canada_filters(raw) if detected in ('CA', 'CA-FR') else us_filters(raw), url=url, market=detected, currency=config['currency'], title=raw.get('title') or 'Products', total=total, page_size=size,
                start=start, products=rows, max_products=MAX_PRODUCTS,
                fetched_at=datetime.now(timezone.utc).isoformat())
