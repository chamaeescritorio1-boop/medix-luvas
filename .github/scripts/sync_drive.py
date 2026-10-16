# Lista as fichas técnicas (PDF) da pasta pública do Google Drive da Medix.
import re, json, os, urllib.request
ROOT=os.environ.get('DRIVE_FOLDER','1vVaHoGc0APcOxS4zJJbvwyGPFV0uHruQ')
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
def listar(fid):
    h=get(f'https://drive.google.com/embeddedfolderview?id={fid}#list').decode('utf8','ignore')
    return [(u.replace('&amp;','&'),re.sub('<[^>]+>','',n).strip()) for u,n in re.findall(r'<a href="(https://drive\.google\.com/[^"]+)"[^>]*>.*?<div class="flip-entry-title">(.*?)</div>',h,re.S)]
out=[]; pastas=[(ROOT,'')]
while pastas:
    fid,p=pastas.pop()
    for url,nome in listar(fid):
        m=re.search(r'/folders/([\w-]+)',url)
        if m: pastas.append((m.group(1),(p+'/'+nome).strip('/'))); continue
        m=re.search(r'/file/d/([\w-]+)',url)
        if m and nome.lower().endswith('.pdf'): out.append({'n':nome,'p':p,'id':m.group(1)})
json.dump(out,open('fichas_drive.json','w'),ensure_ascii=False,indent=0)
print(len(out),'PDFs')
