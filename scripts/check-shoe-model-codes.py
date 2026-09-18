import csv,re,json,urllib.request,html

def codes(v): return set(re.findall(r'(?i)(?=[a-zа-яіїєґ0-9-]*\d)[a-zа-яіїєґ]+[a-zа-яіїєґ0-9]*(?:[-/]\d[a-zа-яіїєґ0-9]*)*', v or ''))
def norm(v): return re.sub(r'[^a-z0-9а-яіїєґ]','',(v or '').lower())
with open('data/site-export.csv',encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
shoes=[r for r in rows if 'взут' in (r.get('Categories') or '').lower()]
url='https://urbanshop.com.ua/products_feed.xml?hash_tag=c673a8a6e076c676116ec9b839805840&sales_notes=&product_ids=&label_ids=12173073%2C145314888%2C12173048%2C144671648%2C12173064%2C12173071&exclude_fields=&html_description=0&yandex_cpa=&process_presence_sure=&languages=uk&extra_fields=&group_ids='
xml=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=120).read().decode('utf8','ignore')
offers=[]
for b in re.findall(r'<offer\b[^>]*>.*?</offer>',xml,re.S|re.I):
 def tag(t):
  m=re.search(fr'<{t}(?:\s[^>]*)?>(.*?)</{t}>',b,re.I|re.S); return html.unescape(re.sub(r'<!\[CDATA\[|\]\]>','',m.group(1))).strip() if m else ''
 offers.append((tag('vendorCode') or tag('article') or tag('sku'),tag('name')))
index={}
for sku,name in offers:
 for c in codes(sku+' '+name): index.setdefault(norm(c),[]).append((sku,name))
hits=[]
for r in shoes:
 cs=codes((r.get('SKU') or '')+' '+(r.get('Name') or ''))
 found={x for c in cs for x in index.get(norm(c),[])}
 if found: hits.append((r,found))
print(json.dumps({'shoes':len(shoes),'shoes_with_model_code_match':len(hits),'samples':[(r.get('SKU'),r.get('Name'),list(found)[:2]) for r,found in hits[:20]]},ensure_ascii=False,indent=2))
