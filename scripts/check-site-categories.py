import csv,collections,json
with open('data/site-export.csv',encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
cat=collections.Counter(); shoes=[]
for r in rows:
 c=(r.get('Categories') or r.get('Категории') or '').lower()
 if 'взут' in c or 'обув' in c: shoes.append(r)
print(json.dumps({'rows':len(rows),'shoes':len(shoes),'shoe_types':collections.Counter((r.get('Type') or r.get('Тип') or '') for r in shoes),'shoe_sku':sum(bool((r.get('SKU') or '').strip()) for r in shoes),'shoe_names':[(r.get('SKU'),r.get('Name')) for r in shoes[:20]]},ensure_ascii=False,indent=2))
