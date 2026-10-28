# Lê as páginas de produto e as fichas técnicas (PDF) da Medix e grava fichas_dados.json
# com espessura, comprimento, cor, CA e link da ficha por código de produto (usado na busca técnica do Sistema).
import re, json, os, io, time, html, unicodedata, urllib.request, urllib.parse
UA={'User-Agent':'Mozilla/5.0'}
def get(u,tent=3):
    for k in range(tent):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
        except Exception as e:
            if k==tent-1: print('falhou',u,e); return None
            time.sleep(3)
def sem_acento(s): return unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().upper()
def campos(txt):
    t=sem_acento(re.sub(r'\s+',' ',txt)); d={}
    m=re.search(r'ESPESSURA[^0-9]{0,60}?(\d+[.,]\d+)\s*(MM|MIL)?',t)
    if m:
        v=float(m.group(1).replace(',','.'))
        if m.group(2)=='MIL': v=round(v*0.0254,3)
        if 0<v<3: d['esp']=str(v)
    m=re.search(r'COMPRIMENTO[^0-9]{0,60}?(\d{3})\s*(MM)?',t) or re.search(r'COMPRIMENTO[^0-9]{0,60}?(\d{2}[.,]?\d?)\s*CM',t)
    if m:
        v=float(m.group(1).replace(',','.'));  v=v*10 if v<100 else v
        if 150<=v<=700: d['comp']=str(int(v))
    m=re.search(r'\bCOR(?:ES)?\s*[:\-]\s*([A-Z ]{3,30}?)(?=\s*(?:[;.,]|TAMANHO|MATERIAL|ESPESSURA|COMPRIMENTO|EMBALAGEM|CA\b|$))',t)
    if m and m.group(1).strip(): d['cor']=m.group(1).strip().title()
    m=re.search(r'\bC\.?\s?A\.?\s*(?:N[O°º]?\.?)?\s*[:\-]?\s*(\d{1,3}\.\d{3}|\d{4,6})\b',t)
    if m: d['ca']=m.group(1).replace('.','')
    m=re.search(r'(?:REGISTRO|ANVISA|MS)[^0-9]{0,30}(\d{11})',t)
    if m: d['anvisa']=m.group(1)
    if re.search(r'ISENTA? DE PO|SEM PO|POWDER FREE',t): d['po']='sem pó'
    elif re.search(r'COM PO|PO BIOABSORV|AMIDO',t): d['po']='com pó'
    return d
def pdf_txt(b):
    try:
        from pypdf import PdfReader
        return '\n'.join((pg.extract_text() or '') for pg in PdfReader(io.BytesIO(b)).pages[:6])
    except Exception as e:
        print('pdf ilegível',e); return ''
site=json.load(open('fichas.json')); drive=json.load(open('fichas_drive.json'))
limpa=lambda n: re.sub(r'^(OK|SEM CAD)\s*-\s*','',n).strip().lower()
porNome={limpa(x['n']):x['id'] for x in drive}
pdf={}
for x in drive:
    b=get(f"https://drive.google.com/uc?export=download&id={x['id']}")
    if not b or not b.startswith(b'%PDF'): continue
    d=campos(pdf_txt(b)); d['n']=x['n']; pdf[x['id']]=d
print(len(pdf),'fichas PDF lidas de',len(drive))
pags={}
for url in sorted(set(site.values())):
    b=get(url)
    if not b: continue
    h=b.decode('utf8','ignore'); txt=html.unescape(re.sub(r'<[^>]+>',' ',re.sub(r'(?s)<(script|style).*?</\1>',' ',h)))
    d=campos(txt); ids=re.findall(r'drive\.google\.com/(?:file/d/|open\?id=|uc\?[^"\']*id=)([\w-]{20,})',h)
    for u in re.findall(r'href=["\']([^"\']+\.pdf)["\']',h,re.I):
        nm=limpa(urllib.request.unquote(u.split('/')[-1]))
        if nm in porNome: ids.append(porNome[nm])
        elif 'ficha' in nm and not d.get('pdf_site'): d['pdf_site']=urllib.parse.urljoin(url,u)
    if ids: d['drive']=ids[0]
    pags[url]=d
print(len(pags),'páginas lidas de',len(set(site.values())))
cod={}
for c,url in site.items():
    p=dict(pags.get(url) or {}); did=p.pop('drive',None); f=pdf.get(did or '',{})
    r={k:v for k,v in {**{k:v for k,v in f.items() if k!='n'},**p}.items() if v}
    r['url']=url
    if did: r['ficha']='https://drive.google.com/file/d/'+did+'/view'
    elif p.get('pdf_site'): r['ficha']=r.pop('pdf_site')
    r.pop('pdf_site',None); cod[c]=r
json.dump({'gerado':time.strftime('%Y-%m-%d'),'cod':cod,'pdf':pdf},open('fichas_dados.json','w'),ensure_ascii=False,indent=0)
print(sum(1 for v in cod.values() if v.get('ficha')),'produtos com ficha;',sum(1 for v in cod.values() if v.get('esp')),'com espessura')
