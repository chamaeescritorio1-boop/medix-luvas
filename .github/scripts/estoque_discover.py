# Descobre a estrutura do portal de estoque Medix (sem gravar dados de preço/estoque, só nomes de campos e links)
import os, re, http.cookiejar, urllib.request, urllib.parse, html
BASE='http://medixfv.com.br:2082/medixfv/'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); op.addheaders=[('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'),('Accept','text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),('Accept-Language','pt-BR,pt;q=0.9')]
out=[]
def summ(tag,h):
    out.append(f'== {tag} len={len(h)} title={re.search(r"<title>(.*?)</title>",h,re.S|re.I).group(1).strip() if re.search(r"<title>",h,re.I) else ""}')
    for f in re.findall(r'<form[^>]*>',h,re.I): out.append('FORM '+f)
    for i in re.findall(r'<(?:input|select|textarea)[^>]*>',h,re.I): out.append('  CAMPO '+re.sub(r'value="[^"]{12,}"','value="…"',i))
    for a in sorted(set(re.findall(r'(?:href|action|src)="([^"#]+\.php[^"]*)"',h,re.I)))[:80]: out.append('  LINK '+a)
    for s in re.findall(r'(?:url|fetch|ajax|\.php)[^\n]{0,120}',h)[:20]: out.append('  JS '+s.strip()[:160])
try:
    h=op.open(BASE+'login.php',timeout=40).read().decode('latin-1','ignore'); summ('login',h)
except Exception as e:
    out.append('ERRO login.php '+repr(e)+' '+(e.read()[:300].decode('latin-1','ignore') if hasattr(e,'read') else '')); h=''
u,p=os.environ.get('MEDIX_USER'),os.environ.get('MEDIX_PASS')
if u and p and h:
    form=re.search(r'<form[^>]*action="([^"]*)"',h,re.I); act=urllib.parse.urljoin(BASE+'login.php',form.group(1) if form else 'login.php')
    names=[n for n in re.findall(r'<input[^>]*name="([^"]+)"',h,re.I)]
    data={}
    for n in names:
        m=re.search(r'<input[^>]*name="'+re.escape(n)+r'"[^>]*>',h,re.I).group(0)
        t=(re.search(r'type="([^"]+)"',m,re.I) or [None,'text'])[1].lower(); v=(re.search(r'value="([^"]*)"',m,re.I) or [None,''])[1]
        if t=='password': data[n]=p
        elif t in('text','email') and not data.get('_u'): data[n]=u; data['_u']=1
        elif t=='hidden' or t=='submit': data[n]=v
    data.pop('_u',None); out.append('LOGIN campos usados: '+', '.join(data.keys()))
    r=op.open(act,urllib.parse.urlencode(data).encode('latin-1'),timeout=30); h2=r.read().decode('latin-1','ignore'); summ('apos login '+r.geturl(),h2)
    for l in sorted(set(re.findall(r'href="([^"#]+\.php[^"]*)"',h2,re.I)))[:15]:
        try: h3=op.open(urllib.parse.urljoin(r.geturl(),l),timeout=30).read().decode('latin-1','ignore'); summ('pagina '+l,h3)
        except Exception as e: out.append('ERRO '+l+' '+repr(e))
else: out.append('Sem segredos MEDIX_USER/MEDIX_PASS')
open('estoque_estrutura.txt','w').write('\n'.join(out))
