/* Sistema Chamae: abre instantâneo. Arquivos fixos vêm do aparelho; app e página buscam a versão nova e caem no aparelho se estiver sem internet. */
const C='chamaeof-v1', FIXOS=['jspdf.umd.min.js','xlsx.full.min.js','logo.jpg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>c.addAll(FIXOS)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('chamaeof-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  const fixo=FIXOS.some(f=>u.pathname.endsWith('/'+f));
  if(fixo){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c2=n.clone(); caches.open(C).then(c=>c.put(e.request,c2)); return n})));return}
  e.respondWith(fetch(e.request).then(n=>{if(n.ok){const c2=n.clone(); caches.open(C).then(c=>c.put(e.request,c2))} return n}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
