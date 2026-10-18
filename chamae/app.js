/* Sistema Chamae — versão de teste */
(function(){
'use strict';
const SB='https://jmpvmyyokikpwphwylob.supabase.co', KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcHZteXlva2lrcHdwaHd5bG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTc1MzEsImV4cCI6MjEwNzc5MzUzMX0.e5XT2R7eOj3x-ZYcRFkY4OFg0QEr3_guxT6-W0xpnfY';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); const pct=v=>(+v||0).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const G=k=>{try{return JSON.parse(localStorage.getItem('chamae_'+k))}catch(e){return null}}, S=(k,v)=>{try{localStorage.setItem('chamae_'+k,JSON.stringify(v))}catch(e){}};
const L=k=>{try{return JSON.parse(localStorage.getItem('chs_'+k))}catch(e){return null}}, LS=(k,v)=>{try{localStorage.setItem('chs_'+k,JSON.stringify(v))}catch(e){}};
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2600)}
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();

/* ---------- Supabase ---------- */
let sess=G('sess'), perfil=G('perfil');
async function auth(body,grant){const r=await fetch(SB+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error_description||j.msg||j.error||('HTTP '+r.status)); return j}
const setSess=j=>{sess={at:j.access_token,rt:j.refresh_token,exp:Date.now()+(j.expires_in-60)*1000,uid:j.user&&j.user.id,email:j.user&&j.user.email}; S('sess',sess)};
async function token(){if(!sess) return null; if(Date.now()<sess.exp) return sess.at; try{setSess(await auth({refresh_token:sess.rt},'refresh_token')); return sess.at}catch(e){sess=null;S('sess',null); return null}}
async function api(path,opt={}){const t=await token(); if(!t){showLock(); throw new Error('Entre novamente')} const r=await fetch(SB+'/rest/v1/'+path,{...opt,headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json',...(opt.headers||{})}}); const tx=await r.text(); if(!r.ok) throw new Error(tx.slice(0,300)||('HTTP '+r.status)); return tx?JSON.parse(tx):null}
async function apiAll(path){const out=[]; let off=0; const sep=path.includes('?')?'&':'?'; while(true){const r=await api(`${path}${sep}limit=1000&offset=${off}`); out.push(...r); if(r.length<1000) break; off+=1000} return out}
const ehGestor=()=>perfil&&perfil.papel==='gestor';
function showLock(m){$('#lock').hidden=false; $('#nav').hidden=true; if(m) $('#lerr').textContent=m; if(sess&&sess.email) $('#le').value=sess.email}
$('#lf').onsubmit=async e=>{e.preventDefault(); const b=$('#lf button'); b.disabled=true; try{setSess(await auth({email:$('#le').value.trim(),password:$('#ls').value},'password')); await afterLogin()}catch(err){$('#lerr').textContent=/invalid/i.test(err.message)?'E-mail ou senha incorretos':err.message} b.disabled=false};
async function afterLogin(){try{const p=await api('perfis?select=id,nome,email,papel&id=eq.'+sess.uid); perfil=p[0]||null; S('perfil',perfil)}catch(e){}
  $('#lock').hidden=true; $('#nav').hidden=false; $('#navAdm').hidden=!ehGestor(); const w=$('#who'); w.hidden=false; w.textContent=(perfil&&perfil.nome)||sess.email;
  w.onclick=()=>{if(confirm('Sair da conta?')){sess=null;S('sess',null);showLock()}}; go(L('route')||'home')}

/* ---------- dados ---------- */
let REPS=null; const CAT={}, TABS={}, PRICES={};
async function reps(){if(!REPS){REPS=await api('representadas?select=*&order=ordem'); const c=await api('produtos?select=rep&limit=10000').catch(()=>[]); const n={}; c.forEach(x=>n[x.rep]=(n[x.rep]||0)+1); REPS.forEach(r=>r.n=n[r.id]||0)} return REPS}
async function catalog(rep,force){if(CAT[rep]&&!force) return CAT[rep]; try{CAT[rep]=await apiAll(`produtos?select=*&rep=eq.${rep}&ativo=eq.true&order=cod`); LS('cat_'+rep,CAT[rep])}catch(e){CAT[rep]=L('cat_'+rep)||[]; if(!CAT[rep].length) throw e} return CAT[rep]}
async function tabelas(rep,force){if(TABS[rep]&&!force) return TABS[rep]; try{TABS[rep]=await api(`tabelas?select=*&rep=eq.${rep}&ativa=eq.true&order=nome`); LS('tab_'+rep,TABS[rep])}catch(e){TABS[rep]=L('tab_'+rep)||[]} return TABS[rep]}
async function prices(tid,force){if(PRICES[tid]&&!force) return PRICES[tid]; let rows; try{rows=await apiAll(`precos?select=produto_id,nivel,preco&tabela_id=eq.${tid}`); LS('pr_'+tid,rows)}catch(e){rows=L('pr_'+tid)||[]} const m={}; rows.forEach(r=>{(m[r.produto_id]=m[r.produto_id]||{})[r.nivel]=+r.preco}); PRICES[tid]=m; return m}
let CLIS=null; async function clientes(){if(CLIS) return CLIS; try{const r=await apiAll('cliente_rep?select=cnpj,cliente,cidade,representada,ultimo,ultimo_prazo,vendedor'); const m={}; r.forEach(x=>{const c=m[x.cnpj]=m[x.cnpj]||{cnpj:x.cnpj,n:x.cliente,cid:x.cidade,reps:{}}; c.reps[x.representada]=x}); CLIS=Object.values(m); LS('clis',CLIS)}catch(e){CLIS=L('clis')||[]} return CLIS}
const repName=id=>((REPS||[]).find(r=>r.id===id)||{}).nome||id;
const HIST_REP={marcon:'Marcon',marluvas:'Marluvas',medix:'Medix',sigma:'Sigma Tools',camper:'Camper',zm:'ZM Bombas',terra:'Terra',fortlev:'Fortlev',pegorari:'Pegorari',valcan:'Valcan',cid:'CID',chemicals:'Chemicals 4U'};
const TRANSP={marcon:[{n:'Cliente retira (FOB)',p:0},{n:'Alfa Transportes FOB (~5%)',p:5},{n:'Transportadora Floresta FOB (~5%)',p:5},{n:'Transportadora a ser indicada (FOB)',p:0}]};
const EXTERNAL={marluvas:'/conversor-ca/teste/',medix:'/medix-luvas/teste/'};

/* ---------- orçamentos (um por representada) ---------- */
const Q=()=>L('quotes')||{}; const setQ=q=>{LS('quotes',q); badge()};
const curQ=rep=>{const q=Q(); return q[rep]||(q[rep]={rep,itens:[],tabela:null,cli:null,transp:0,prazo:'',obs:'',id:String(Date.now())})};
function saveQ(o){const q=Q(); q[o.rep]=o; setQ(q)}
function badge(){const n=Object.values(Q()).reduce((s,o)=>s+o.itens.length,0); const b=$('#qn'); b.hidden=!n; b.textContent=n}

/* ---------- navegação ---------- */
let route='home', ctx={};
function go(r,c){route=r; ctx=c||{}; LS('route',r==='rep'?'home':r); document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===r)); window.scrollTo(0,0); ({home,rep:repView,orc,admin}[r]||home)()}
$('#homeLnk').onclick=e=>{e.preventDefault(); go('home')}; $('#homeBtn').onclick=()=>go('home');
$('#nav').onclick=e=>{const b=e.target.closest('[data-go]'); if(b) go(b.dataset.go)};

/* ---------- início ---------- */
async function home(){const m=$('#main'); m.innerHTML='<p class="hint">Carregando…</p>'; let R; try{R=await reps()}catch(e){m.innerHTML=`<p class="bad">Não consegui carregar: ${esc(e.message)}</p><p class="hint">Rodou o arquivo 2_produtos_tabelas.sql no Supabase?</p>`;return}
  const q=Q(); m.innerHTML=`<div class="sec">Representadas</div><div class="reps">${R.filter(r=>r.ativa).map(r=>{const ext=EXTERNAL[r.id]; const on=r.n||ext; const qn=(q[r.id]||{itens:[]}).itens.length;
     return `<button class="rep${on?'':' off'}" style="--c:${esc(r.cor||'#2a3157')}" data-rep="${esc(r.id)}"><b>${esc(r.nome)}</b><small>${r.n?r.n+' produtos':ext?'App próprio (por enquanto)':'Em breve'}${qn?` · <span class="badge">${qn}</span> no orçamento`:''}</small></button>`}).join('')}</div>
   <div class="sec" style="margin-top:20px">Atalhos</div><div class="row"><a class="btn ghost" href="/medix-luvas/teste/">Clientes, inativos e painel ↗</a>${ehGestor()?'<button class="btn ghost" data-go2="admin">Produtos e tabelas</button>':''}</div>`;
  m.onclick=e=>{const b=e.target.closest('[data-rep]'); if(b){const id=b.dataset.rep, r=R.find(x=>x.id===id); if(r.n) go('rep',{rep:id}); else if(EXTERNAL[id]) location.href=EXTERNAL[id]; return} const a=e.target.closest('[data-go2]'); if(a) go(a.dataset.go2)}}

/* ---------- módulo da representada: catálogo ---------- */
async function repView(){const rep=ctx.rep; const m=$('#main'); m.innerHTML='<p class="hint">Carregando catálogo…</p>';
  let C,T; try{[C,T]=await Promise.all([catalog(rep),tabelas(rep)])}catch(e){m.innerHTML=`<p class="bad">${esc(e.message)}</p>`;return}
  const o=curQ(rep); if(!o.tabela&&T.length){o.tabela=T[0].id; saveQ(o)} const P=o.tabela?await prices(o.tabela):{};
  let qtxt=''; const render=()=>{const w=norm(qtxt).split(/\s+/).filter(Boolean); const list=C.filter(p=>!w.length||w.every(x=>norm(p.cod+' '+p.descricao+' '+(p.attrs&&p.attrs.ean||'')).includes(x))).filter(p=>!o.tabela||P[p.id]);
    $('#pl').innerHTML=list.slice(0,80).map(p=>{const pr=P[p.id]||{}; const inQ=o.itens.find(i=>i.pid===p.id);
      return `<div class="card pc"><img src="${esc(p.img||'')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div style="display:grid;gap:5px;min-width:0"><div class="cod">${esc(p.cod)}</div><div class="d">${esc(p.descricao)}</div>
       <div class="pr">${brl(pr.liq)}<small> /${esc((p.un||'un').toLowerCase())} s/ IPI</small></div><div class="tags"><span class="tag">IPI ${pct(p.ipi)}</span>${p.attrs&&p.attrs.prazo?`<span class="tag">Entrega ${esc(p.attrs.prazo)} dias</span>`:''}${p.mult>1?`<span class="tag">múlt. ${p.mult}</span>`:''}${pr.base?`<span class="tag">Bruto ${brl(pr.base)}</span>`:''}</div>
       <div class="row"><div class="qty"><button data-m="${p.id}" aria-label="Menos">−</button><input data-q="${p.id}" type="number" inputmode="numeric" min="0" value="${inQ?inQ.qt:''}" placeholder="0" aria-label="Quantidade"><button data-p="${p.id}" aria-label="Mais">+</button></div></div></div></div>`}).join('')||'<p class="hint">Nenhum produto nesta tabela.</p>';
    $('#cnt').textContent=`${list.length} produtos${list.length>80?' · mostrando 80, refine a busca':''}`};
  m.innerHTML=`<div class="row" style="justify-content:space-between"><div class="sec" style="margin:0">${esc(repName(rep))}</div><button class="btn sm" data-go2="orc">Ver orçamento (${o.itens.length})</button></div>
   <div class="r2" style="margin:10px 0"><label class="f">Tabela de preço<select id="tab">${T.map(t=>`<option value="${t.id}"${t.id==o.tabela?' selected':''}>${esc(t.nome)}</option>`).join('')||'<option value="">Nenhuma tabela importada</option>'}</select></label>
   <label class="f">Buscar<input id="q" type="search" placeholder="Código, descrição ou EAN"></label></div><p class="hint" id="cnt"></p><div class="pl" id="pl"></div>`;
  $('#tab').onchange=async e=>{if(o.itens.length&&!confirm('Trocar a tabela recalcula os preços do orçamento desta representada. Continuar?')){e.target.value=o.tabela;return} o.tabela=+e.target.value; saveQ(o); repView()};
  let t; $('#q').oninput=e=>{clearTimeout(t); t=setTimeout(()=>{qtxt=e.target.value; render()},200)};
  const setQt=(pid,v)=>{const p=C.find(x=>x.id===pid); const mult=p.mult||1; v=Math.max(0,Math.round(v/mult)*mult||0); let it=o.itens.find(i=>i.pid===pid); if(v&&!it){it={pid,qt:0}; o.itens.push(it)} if(it){it.qt=v; if(!v) o.itens=o.itens.filter(i=>i!==it)} saveQ(o); const inp=document.querySelector(`[data-q="${pid}"]`); if(inp) inp.value=v||''; m.querySelector('[data-go2]').textContent=`Ver orçamento (${o.itens.length})`};
  m.onclick=e=>{const a=e.target.closest('[data-go2]'); if(a) return go('orc',{rep}); const mi=e.target.closest('[data-m]'),pl=e.target.closest('[data-p]'); if(mi||pl){const pid=+(mi||pl).dataset[mi?'m':'p']; const p=C.find(x=>x.id===pid); const cur=(o.itens.find(i=>i.pid===pid)||{}).qt||0; setQt(pid,cur+(pl?1:-1)*(p.mult||1))}};
  m.onchange=e=>{const i=e.target.closest('[data-q]'); if(i) setQt(+i.dataset.q,+i.value)};
  render()}

/* ---------- orçamento ---------- */
async function orc(){const m=$('#main'); const q=Q(); const reps_=Object.keys(q).filter(r=>q[r].itens.length||r===ctx.rep); if(!reps_.length){m.innerHTML='<div class="sec">Orçamento</div><p class="hint">Nenhum item. Escolha uma representada na tela inicial.</p>';return}
  await reps(); const rep=ctx.rep&&reps_.includes(ctx.rep)?ctx.rep:reps_[0]; const o=curQ(rep);
  const [C,T]=await Promise.all([catalog(rep),tabelas(rep)]); const P=o.tabela?await prices(o.tabela):{}; const tab=T.find(t=>t.id==o.tabela);
  const tr=(TRANSP[rep]||[]); const rows=o.itens.map(i=>{const p=C.find(x=>x.id===i.pid)||{}; const pr=P[i.pid]||{}; const pu=pr.liq||0; return {i,p,pu,icms:pr.icms,tot:pu*i.qt,ipiv:pu*i.qt*(+p.ipi||0)/100}});
  const sub=rows.reduce((s,r)=>s+r.tot,0), ipi=rows.reduce((s,r)=>s+r.ipiv,0), fr=tr[o.transp]?(sub+ipi)*tr[o.transp].p/100:0;
  m.innerHTML=`<div class="row">${reps_.map(r=>`<button class="chip${r===rep?' on':''}" data-r="${r}">${esc(repName(r))} (${q[r].itens.length})</button>`).join('')}</div>
   <div class="sec" style="margin-top:12px">Orçamento ${esc(repName(rep))}</div>
   <div class="card grid"><label class="f">Cliente<input id="cq" type="search" placeholder="Buscar por nome, CNPJ ou cidade" value="${o.cli?esc(o.cli.n):''}"></label><div id="cres"></div>
    ${o.cli&&o.cli.ult?`<p class="hint">Último pedido ${esc(repName(rep))}: ${esc(String(o.cli.ult.ultimo||'').split('-').reverse().join('/'))} · prazo ${esc(o.cli.ult.ultimo_prazo||'—')} <button class="chip" id="usePz">Usar prazo</button></p>`:''}
    <div class="r2"><label class="f">Tabela<select id="otab">${T.map(t=>`<option value="${t.id}"${t.id==o.tabela?' selected':''}>${esc(t.nome)}</option>`).join('')}</select></label>
    <label class="f">Prazo de pagamento<input id="opz" value="${esc(o.prazo)}" placeholder="ex.: 28/42/56"></label></div>
    ${tr.length?`<label class="f">Transportadora / frete<select id="otr">${tr.map((t,k)=>`<option value="${k}"${k==o.transp?' selected':''}>${esc(t.n)}</option>`).join('')}</select></label>`:''}
    <label class="f">Observações<textarea id="oobs" rows="2">${esc(o.obs)}</textarea></label></div>
   <div class="card" style="margin-top:12px;overflow-x:auto"><table class="t"><tr><th>Produto</th><th>EAN</th><th>NCM</th><th class="n">IPI</th><th class="n">ICMS</th><th class="n">Qtd.</th><th class="n">Unit. s/ IPI</th><th class="n">Total s/ IPI</th><th></th></tr>
    ${rows.map(r=>`<tr><td><b>${esc(r.p.cod)}</b><br><small class="hint">${esc(r.p.descricao)}</small></td><td>${esc(r.p.attrs&&r.p.attrs.ean||'')}</td><td>${esc(r.p.ncm||'')}</td><td class="n">${pct(r.p.ipi)}</td><td class="n">${r.icms!=null?pct(r.icms):''}</td>
     <td class="n"><input data-oq="${r.i.pid}" type="number" value="${r.i.qt}" style="width:72px;padding:6px;text-align:right"></td><td class="n">${brl(r.pu)}</td><td class="n">${brl(r.tot)}</td><td><button class="chip" data-del="${r.i.pid}" aria-label="Remover">✕</button></td></tr>`).join('')}</table>
    <div class="grid" style="gap:4px;margin-top:10px;font-size:14px"><div class="row" style="justify-content:space-between"><span>Subtotal (sem IPI)</span><b>${brl(sub)}</b></div><div class="row" style="justify-content:space-between"><span>IPI</span><b>${brl(ipi)}</b></div>${fr?`<div class="row" style="justify-content:space-between"><span>Frete estimado (${pct(tr[o.transp].p)})</span><b>${brl(fr)}</b></div>`:''}</div>
    <div class="tot"><span>Total</span><b>${brl(sub+ipi+fr)}</b></div></div>
   <div class="row" style="margin-top:12px"><button class="btn" id="opdf">Gerar PDF</button><button class="btn ghost" id="osave">Salvar</button><button class="btn ghost" data-go3="${rep}">+ Produtos</button><button class="btn ghost" id="oclr">Novo orçamento</button></div>`;
  const re=()=>orc.call(null);
  m.onclick=async e=>{const t=e.target; const r=t.closest('[data-r]'); if(r){ctx.rep=r.dataset.r; return orc()} const d=t.closest('[data-del]'); if(d){o.itens=o.itens.filter(i=>i.pid!=d.dataset.del); saveQ(o); return orc()}
    const g=t.closest('[data-go3]'); if(g) return go('rep',{rep}); const c=t.closest('[data-cli]'); if(c){const cl=(CLIS||[]).find(x=>x.cnpj===c.dataset.cli); o.cli={cnpj:cl.cnpj,n:cl.n,cid:cl.cid,ult:cl.reps[HIST_REP[rep]]||null}; if(o.cli.ult&&!o.prazo) o.prazo=o.cli.ult.ultimo_prazo||''; saveQ(o); return orc()}
    if(t.id==='usePz'){o.prazo=o.cli.ult.ultimo_prazo||''; saveQ(o); return orc()}
    if(t.id==='oclr'){if(confirm('Começar um novo orçamento desta representada? O atual fica salvo se você tiver tocado em Salvar.')){const q=Q(); delete q[rep]; setQ(q); go('home')}}
    if(t.id==='osave'){await salvar(o,sub+ipi+fr,'rascunho'); toast('Orçamento salvo')}
    if(t.id==='opdf'){t.disabled=true; try{await pdf(o,rows,{sub,ipi,fr,tab,tr:tr[o.transp]}); await salvar(o,sub+ipi+fr,'enviado')}catch(err){toast('Erro no PDF: '+err.message)} t.disabled=false}};
  m.onchange=e=>{const t=e.target; if(t.dataset.oq){const it=o.itens.find(i=>i.pid==t.dataset.oq); it.qt=Math.max(0,+t.value||0); if(!it.qt) o.itens=o.itens.filter(i=>i!==it); saveQ(o); orc()}
    if(t.id==='otab'){o.tabela=+t.value; saveQ(o); orc()} if(t.id==='opz'){o.prazo=t.value; saveQ(o)} if(t.id==='oobs'){o.obs=t.value; saveQ(o)} if(t.id==='otr'){o.transp=+t.value; saveQ(o); orc()}};
  let tt; $('#cq').oninput=e=>{clearTimeout(tt); tt=setTimeout(async()=>{const v=norm(e.target.value); const C2=await clientes(); const d=v.replace(/\D/g,''); const r=v.length<2?[]:C2.filter(c=>norm(c.n+' '+c.cid).includes(v)||(d.length>=4&&c.cnpj.includes(d))).slice(0,8);
    $('#cres').innerHTML=r.map(c=>`<button class="chip" style="display:block;width:100%;text-align:left;margin:4px 0" data-cli="${c.cnpj}"><b>${esc(c.n)}</b> · ${esc(c.cid||'')}${c.reps[HIST_REP[rep]]?' · já compra '+esc(repName(rep)):''}</button>`).join('')},250)}}
async function salvar(o,total,sit){try{await api('orcamentos?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:sess.uid.slice(0,8)+'-'+o.rep+'-'+o.id,app:o.rep,cliente:o.cli&&o.cli.n,cnpj:o.cli&&o.cli.cnpj,total:Math.round(total*100)/100,itens:o.itens.length,situacao:sit,dados:o,atualizado_em:new Date().toISOString()})})}catch(e){toast('Salvo no aparelho; sincroniza depois')}}

/* ---------- PDF ---------- */
function loadJsPDF(){return window.jspdf?Promise.resolve():new Promise((ok,bad)=>{const s=document.createElement('script');s.src='jspdf.umd.min.js';s.onload=ok;s.onerror=()=>bad(new Error('sem gerador de PDF'));document.head.appendChild(s)})}
async function imgData(url,maxW){try{const r=await fetch(url); if(!r.ok) return null; const b=await r.blob(); const bm=await createImageBitmap(b); const sc=Math.min(1,maxW/bm.width); const c=document.createElement('canvas'); c.width=Math.round(bm.width*sc); c.height=Math.round(bm.height*sc); const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(bm,0,0,c.width,c.height); return {d:c.toDataURL('image/jpeg',.85),w:c.width,h:c.height}}catch(e){return null}}
async function pdf(o,rows,t){if(!rows.length) throw new Error('sem itens'); await loadJsPDF(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4',orientation:'landscape'}); const W=297,H=210,M=10; const NAVY=[28,35,64],GOLD=[242,182,50],GREY=[90,96,118];
  const logo=await imgData('logo.jpg',900); const num=new Date().toISOString().replace(/\D/g,'').slice(2,12);
  const head=()=>{doc.setFillColor(...NAVY); doc.rect(0,0,W,24,'F'); if(logo) doc.addImage(logo.d,'JPEG',M,3,50,18); doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text('ORÇAMENTO · '+repName(o.rep).toUpperCase(),W-M,11,{align:'right'}); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.text(`Nº ${num} · ${new Date().toLocaleDateString('pt-BR')} · ${(perfil&&perfil.nome)||''}`,W-M,17,{align:'right'}); doc.setFillColor(...GOLD); doc.rect(0,24,W,1,'F')};
  head(); let y=32; doc.setTextColor(30); doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.text('Cliente: ',M,y); doc.setFont('helvetica','normal'); doc.text(o.cli?`${o.cli.n} · CNPJ ${o.cli.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')} · ${o.cli.cid||''}`:'—',M+14,y);
  y+=5; doc.setFont('helvetica','bold'); doc.text('Prazo: ',M,y); doc.setFont('helvetica','normal'); doc.text(o.prazo||'a combinar',M+14,y); doc.setFont('helvetica','bold'); doc.text('Tabela: ',M+80,y); doc.setFont('helvetica','normal'); doc.text(t.tab?t.tab.nome:'',M+94,y); if(t.tr){doc.setFont('helvetica','bold'); doc.text('Frete: ',M+170,y); doc.setFont('helvetica','normal'); doc.text(t.tr.n,M+182,y)}
  y+=7; const cols=[['Código',M],['Descrição',M+30],['EAN',M+128],['NCM',M+157],['IPI %',M+186,'r'],['ICMS %',M+202,'r'],['Qtd.',M+218,'r'],['Unit. s/ IPI',M+244,'r'],['Total s/ IPI',W-M,'r']];
  const th=()=>{doc.setFillColor(238,240,246); doc.rect(M,y-4,W-2*M,6,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...NAVY); cols.forEach(([l,x,a])=>doc.text(l,x+(a?0:1),y,a?{align:'right'}:{})); y+=6};
  th(); doc.setFont('helvetica','normal'); doc.setFontSize(8.3); doc.setTextColor(30);
  rows.forEach(r=>{const d=doc.splitTextToSize(String(r.p.descricao||''),95).slice(0,2); if(y+d.length*3.6>H-30){doc.addPage(); head(); y=32; th(); doc.setFont('helvetica','normal'); doc.setFontSize(8.3); doc.setTextColor(30)}
    doc.text(String(r.p.cod||''),M+1,y); doc.text(d,M+30,y); doc.text(String(r.p.attrs&&r.p.attrs.ean||''),M+128,y); doc.text(String(r.p.ncm||''),M+157,y); doc.text(pct(r.p.ipi),M+186,y,{align:'right'}); doc.text(r.icms!=null?pct(r.icms):'',M+202,y,{align:'right'});
    doc.text(String(r.i.qt),M+218,y,{align:'right'}); doc.text(brl(r.pu),M+244,y,{align:'right'}); doc.text(brl(r.tot),W-M,y,{align:'right'}); y+=d.length*3.6+1.6; doc.setDrawColor(230); doc.line(M,y-2.6,W-M,y-2.6)});
  y+=3; const box=(l,v,b)=>{doc.setFont('helvetica',b?'bold':'normal'); doc.setFontSize(b?12:9.5); doc.setTextColor(...(b?NAVY:[30,30,30])); doc.text(l,W-M-70,y); doc.text(v,W-M,y,{align:'right'}); y+=b?7:5};
  box('Subtotal (sem IPI)',brl(t.sub)); box('IPI',brl(t.ipi)); if(t.fr) box(`Frete estimado (${pct(t.tr.p)})`,brl(t.fr)); box('TOTAL',brl(t.sub+t.ipi+t.fr),true);
  if(o.obs){doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text(doc.splitTextToSize('Observações: '+o.obs,W-2*M-90),M,y-10)}
  doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text('Preços sem IPI; IPI destacado conforme alíquota de cada item. ICMS conforme tabela/UF. Sujeito à confirmação de estoque e prazo de entrega da fábrica.',M,H-6);
  doc.save(`Orcamento_${repName(o.rep)}_${o.cli?o.cli.n.split(' ')[0]:'cliente'}.pdf`); toast('PDF salvo')}

/* ---------- produtos e tabelas (gestor) ---------- */
const COLS={cod:['codigo','código','cod','sku','referencia'],desc:['descricao','descrição','descrição do produto','produto','nome'],un:['unidade','un','und'],mult:['qtd multiplo','multiplo','múltiplo','qtd múltiplo'],base:['tabela base','preco bruto','preço bruto','bruto'],liq:['preço de custo','preco de custo','preço','preco','valor','preço líquido','preco liquido'],ncm:['ncm'],ean:['código de barras','codigo de barras','ean','gtin'],ipi:['ipi (%)','ipi','% ipi'],st:['st (%)','st'],icms:['icms (%)','icms'],obs:['observacoes','observações','obs'],prazo:['prazo entrega','prazo de entrega','lead time'],img:['imagem','foto','image','url imagem']};
const keyOf=h=>{const n=String(h||'').trim().toLowerCase(); for(const k in COLS) if(COLS[k].includes(n)) return k; return null};
const nameFromFile=f=>{const m=f.match(/reprio_(.+?)_(\w{2})_\d{4}/i); return m?(m[1].replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())+' '+m[2].toUpperCase()):f.replace(/\.\w+$/,'')};
async function admin(){const m=$('#main'); if(!ehGestor()){m.innerHTML='<p class="hint">Só gestores.</p>';return} const R=await reps();
  const rep=ctx.rep||L('admRep')||'marcon';
  m.innerHTML=`<div class="sec">Produtos e tabelas</div><div class="row"><select id="arep">${R.map(r=>`<option value="${r.id}"${r.id===rep?' selected':''}>${esc(r.nome)}</option>`).join('')}</select><button class="chip on" data-t="imp">Importar planilhas</button><button class="chip" data-t="ed">Editar produto</button><button class="chip" data-t="tb">Tabelas</button></div><div id="adm" style="margin-top:12px"></div>`;
  $('#arep').onchange=e=>{LS('admRep',e.target.value); ctx.rep=e.target.value; admin()};
  m.querySelector('.row').onclick=e=>{const b=e.target.closest('[data-t]'); if(!b) return; m.querySelectorAll('[data-t]').forEach(x=>x.classList.toggle('on',x===b)); ({imp:admImp,ed:admEd,tb:admTab})[b.dataset.t](rep)};
  admImp(rep)}
function admImp(rep){const a=$('#adm'); a.innerHTML=`<div class="card grid"><p class="hint">Suba uma ou várias planilhas (uma por tabela de preço). O nome da tabela vem do arquivo e pode ser ajustado. Nada é gravado antes da sua aprovação.</p>
  <input id="files" type="file" accept=".xlsx,.xls,.csv" multiple style="width:100%"><div id="prev"></div></div>`;
  $('#files').onchange=async e=>{const fs=[...e.target.files]; if(!fs.length) return; const pv=$('#prev'); pv.innerHTML='<p class="hint">Lendo planilhas…</p>'; const C=await catalog(rep,true).catch(()=>[]); const T=await tabelas(rep,true);
    const jobs=[]; for(const f of fs){const wb=XLSX.read(await f.arrayBuffer()); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}); let hi=rows.findIndex(r=>r.some(c=>keyOf(c)==='cod')); if(hi<0) hi=0;
      const map={}; rows[hi].forEach((h,i)=>{const k=keyOf(h); if(k&&map[k]==null) map[k]=i}); const items=rows.slice(hi+1).filter(r=>String(r[map.cod]??'').trim()).map(r=>{const g=k=>map[k]!=null?r[map[k]]:''; const num=v=>{if(typeof v==='number') return v; const s=String(v).replace(/[^\d,.-]/g,''); return s?+(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s):null};
        return {cod:String(g('cod')).trim(),desc:String(g('desc')).trim(),un:String(g('un')).trim(),mult:num(g('mult'))||1,base:num(g('base')),liq:num(g('liq')),ncm:String(g('ncm')).trim(),ean:String(g('ean')).trim(),ipi:num(g('ipi')),st:num(g('st')),icms:num(g('icms')),obs:String(g('obs')).trim(),prazo:String(g('prazo')).trim(),img:String(g('img')).trim()}});
      const nome=nameFromFile(f.name); const tab=T.find(t=>norm(t.nome)===norm(nome)); jobs.push({f:f.name,nome,map,items,tab})}
    // prévia
    const byCod={}; C.forEach(p=>byCod[p.cod]=p);
    for(const j of jobs){const old=j.tab?await prices(j.tab.id,true):{}; let novos=0,sub=0,desc=0,igual=0; const ch=[]; j.items.forEach(it=>{const p=byCod[it.cod]; if(!p){novos++; return} const o=(old[p.id]||{}).liq; if(o==null){novos++; return} const d=it.liq-o; if(Math.abs(d)<.005) igual++; else {d>0?sub++:desc++; ch.push({cod:it.cod,desc:it.desc,o,n:it.liq,p:o?d/o*100:0})}});
      const sai=j.tab?Object.keys(old).filter(pid=>{const p=C.find(x=>x.id==pid); return p&&!j.items.some(i=>i.cod===p.cod)}).length:0; Object.assign(j,{novos,sub,desc,igual,ch,sai})}
    const miss=jobs.filter(j=>j.map.cod==null||j.map.liq==null);
    pv.innerHTML=`${miss.length?`<p class="bad">Não reconheci as colunas de código/preço em: ${miss.map(j=>esc(j.f)).join(', ')}</p>`:''}
     <div style="overflow-x:auto"><table class="t"><tr><th>Arquivo</th><th>Tabela</th><th class="n">Itens</th><th class="n">Novos</th><th class="n">Subiram</th><th class="n">Caíram</th><th class="n">Iguais</th><th class="n">Saíram</th></tr>
     ${jobs.map((j,k)=>`<tr><td><small>${esc(j.f)}</small></td><td><input data-tn="${k}" value="${esc(j.nome)}" style="padding:6px;width:170px">${j.tab?'':' <small class="warn">nova</small>'}</td><td class="n">${j.items.length}</td><td class="n">${j.novos}</td><td class="n bad">${j.sub}</td><td class="n ok">${j.desc}</td><td class="n">${j.igual}</td><td class="n">${j.sai}</td></tr>`).join('')}</table></div>
     ${jobs.some(j=>j.ch.length)?`<details style="margin-top:8px"><summary class="hint">Ver mudanças de preço (${jobs.reduce((s,j)=>s+j.ch.length,0)})</summary><div class="diff"><table class="t"><tr><th>Tabela</th><th>Código</th><th class="n">Antes</th><th class="n">Agora</th><th class="n">%</th></tr>${jobs.flatMap(j=>j.ch.slice(0,300).map(c=>`<tr><td>${esc(j.nome)}</td><td>${esc(c.cod)}</td><td class="n">${brl(c.o)}</td><td class="n">${brl(c.n)}</td><td class="n ${c.p>0?'bad':'ok'}">${c.p.toFixed(1)}%</td></tr>`)).join('')}</table></div></details>`:''}
     <div class="row" style="margin-top:10px"><button class="btn" id="aprov">Aprovar e gravar</button><span class="hint" id="aprSt"></span></div>`;
    pv.oninput=e=>{const i=e.target.closest('[data-tn]'); if(i) jobs[+i.dataset.tn].nome=i.value};
    $('#aprov').onclick=async()=>{const b=$('#aprov'); b.disabled=true; const st=$('#aprSt');
      try{// produtos: união de todos os arquivos (último vence)
        const prod={}; jobs.forEach(j=>j.items.forEach(it=>{prod[it.cod]={rep,cod:it.cod,ref:it.cod,descricao:it.desc,un:it.un||null,mult:Math.max(1,Math.round(it.mult||1)),ncm:it.ncm||null,ipi:it.ipi,img:it.img||(byCod[it.cod]||{}).img||null,ativo:true,attrs:{...((byCod[it.cod]||{}).attrs||{}),ean:it.ean||null,prazo:it.prazo||null,st:it.st,obs:it.obs||null},atualizado_em:new Date().toISOString()}}));
        const arr=Object.values(prod); const ids={}; for(let i=0;i<arr.length;i+=400){st.textContent=`Gravando produtos ${i}/${arr.length}…`; const r=await api('produtos?on_conflict=rep,cod&select=id,cod',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(arr.slice(i,i+400))}); r.forEach(x=>ids[x.cod]=x.id)}
        for(const j of jobs){let tid=j.tab&&norm(j.tab.nome)===norm(j.nome)?j.tab.id:null; if(!tid){const r=await api('tabelas?on_conflict=rep,nome&select=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{rep,nome:j.nome,vigencia:new Date().toISOString().slice(0,10),ativa:true}])}); tid=r[0].id}
          const pr=[]; j.items.forEach(it=>{const pid=ids[it.cod]; if(!pid) return; if(it.liq!=null) pr.push({tabela_id:tid,produto_id:pid,nivel:'liq',preco:it.liq}); if(it.base!=null) pr.push({tabela_id:tid,produto_id:pid,nivel:'base',preco:it.base}); if(it.icms!=null) pr.push({tabela_id:tid,produto_id:pid,nivel:'icms',preco:it.icms})});
          for(let i=0;i<pr.length;i+=800){st.textContent=`Tabela ${j.nome}: preços ${i}/${pr.length}…`; await api('precos?on_conflict=tabela_id,produto_id,nivel',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(pr.slice(i,i+800).map(x=>({...x,atualizado_em:new Date().toISOString()})))})}
          if(j.tab){const keep=new Set(j.items.map(it=>ids[it.cod])); const gone=Object.keys(await prices(tid,true)).filter(pid=>!keep.has(+pid)); for(let i=0;i<gone.length;i+=100) await api(`precos?tabela_id=eq.${tid}&produto_id=in.(${gone.slice(i,i+100).join(',')})`,{method:'DELETE'})}
          delete PRICES[tid]}
        await api('alteracoes',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({rep,tipo:'importacao',resumo:jobs.map(j=>({arquivo:j.f,tabela:j.nome,itens:j.items.length,novos:j.novos,subiram:j.sub,cairam:j.desc,sairam:j.sai}))})}).catch(()=>{});
        delete CAT[rep]; delete TABS[rep]; REPS=null; st.textContent=''; toast('Importação concluída'); admImp(rep); $('#adm').insertAdjacentHTML('afterbegin',`<p class="ok">✓ ${jobs.length} tabela(s) e ${arr.length} produtos gravados.</p>`)}
      catch(err){st.textContent=''; toast('Erro: '+err.message); b.disabled=false}}}}
async function admEd(rep){const a=$('#adm'); a.innerHTML='<p class="hint">Carregando…</p>'; const C=await catalog(rep,true); const T=await tabelas(rep,true);
  a.innerHTML=`<div class="card grid"><input id="eq" type="search" placeholder="Buscar produto por código ou descrição"><div id="eres"></div><div id="eform"></div></div>`;
  $('#eq').oninput=e=>{const w=norm(e.target.value); $('#eres').innerHTML=w.length<2?'':C.filter(p=>norm(p.cod+' '+p.descricao).includes(w)).slice(0,12).map(p=>`<button class="chip" style="display:block;width:100%;text-align:left;margin:3px 0" data-e="${p.id}"><b>${esc(p.cod)}</b> ${esc(p.descricao)}</button>`).join('')};
  a.onclick=async e=>{const b=e.target.closest('[data-e]'); if(!b) return; const p=C.find(x=>x.id==b.dataset.e); $('#eres').innerHTML=''; const PR={}; for(const t of T) PR[t.id]=(await prices(t.id))[p.id]||{};
    $('#eform').innerHTML=`<div class="sec" style="font-size:18px">${esc(p.cod)}</div><div class="grid"><label class="f">Descrição<input id="fd" value="${esc(p.descricao)}"></label>
     <div class="r2"><label class="f">Unidade<input id="fu" value="${esc(p.un||'')}"></label><label class="f">Múltiplo<input id="fm" type="number" value="${p.mult||1}"></label><label class="f">IPI %<input id="fi" type="number" step="0.01" value="${p.ipi??''}"></label><label class="f">NCM<input id="fn" value="${esc(p.ncm||'')}"></label>
     <label class="f">EAN<input id="fe" value="${esc(p.attrs&&p.attrs.ean||'')}"></label><label class="f">Prazo de entrega (dias)<input id="fp" value="${esc(p.attrs&&p.attrs.prazo||'')}"></label></div>
     <label class="f">Link da foto<input id="fimg" value="${esc(p.img||'')}"></label><label class="f" style="display:flex;gap:8px;align-items:center"><input id="fat" type="checkbox"${p.ativo!==false?' checked':''}> Produto ativo</label>
     <table class="t"><tr><th>Tabela</th><th class="n">Bruto</th><th class="n">Líquido (orçamento)</th></tr>${T.map(t=>`<tr><td>${esc(t.nome)}</td><td class="n"><input data-pb="${t.id}" type="number" step="0.01" value="${PR[t.id].base??''}" style="width:110px;padding:6px"></td><td class="n"><input data-pl="${t.id}" type="number" step="0.01" value="${PR[t.id].liq??''}" style="width:110px;padding:6px"></td></tr>`).join('')}</table>
     <button class="btn" id="fsave">Salvar alterações</button></div>`;
    $('#fsave').onclick=async()=>{try{await api(`produtos?id=eq.${p.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({descricao:$('#fd').value,un:$('#fu').value,mult:+$('#fm').value||1,ipi:$('#fi').value===''?null:+$('#fi').value,ncm:$('#fn').value,img:$('#fimg').value||null,ativo:$('#fat').checked,attrs:{...(p.attrs||{}),ean:$('#fe').value||null,prazo:$('#fp').value||null},atualizado_em:new Date().toISOString()})});
      const pr=[]; T.forEach(t=>{const b=document.querySelector(`[data-pb="${t.id}"]`).value, l=document.querySelector(`[data-pl="${t.id}"]`).value; if(b!=='') pr.push({tabela_id:t.id,produto_id:p.id,nivel:'base',preco:+b}); if(l!=='') pr.push({tabela_id:t.id,produto_id:p.id,nivel:'liq',preco:+l})});
      if(pr.length) await api('precos?on_conflict=tabela_id,produto_id,nivel',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(pr)});
      await api('alteracoes',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({rep,tipo:'edicao',resumo:{cod:p.cod}})}).catch(()=>{});
      T.forEach(t=>delete PRICES[t.id]); delete CAT[rep]; toast('Produto atualizado')}catch(err){toast('Erro: '+err.message)}}}}
async function admTab(rep){const a=$('#adm'); const T=await api(`tabelas?select=*&rep=eq.${rep}&order=nome`); const H=await api(`alteracoes?select=*&rep=eq.${rep}&order=criado_em.desc&limit=10`).catch(()=>[]);
  a.innerHTML=`<div class="card"><table class="t"><tr><th>Tabela</th><th>Vigência</th><th>Ativa</th></tr>${T.map(t=>`<tr><td>${esc(t.nome)}</td><td>${esc(t.vigencia||'')}</td><td><input type="checkbox" data-at="${t.id}"${t.ativa?' checked':''} aria-label="Ativa"></td></tr>`).join('')||'<tr><td colspan="3">Nenhuma tabela.</td></tr>'}</table></div>
   <div class="card" style="margin-top:12px"><b>Últimas alterações</b>${H.map(h=>`<p class="hint">${new Date(h.criado_em).toLocaleString('pt-BR')} · ${esc(h.tipo)} · ${esc(JSON.stringify(h.resumo).slice(0,160))}</p>`).join('')||'<p class="hint">Nenhuma.</p>'}</div>`;
  a.onchange=async e=>{const c=e.target.closest('[data-at]'); if(c){await api(`tabelas?id=eq.${c.dataset.at}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ativa:c.checked})}); delete TABS[rep]; toast('Tabela '+(c.checked?'ativada':'desativada'))}}}

/* ---------- início ---------- */
badge(); if(sess) afterLogin(); else showLock();
})();
