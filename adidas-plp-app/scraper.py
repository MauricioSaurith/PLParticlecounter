"""Adidas US: el mismo endpoint JSON y curl_cffi del proyecto original."""
import math
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qsl
from curl_cffi import requests

MAX_PRODUCTS = 3000


class InputError(ValueError):
    pass


class AdidasError(RuntimeError):
    pass


def normalize_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        raise InputError('Enter an Adidas US URL.')
    p = urlsplit(value.strip())
    if p.scheme != 'https' or p.netloc != 'www.adidas.com' or not re.fullmatch(r'/us/[a-zA-Z0-9_-]+/?', p.path):
        raise InputError('Use a PLP such as https://www.adidas.com/us/men-running-shoes.')
    if any(k != 'start' for k, _ in parse_qsl(p.query, keep_blank_values=True)):
        raise InputError('Use a category URL without filter parameters. The start parameter is supported.')
    return 'https://www.adidas.com' + p.path.rstrip('/')


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def product(item):
    pid = item.get('productId')
    if not isinstance(pid, str) or not re.fullmatch(r'[A-Za-z0-9]+', pid):
        raise AdidasError('The API returned a product without a valid ID.')
    original = number(item.get('price'))
    current = number(item.get('salePrice'))
    if current is None:
        current = original
    link = item.get('link', '')
    link = 'https://www.adidas.com' + link if isinstance(link, str) and link.startswith('/us/') else ''
    sizes = item.get('availableSizes')
    colors = item.get('colorVariations')
    return dict(id=pid, name=item.get('displayName') or '', subtitle=item.get('subTitle') or '',
                price=current, original_price=original, currency='USD',
                discount=round((1-current/original)*100, 2) if original and current is not None and 0 <= current < original else 0,
                category=item.get('category') or '', sport=item.get('sport') or '',
                division=item.get('division') or '',
                sizes=', '.join(str(s) for s in sizes if s != 'hidden') if isinstance(sizes, list) else '',
                color_variants=len(set(colors)) if isinstance(colors, list) else None,
                rating=number(item.get('rating')), reviews=number(item.get('ratingCount')),
                orderable='Yes' if item.get('orderable') in (1, True, '1') else ('No' if item.get('orderable') in (0, False, '0') else ''),
                url=link)


def fetch_page(url, start=0):
    url = normalize_url(url)
    if type(start) is not int or not 0 <= start < MAX_PRODUCTS:
        raise InputError('Page is outside the allowed range.')
    try:
        r = requests.get('https://www.adidas.com/api/plp/content-engine',
                         params={'sitePath': 'us', 'query': url.rsplit('/', 1)[-1], 'start': start},
                         impersonate='chrome', timeout=25, allow_redirects=False)
    except requests.RequestsError as exc:
        raise AdidasError('Unable to connect to Adidas. Please try again later.') from exc
    if r.status_code != 200:
        raise AdidasError(f'Adidas returned HTTP {r.status_code}. This request cannot be completed from this connection.')
    try:
        raw = r.json()['raw']
        listing = raw['itemList']
        total, size, actual = listing['count'], int(listing['viewSize']), int(listing['startIndex'])
        if type(total) is not int or total < 0 or not 1 <= size <= 200 or actual != start:
            raise ValueError()
        rows = [product(i) for i in listing['items']]
        if len(rows) != min(size, max(0, total-start)) or len({i['id'] for i in rows}) != len(rows):
            raise AdidasError('The page is incomplete or contains duplicates. Please try again.')
    except (ValueError, TypeError, KeyError) as exc:
        raise AdidasError('Adidas did not return the expected product list. Access may be blocked or the API may have changed.') from exc
    return dict(url=url, title=raw.get('title') or 'Products', total=total, page_size=size,
                start=start, products=rows, max_products=MAX_PRODUCTS,
                fetched_at=datetime.now(timezone.utc).isoformat())
