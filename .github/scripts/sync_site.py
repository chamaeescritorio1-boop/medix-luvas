# Baixa fotos dos produtos do site medixbrasil.com.br e liga ao SKU (código) do catálogo.
import re, json, os, io, time, urllib.request, html
from PIL import Image
UA={'User-Agent':'Mozilla/5.0 (Chamae medix-luvas sync)'}
def get(u):
    for i in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30).read()
        except Exception as e: err=e; time.sleep(2)
    raise err
os.makedirs('img',exist_ok=True)
LOG=[]
def log(*a):
    s=' '.join(map(str,a)); print(s); LOG.append(s)
prods=set()
for mar in (1,2,3):
    for page in range(1,40):
        try: h=get(f'https://medixbrasil.com.br/index.php?page={page}&ipp=24&mar={mar}&pg=produtos').decode('utf-8','ignore')
        except Exception as e: log('lista erro',mar,page,repr(e)); break
        found={'https://medixbrasil.com.br/produto/'+s for s in re.findall(r'produto/([a-z0-9\-]+)',h)}
        if page==1 and not found: log('lista sem produtos',mar,len(h),h[:300].replace('\n',' '))
        if not found-prods: break
        prods|=found; time.sleep(.5)
log(len(prods),'páginas de produto')
mapa=json.load(open('img/mapa.json')) if os.path.exists('img/mapa.json') else {}
for u in sorted(prods):
    try: h=get(u).decode('utf-8','ignore')
    except Exception as e: log('erro',u,repr(e)); continue
    og=re.search(r'property="og:image"\s+content="([^"]+)"',h) or re.search(r'content="([^"]+)"\s+property="og:image"',h)
    img=og.group(1) if og else None
    if not img:
        m=re.search(r'https://medixbrasil\.s3[^"\' ]+/produtos/[^"\' ]+\.(?:png|jpe?g|webp)',h); img=m.group(0) if m else None
    skus=set(re.findall(r'SKU:\s*([0-9]{3,6})',html.unescape(re.sub('<[^>]+>',' ',h))))
    if not img or not skus: log('sem img/sku',u,img,len(skus)); continue
    try:
        im=Image.open(io.BytesIO(get(img))).convert('RGBA'); bg=Image.new('RGB',im.size,(255,255,255)); bg.paste(im,mask=im.split()[3]); im=bg
        im.thumbnail((600,600))
    except Exception as e: log('img',u,repr(e)); continue
    for s in skus:
        im.save(f'img/{s}.jpg','JPEG',quality=80,optimize=True); mapa[s]={'url':u,'img':img}
    time.sleep(.4)
json.dump(mapa,open('img/mapa.json','w'),ensure_ascii=False,indent=0)
log(len(mapa),'SKUs com foto')
open('img/sync_log.txt','w').write('\n'.join(LOG))
