# Coleta (uma vez) trechos com comprimento/cano das luvas Medix: página do produto, fichas PDF do Drive e CA (consultaca).
import re, json, io, time, html, urllib.request
UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'}
def get(u):
    for k in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
        except Exception as e:
            if k==2: print('falhou',u,e); return None
            time.sleep(3)
def txt(b):
    h=b.decode('utf8','ignore'); return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',re.sub(r'(?s)<(script|style).*?</\1>',' ',h))))
RX=re.compile(r'(?i)(comprimento|cano|punho|\b\d{2,3}(?:[.,]\d)?\s*(?:cm|mm)\b)')
def trechos(t):
    out=[]
    for m in RX.finditer(t):
        s=t[max(0,m.start()-90):m.end()+90]
        if not out or s[:40] not in out[-1]: out.append(s)
    return out[:25]
def pdf_txt(b):
    try:
        from pypdf import PdfReader
        return re.sub(r'\s+',' ','\n'.join((pg.extract_text() or '') for pg in PdfReader(io.BytesIO(b)).pages[:6]))
    except Exception as e: return ''
I=json.load(open('.github/scripts/cano_in.json')); R={'site':{},'ca':{},'pdf':{}}
for u in sorted({o['url'] for o in I if o.get('url')}):
    b=get(u)
    if b: R['site'][u]=trechos(txt(b))
for c in sorted({o['ca'] for o in I if o.get('ca')}):
    b=get(f'https://consultaca.com/{c}')
    if b: R['ca'][c]=trechos(txt(b))
for x in json.load(open('fichas_drive.json')):
    if 'luva' not in x['n'].lower(): continue
    b=get(f"https://drive.google.com/uc?export=download&id={x['id']}")
    if b and b.startswith(b'%PDF'): R['pdf'][x['n']]=trechos(pdf_txt(b))
json.dump(R,open('cano_out.json','w'),ensure_ascii=False,indent=0)
print(len(R['site']),len(R['ca']),len(R['pdf']))
