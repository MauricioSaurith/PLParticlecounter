import os
import unittest
from unittest.mock import patch
from app import app
from scraper import fetch_page, normalize_url, AdidasError
from history import observation, StorageError

class CatalogHistoryTests(unittest.TestCase):
    def test_french_search_last_page(self):
        url='https://www.adidas.ca/fr/search'
        self.assertEqual(normalize_url(url+'?start=4512'),url)
        with patch('scraper.requests.get') as get:
            get.return_value.status_code=200
            get.return_value.json.return_value={'pageProps':{'sitePath':'fr','taxonomy':'all','context':{'locale':'fr_CA'},'info':{'count':4513,'viewSize':48,'startIndex':4512},'products':[{'id':'AB1234','title':'Chaussures été','url':'https://www.adidas.ca/fr/shoe/AB1234.html','priceData':{'prices':[{'type':'original','value':99.95}]}}]}}
            data=fetch_page(url,4512,market='CA-FR')
            self.assertEqual(data['products'][0]['url'],'https://www.adidas.ca/fr/shoe/AB1234.html')
            self.assertEqual(data['currency'],'CAD')
            self.assertTrue(get.call_args.args[0].endswith('/fr/search.json'))
            get.return_value.json.return_value['pageProps']['context']['locale']='en_CA'
            with self.assertRaises(AdidasError):fetch_page(url,4512)

    def test_count_does_not_require_product_prices(self):
        with patch('scraper.requests.get') as get:
            get.return_value.status_code=200
            get.return_value.json.return_value={'pageProps':{'sitePath':'en','taxonomy':'all','context':{'locale':'en_CA'},'info':{'count':11000,'viewSize':48,'startIndex':0},'products':[{'id':'X'}]}}
            self.assertEqual(fetch_page('https://www.adidas.ca/en/search',count_only=True)['total'],11000)

    def test_failed_observation_is_null(self):
        with patch('history.fetch_page',side_effect=AdidasError('HTTP 403')):
            row=observation('US','2026-09-17')
            self.assertIsNone(row['total'])
            self.assertEqual(row['status'],'error')

    def test_cron_auth_and_persistence(self):
        with app.test_client() as client, patch.dict(os.environ,{'CRON_SECRET':'test-secret'}), patch('history.database') as db, patch('history.fetch_page',return_value={'total':11000,'fetched_at':'2026-09-17T12:00:00Z'}):
            self.assertEqual(client.get('/api/cron/catalog-counts').status_code,401)
            db.assert_not_called()
            response=client.get('/api/cron/catalog-counts',headers={'Authorization':'Bearer test-secret'})
            self.assertEqual(response.status_code,200)
            self.assertEqual(len(db.call_args.args[1]['observations']),3)
            self.assertEqual({r['market'] for r in response.json['rows']},{'CA','US','CA-FR'})

    def test_history_not_configured(self):
        with app.test_client() as client, patch('history.database',side_effect=StorageError('Not connected')):
            self.assertEqual(client.get('/api/history').status_code,503)

    def test_cron_partial_error_is_saved(self):
        def read(url,**kw):
            if '/fr/' in url:raise AdidasError('HTTP 403')
            return {'total':11516,'fetched_at':'2026-09-17T12:00:00Z'}
        with app.test_client() as client,patch.dict(os.environ,{'CRON_SECRET':'test'}),patch('history.database') as db,patch('history.fetch_page',side_effect=read):
            result=client.get('/api/cron/catalog-counts',headers={'Authorization':'Bearer test'})
            self.assertEqual(result.status_code,502)
            self.assertIsNone(next(r for r in db.call_args.args[1]['observations'] if r['market']=='CA-FR')['total'])

    def test_history_reads_more_than_database_page_limit(self):
        with app.test_client() as client, patch('history.database',side_effect=[[{}]*500,[{}]*500,[{}]*98]) as db:
            response=client.get('/api/history')
            self.assertEqual(response.status_code,200)
            self.assertEqual(len(response.json['rows']),1098)
            self.assertIn('offset=1000',db.call_args.args[0])
