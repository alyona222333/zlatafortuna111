import csv, re, json, urllib.request
from html import unescape
from pathlib import Path

SITE='data/site-export.csv'
URL='https://urbanshop.com.ua/products_feed.xml?hash_tag=c673a8a6e076c676116ec9b839805840&sales_notes=&product_ids=&label_ids=12173073%2C145314888%2C12173048%2C144671648%2C12173064%2C12173071&exclude_fields=&html_description=0&yandex_cpa=&process_presence_sure=&languages=uk&extra_fields=&group_ids='

def norm(v): return re.sub(r'[^a-z0-9а-яіїєґ]+','', (v or '').lower())
def tokens(v): return set(re.findall(r'[a-zа-яіїєґ0-9]{3,}', (v or '').lower()))
def codes(v): return set(re.findall(r'(?i)(?=[a-zа-яіїєґ0-9-]*\d)[a-zа-яіїєґ]+[a-zа-яіїєґ0-9]*(?:[-/]\d[a-zа-яіїєґ0-9]*)*', v or ''))
def clean_name(v):
    v=(v or '').lower()
    v=re.sub(r'\b(alloriginal|com|ua|розміри|запитуйте|запитайте|розмірі|розмірів|розміри\s+запитуйте)\b',' ',v)
    return norm(v)

def parse_csv():
    with open(SITE,encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
    return rows

def parse_offers(xml):
    out=[]
    for b in re.findall(r'<offer\b[^>]*>.*?</offer>',xml,re.S|re.I):
        h=re.match(r'<offer\b([^>]*)>',b,re.I|re.S).group(1)
        oid=re.search(r'\bid=["\']([^"\']+)',h,re.I)
        def tag(t):
            m=re.search(fr'<{t}(?:\s[^>]*)?>(.*?)</{t}>',b,re.I|re.S)
            return unescape(re.sub(r'<!\[CDATA\[|\]\]>','',m.group(1))).strip() if m else ''
        out.append({'id':oid.group(1) if oid else '', 'sku':tag('vendorCode') or tag('article') or tag('sku'), 'name':tag('name'), 'barcode':tag('barcode')})
    return out

site=parse_csv()
xml=urllib.request.urlopen(urllib.request.Request(URL,headers={'User-Agent':'Mozilla/5.0'}),timeout=120).read().decode('utf-8','ignore')
offers=parse_offers(xml)
by_sku={norm(r.get('SKU')):r for r in site if norm(r.get('SKU'))}
by_name={clean_name(r.get('Name')):r for r in site if clean_name(r.get('Name'))}
matched_sku=[]; matched_name=[]; unmatched=[]
for o in offers:
    if norm(o['sku']) in by_sku: matched_sku.append(o)
    elif clean_name(o['name']) in by_name: matched_name.append(o)
    else: unmatched.append(o)
print(json.dumps({'site_rows':len(site),'offers':len(offers),'sku_matches':len(matched_sku),'name_exact_matches':len(matched_name),'union':len({o['id'] for o in matched_sku+matched_name}),'unmatched':len(unmatched),'sample_name_matches':matched_name[:15],'sample_unmatched':unmatched[:20]},ensure_ascii=False,indent=2))
Path('/tmp/monostor-diagnostic.xml').write_text(xml)
