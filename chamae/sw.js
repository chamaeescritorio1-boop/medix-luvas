/* Sistema Chamae: abre instantâneo. Arquivos fixos vêm do aparelho; app e página buscam a versão nova e caem no aparelho se estiver sem internet. */
const C='chamae-v2', FIXOS=['jspdf.umd.min.js','xlsx.full.min.js','logo.jpg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>c.addAll(FIXOS)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('chamae-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
/* Compartilhar › Chamae (Android): guarda o print/texto que veio do WhatsApp e abre o Sistema para escolher o pedido (autorização do comprador) */
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(e.request.method!=='POST'||u.origin!==location.origin||!u.searchParams.has('compartilhar')) return;
  e.respondWith((async()=>{try{const fd=await e.request.formData(); const f=fd.getAll('arq').find(x=>x&&x.size); const c=await caches.open('share-chamae'); const k=n=>new URL(n,self.registration.scope).href;
    await c.put(k('share-meta'),new Response(JSON.stringify({title:fd.get('title')||'',text:fd.get('text')||'',url:fd.get('url')||'',nome:f&&f.name||'',tipo:f&&f.type||''}),{headers:{'Content-Type':'application/json'}}));
    if(f) await c.put(k('share-file'),new Response(f,{headers:{'Content-Type':f.type||'image/png'}})); else await c.delete(k('share-file'))}catch(_){}
    return Response.redirect(new URL('./?compartilhado=1',self.registration.scope).href,303)})())});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  const fixo=FIXOS.some(f=>u.pathname.endsWith('/'+f));
  if(fixo){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c2=n.clone(); caches.open(C).then(c=>c.put(e.request,c2)); return n})));return}
  e.respondWith(fetch(e.request).then(n=>{if(n.ok){const c2=n.clone(); caches.open(C).then(c=>c.put(e.request,c2))} return n}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
