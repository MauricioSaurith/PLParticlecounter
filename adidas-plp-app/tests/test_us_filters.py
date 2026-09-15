import unittest
from scraper import us_filters

class USFilterTests(unittest.TestCase):
    def test_options_and_price(self):
        groups = us_filters({'filterList': [
            {'id':'random-id', 'filtername':'color', 'title':'Color',
             'values':[{'displayName':'Black','value':'black','count':4},
                       {'displayName':'Red','value':'red','count':0}]},
            {'id':'other-id','filtername':'price_slider','title':'price_slider',
             'visualization':'slider','values':[{'displayName':39,'value':39},
                                               {'displayName':305,'value':305}]}]})
        self.assertEqual(len(groups),2)
        self.assertEqual(groups[0]['option_count'],2)
        self.assertEqual(groups[0]['options'][0]['name'],'Black')
        self.assertEqual(groups[0]['options'][1]['product_count'],0)
        self.assertEqual(groups[1]['name'],'Price')
        self.assertEqual(groups[1]['kind'],'range')
        self.assertEqual(groups[1]['options'][0]['value'],39)
    def test_missing_and_empty(self):
        self.assertIsNone(us_filters({}))
        self.assertEqual(us_filters({'filterList':[]}),[])
