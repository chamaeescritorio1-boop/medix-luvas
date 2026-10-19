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
function go(r,c){route=r; ctx=c||{}; LS('route',r==='rep'?'home':r); document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===r)); window.scrollTo(0,0); ({home,rep:repView,orc,admin,ped,rel}[r]||home)()}
$('#homeLnk').onclick=e=>{e.preventDefault(); go('home')}; $('#homeBtn').onclick=()=>go('home');
$('#nav').onclick=e=>{const b=e.target.closest('[data-go]'); if(b) go(b.dataset.go)};

/* ---------- início ---------- */
async function home(){const m=$('#main'); m.innerHTML='<p class="hint">Carregando…</p>'; let R; try{R=await reps()}catch(e){m.innerHTML=`<p class="bad">Não consegui carregar: ${esc(e.message)}</p><p class="hint">Rodou o arquivo 2_produtos_tabelas.sql no Supabase?</p>`;return}
  const q=Q(); m.innerHTML=`<div class="sec">Representadas</div><div class="reps">${R.filter(r=>r.ativa).map(r=>{const ext=EXTERNAL[r.id]; const on=r.n||ext; const qn=(q[r.id]||{itens:[]}).itens.length;
     return `<button class="rep${on?'':' off'}" style="--c:${esc(r.cor||'#2a3157')}" data-rep="${esc(r.id)}"><b>${esc(r.nome)}</b><small>${r.n?r.n+' produtos':ext?'App próprio (por enquanto)':'Em breve'}${qn?` · <span class="badge">${qn}</span> no orçamento`:''}</small></button>`}).join('')}</div>
   <div class="sec" style="margin-top:20px">Atalhos</div><div class="row"><a class="btn ghost" href="/medix-luvas/teste/">Clientes, inativos e painel ↗</a>${ehGestor()?'<button class="btn ghost" data-go2="admin">Produtos e tabelas</button>':''}</div>`;
  m.onclick=e=>{const b=e.target.closest('[data-rep]'); if(b){const id=b.dataset.rep, r=R.find(x=>x.id===id); if(r.n) go('rep',{rep:id}); else if(EXTERNAL[id]) location.href=EXTERNAL[id]; return} const a=e.target.closest('[data-go2]'); if(a) go(a.dataset.go2)}}

/* ---------- grupos de produto ---------- */
const GRUPOS={marcon:[['Hidráulicos e elevação',/^CARRO.*(PANTOGRAF|TELESC|HIDRAUL|GUINCHO|ELEVA|MACACO)/],['Movimentação de carga',/^CARRO.*(PLATAFORMA|CARGA|ARMAZEM|TRANSPORTE DE)/],['Caixas e baús',/^(CAIXA|BAU|BAÚ|MALETA|ESTOJO|BOLSA|MOCHILA|MALA)\b/],['Carros de ferramentas',/^(CARRO|CARRINHO)\b/],['Móveis de oficina',/^(BANCADA|ARMARIO|ARMÁRIO|ARM\b|GAVETEIRO|MODULO|MÓDULO|TAMPO|PAINEL|DIVISORIA|GAB|PRANCHETA|BANDEJA)/],
 ['Estantes e armazenagem',/^(ESTANTE|ESTRUTURA|PRATELEIRA|RACK|COLUNA|EXTENS)/],['Hidráulicos e elevação',/^(MACACO|PRENSA|GUINCHO|TALHA|ELEVADOR|CAVALETE|ESTICADOR|ESTICAPUXADOR|PUXADOR|PLATAFORMA|ALINHADOR|ALINH|SACA|ENCOLHEDOR|ENTONADOR|CURVADOR)/],
 ['Movimentação de carga',/^(TRANSPALETE|TRANSP|EMPILHADEIRA|GARFO|ESTEIRA|TRANSPORTADOR|CACAMBA)/],['Rodas e rodízios',/^(RODA|RODIZIO|RODÍZIO|EIXO|ARO|ROLAMENTO)/],['Morsas, tornos e fixação',/^(TORNO|MORSA|GRAMPO|BIGORNA)/],['Lavadoras e bombas',/^(LAVADORA|ELETROBOMBA|MOTOBOMBA|ECOLIMP|MOTO)/]]};
const grupoAuto=(rep,d)=>{const n=norm(d).trim(); for(const [g,r] of (GRUPOS[rep]||[])) if(r.test(n)) return g; return 'Outros'};
const grupoOf=(rep,p)=>p.grupo||grupoAuto(rep,p.descricao);

/* ---------- cliente → tabela ---------- */
async function tabelaDoCliente(rep,cli,T){if(!cli) return null; const k=rep+'|'+cli.cnpj;
  try{const r=await api(`cliente_tabela?select=tabela_id&rep=eq.${rep}&cnpj=eq.${cli.cnpj}`); if(r[0]&&T.some(t=>t.id==r[0].tabela_id)) return r[0].tabela_id}catch(e){const m=(L('cliTab')||{})[k]; if(m&&T.some(t=>t.id==m)) return m}
  const n=norm(cli.n), uf=(cli.uf||'SP'); const kw=[['GURGEL','GURGELMIX'],['PALACIO','PALACIO'],['COPERCANA','COPERCANA'],['SBARDEL','SBARDELINI'],['OXIMAQ','OXIMAQ']].find(([a])=>n.includes(a));
  const pick=pre=>T.find(t=>norm(t.nome).startsWith(pre)&&norm(t.nome).endsWith(' '+uf))||T.find(t=>norm(t.nome).startsWith(pre));
  const t=(kw&&pick(kw[1]))||pick('GERAL'); return t?t.id:null}
async function lembrarTabela(rep,cli,tid){if(!cli||!tid) return; const m=L('cliTab')||{}; m[rep+'|'+cli.cnpj]=tid; LS('cliTab',m);
  try{await api('cliente_tabela?on_conflict=cnpj,rep',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({cnpj:cli.cnpj,rep,tabela_id:tid})})}catch(e){}}
async function escolherCliente(rep,o,cnpj){const C2=await clientes(); const cl=C2.find(x=>x.cnpj===cnpj); if(!cl) return; o.cli={cnpj:cl.cnpj,n:cl.n,cid:cl.cid,ult:cl.reps[HIST_REP[rep]]||null}; if(o.cli.ult&&!o.prazo) o.prazo=o.cli.ult.ultimo_prazo||'';
  const T=await tabelas(rep); const tid=await tabelaDoCliente(rep,o.cli,T); if(tid&&tid!=o.tabela){o.tabela=tid; toast('Tabela do cliente: '+(T.find(t=>t.id==tid)||{}).nome)} saveQ(o)}
function cliBusca(inp,res,rep){let tt; inp.oninput=e=>{clearTimeout(tt); tt=setTimeout(async()=>{const v=norm(e.target.value); const C2=await clientes(); const d=v.replace(/\D/g,''); const r=v.length<2?[]:C2.filter(c=>norm(c.n+' '+c.cid).includes(v)||(d.length>=4&&c.cnpj.includes(d))).slice(0,8);
  res.innerHTML=r.map(c=>`<button class="chip" style="display:block;width:100%;text-align:left;margin:4px 0" data-cli="${c.cnpj}"><b>${esc(c.n)}</b> · ${esc(c.cid||'')}${c.reps[HIST_REP[rep]]?' · já compra '+esc(repName(rep)):''}</button>`).join('')},250)}}

/* ---------- módulo da representada: catálogo ---------- */
async function repView(){const rep=ctx.rep; const m=$('#main'); m.innerHTML='<p class="hint">Carregando catálogo…</p>';
  let C,T; try{[C,T]=await Promise.all([catalog(rep),tabelas(rep)])}catch(e){m.innerHTML=`<p class="bad">${esc(e.message)}</p>`;return}
  const o=curQ(rep); if(!o.tabela&&T.length){o.tabela=T[0].id; saveQ(o)} const P=o.tabela?await prices(o.tabela):{};
  const grupos=[...new Set(C.map(p=>grupoOf(rep,p)))].sort((a,b)=>a==='Outros'?1:b==='Outros'?-1:a.localeCompare(b));
  const enc=L('enc_'+rep)||{on:false,sel:[]}; let qtxt='', gsel=L('grp_'+rep)||'';
  const render=()=>{const w=norm(qtxt).split(/\s+/).filter(Boolean); const list=C.filter(p=>(!gsel||grupoOf(rep,p)===gsel)&&(!w.length||w.every(x=>norm(p.cod+' '+p.descricao+' '+(p.attrs&&p.attrs.ean||'')).includes(x)))).filter(p=>!o.tabela||P[p.id]);
    $('#pl').innerHTML=list.slice(0,80).map(p=>{const pr=P[p.id]||{}; const inQ=o.itens.find(i=>i.pid===p.id); const es=enc.sel.includes(p.id);
      return `<div class="card pc"${enc.on&&es?' style="border-color:var(--accent);border-width:2px"':''}><img src="${esc(p.img||'')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div style="display:grid;gap:5px;min-width:0"><div class="cod">${esc(p.cod)}</div><div class="d">${esc(p.descricao)}</div>
       <div class="pr">${brl(pr.liq)}<small> /${esc((p.un||'un').toLowerCase())} s/ IPI</small></div><div class="tags"><span class="tag">${esc(grupoOf(rep,p))}</span><span class="tag">IPI ${pct(p.ipi)}</span>${p.attrs&&p.attrs.prazo?`<span class="tag">Entrega ${esc(p.attrs.prazo)} dias</span>`:''}${p.mult>1?`<span class="tag">múlt. ${p.mult}</span>`:''}</div>
       ${enc.on?`<button class="${es?'btn':'btn ghost'} sm" data-es="${p.id}">${es?'✓ No encarte':'+ Encarte'}</button>`:`<div class="row"><div class="qty"><button data-m="${p.id}" aria-label="Menos">−</button><input data-q="${p.id}" type="number" inputmode="numeric" min="0" value="${inQ?inQ.qt:''}" placeholder="0" aria-label="Quantidade"><button data-p="${p.id}" aria-label="Mais">+</button></div></div>`}</div></div>`}).join('')||'<p class="hint">Nenhum produto.</p>';
    $('#cnt').textContent=`${list.length} produtos${list.length>80?' · mostrando 80, refine a busca':''}`; $('#encBar').hidden=!enc.on; $('#encN').textContent=enc.sel.length};
  m.innerHTML=`<div class="row" style="justify-content:space-between"><div class="sec" style="margin:0">${esc(repName(rep))}</div><div class="row"><button class="chip${enc.on?' on':''}" id="encT">Encarte</button><button class="btn sm" data-go2="orc">Orçamento (${o.itens.length})</button></div></div>
   <div class="card grid" style="margin:10px 0"><label class="f">Cliente<input id="cq" type="search" placeholder="Buscar cliente por nome, CNPJ ou cidade" value="${o.cli?esc(o.cli.n):''}"></label><div id="cres"></div>
    ${o.cli&&o.cli.ult?`<p class="hint" style="margin:0">Último pedido: ${esc(String(o.cli.ult.ultimo||'').split('-').reverse().join('/'))} · prazo ${esc(o.cli.ult.ultimo_prazo||'—')}</p>`:''}
    <div class="r2"><label class="f">Tabela de preço${o.cli?' (do cliente)':''}<select id="tab">${T.map(t=>`<option value="${t.id}"${t.id==o.tabela?' selected':''}>${esc(t.nome)}</option>`).join('')||'<option value="">Nenhuma tabela importada</option>'}</select></label>
    <label class="f">Buscar produto<input id="q" type="search" placeholder="Código, descrição ou EAN"></label></div></div>
   <div class="row" style="margin-bottom:8px"><button class="chip${!gsel?' on':''}" data-g="">Todos</button>${grupos.map(g=>`<button class="chip${g===gsel?' on':''}" data-g="${esc(g)}">${esc(g)} (${C.filter(p=>grupoOf(rep,p)===g).length})</button>`).join('')}</div>
   <div class="card row" id="encBar" style="position:sticky;top:64px;z-index:3;margin-bottom:10px;justify-content:space-between" hidden><span><b id="encN">0</b> no encarte</span><div class="row"><button class="btn ghost sm" id="encAll">Selecionar todos da lista</button><button class="btn ghost sm" id="encClr">Limpar</button><button class="btn sm" id="encCat">PDF catálogo</button><button class="btn sm" id="encPromo">PDF promoção</button></div></div>
   <p class="hint" id="cnt"></p><div class="pl" id="pl"></div>`;
  cliBusca($('#cq'),$('#cres'),rep);
  $('#tab').onchange=async e=>{if(o.itens.length&&!confirm('Trocar a tabela recalcula os preços do orçamento desta representada. Continuar?')){e.target.value=o.tabela;return} o.tabela=+e.target.value; saveQ(o); lembrarTabela(rep,o.cli,o.tabela); repView()};
  let t; $('#q').oninput=e=>{clearTimeout(t); t=setTimeout(()=>{qtxt=e.target.value; render()},200)};
  const setQt=(pid,v)=>{const p=C.find(x=>x.id===pid); const mult=p.mult||1; v=Math.max(0,Math.round(v/mult)*mult||0); let it=o.itens.find(i=>i.pid===pid); if(v&&!it){it={pid,qt:0}; o.itens.push(it)} if(it){it.qt=v; if(!v) o.itens=o.itens.filter(i=>i!==it)} saveQ(o); const inp=document.querySelector(`[data-q="${pid}"]`); if(inp) inp.value=v||''; m.querySelector('[data-go2]').textContent=`Orçamento (${o.itens.length})`};
  const curList=()=>{const w=norm(qtxt).split(/\s+/).filter(Boolean); return C.filter(p=>(!gsel||grupoOf(rep,p)===gsel)&&(!w.length||w.every(x=>norm(p.cod+' '+p.descricao).includes(x)))&&P[p.id])};
  m.onclick=async e=>{const tg=e.target; const a=tg.closest('[data-go2]'); if(a) return go('orc',{rep});
    const c=tg.closest('[data-cli]'); if(c){await escolherCliente(rep,o,c.dataset.cli); return repView()}
    const g=tg.closest('[data-g]'); if(g){gsel=g.dataset.g; LS('grp_'+rep,gsel); m.querySelectorAll('[data-g]').forEach(x=>x.classList.toggle('on',x===g)); return render()}
    if(tg.id==='encT'){enc.on=!enc.on; LS('enc_'+rep,enc); tg.classList.toggle('on',enc.on); return render()}
    const es=tg.closest('[data-es]'); if(es){const id=+es.dataset.es; enc.sel=enc.sel.includes(id)?enc.sel.filter(x=>x!==id):[...enc.sel,id]; LS('enc_'+rep,enc); return render()}
    if(tg.id==='encAll'){const ids=curList().map(p=>p.id); enc.sel=[...new Set([...enc.sel,...ids])]; LS('enc_'+rep,enc); toast(ids.length+' adicionados — toque para tirar os que não quiser'); return render()}
    if(tg.id==='encClr'){enc.sel=[]; LS('enc_'+rep,enc); return render()}
    if(tg.id==='encCat'||tg.id==='encPromo'){const its=enc.sel.map(id=>C.find(p=>p.id===id)).filter(Boolean); if(!its.length) return toast('Selecione produtos para o encarte'); return tg.id==='encCat'?encCatalogo(rep,o,its,P,tg):encPromoForm(rep,o,its,P)}
    const mi=tg.closest('[data-m]'),pl=tg.closest('[data-p]'); if(mi||pl){const pid=+(mi||pl).dataset[mi?'m':'p']; const p=C.find(x=>x.id===pid); const cur=(o.itens.find(i=>i.pid===pid)||{}).qt||0; setQt(pid,cur+(pl?1:-1)*(p.mult||1))}};
  m.onchange=e=>{const i=e.target.closest('[data-q]'); if(i) setQt(+i.dataset.q,+i.value)};
  render()}

/* ---------- encartes (PDF) ---------- */
const PNAVY=[28,35,64],PGOLD=[242,182,50],PGREY=[74,80,104],PLINE=[223,226,236],PSOFT=[244,245,249];
const fitImg=(doc,im,x,y,w,h)=>{if(!im) return; const s=Math.min(w/im.w,h/im.h); doc.addImage(im.d,'JPEG',x+(w-im.w*s)/2,y+(h-im.h*s)/2,im.w*s,im.h*s)};
async function encCatalogo(rep,o,its,P,btn){btn.disabled=true; btn.textContent='Gerando…'; try{await loadJsPDF(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4'}); const W=210,H=297,M=12; const logo=await imgData('logo.jpg',900);
  const ims=[]; for(let i=0;i<its.length;i+=6) ims.push(...await Promise.all(its.slice(i,i+6).map(p=>p.img?imgData(p.img,500):null)));
  const head=()=>{doc.setFillColor(...PNAVY); doc.rect(0,0,W,30,'F'); if(logo) doc.addImage(logo.d,'JPEG',M,3,66,24); doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('CATÁLOGO '+repName(rep).toUpperCase(),W-M,12,{align:'right'}); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); if(o.cli) doc.text(doc.splitTextToSize('Para '+o.cli.n,85)[0],W-M,18,{align:'right'}); doc.text(new Date().toLocaleDateString('pt-BR')+((perfil&&perfil.nome)?'  ·  '+perfil.nome:''),W-M,23,{align:'right'}); doc.setFillColor(...PGOLD); doc.rect(0,30,W,1.2,'F')};
  const foot=(p,t)=>{doc.setDrawColor(...PGOLD); doc.setLineWidth(.6); doc.line(M,H-14,W-M,H-14); doc.setTextColor(...PGREY); doc.setFont('helvetica','normal'); doc.setFontSize(7.2); doc.text('Preços sem IPI (IPI destacado por item). Sujeito a alteração, disponibilidade e prazo de entrega da fábrica.',M,H-9.5); doc.text(`Chamae Representações · pág. ${p}/${t}`,W-M,H-5.5,{align:'right'})};
  const cols=3,gap=5,cw=(W-2*M-gap*2)/3,ch=74,top=37,per=9,pages=Math.ceil(its.length/per);
  its.forEach((p,i)=>{const pi=Math.floor(i/per),k=i%per; if(!k){if(pi) doc.addPage(); head(); foot(pi+1,pages)} const x=M+(k%cols)*(cw+gap), y=top+Math.floor(k/cols)*(ch+gap); const pr=(P[p.id]||{}).liq||0;
    doc.setDrawColor(...PLINE); doc.setLineWidth(.3); doc.roundedRect(x,y,cw,ch,3,3,'S'); doc.setFillColor(...PSOFT); doc.roundedRect(x+.3,y+.3,cw-.6,36,3,3,'F'); fitImg(doc,ims[i],x+4,y+3,cw-8,31);
    doc.setTextColor(...PNAVY); doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.text(String(p.cod),x+3,y+42); doc.setFont('helvetica','normal'); doc.setFontSize(7.4); doc.setTextColor(...PGREY); doc.text(doc.splitTextToSize(String(p.descricao||''),cw-6).slice(0,3),x+3,y+46.5);
    doc.setFontSize(6.8); doc.text(`IPI ${pct(p.ipi)}${p.mult>1?' · múlt. '+p.mult:''}${p.attrs&&p.attrs.prazo?' · entrega '+p.attrs.prazo+' dias':''}`,x+3,y+ch-12);
    doc.setDrawColor(...PLINE); doc.setLineDashPattern([1,1],0); doc.line(x+3,y+ch-10,x+cw-3,y+ch-10); doc.setLineDashPattern([],0);
    doc.setFontSize(6.8); doc.text(p.attrs&&p.attrs.ean?'EAN '+p.attrs.ean:'',x+3,y+ch-4.5); doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(...PNAVY); doc.text(brl(pr),x+cw-3,y+ch-4.3,{align:'right'})});
  doc.save(`Catalogo_${repName(rep)}${o.cli?'_'+o.cli.n.split(' ')[0]:''}.pdf`); toast('PDF salvo')}catch(e){toast('Erro: '+e.message)} btn.disabled=false; btn.textContent='PDF catálogo'}
function encPromoForm(rep,o,its,P){const ov=document.createElement('div'); ov.className='ov'; const pr=p=>(P[p.id]||{}).liq||0;
  ov.innerHTML=`<div class="sh"><div class="sec" style="font-size:20px">Promoção de volume</div><p class="hint">O primeiro item é o destaque; os demais entram como ofertas complementares. Use o preço da tabela ou digite um menor.</p>
   <label class="f">Válida até<input id="pv" type="date"></label>
   ${its.map((p,k)=>`<div class="card" style="margin-top:8px;display:grid;gap:6px"><b>${k?'Complementar':'Destaque'}: ${esc(p.cod)}</b><small class="hint">${esc(p.descricao)} · tabela ${brl(pr(p))}</small><div class="r2"><label class="f">Quantidade<input data-pq="${k}" type="number" inputmode="numeric" placeholder="${k?'':'ex.: 50'}"></label><label class="f">Preço da oferta (R$)<input data-pp="${k}" inputmode="decimal" value="${pr(p).toFixed(2).replace('.',',')}"></label></div></div>`).join('')}
   <div class="row" style="margin-top:12px"><button class="btn" id="pgo">Gerar PDF</button><button class="btn ghost" id="pno">Cancelar</button></div></div>`;
  document.body.appendChild(ov); $('#pno').onclick=()=>ov.remove();
  $('#pgo').onclick=async()=>{const num=v=>+String(v||'').replace(/\./g,'').replace(',','.')||0; const rows=its.map((p,k)=>({p,q:num(ov.querySelector(`[data-pq="${k}"]`).value),pr:num(ov.querySelector(`[data-pp="${k}"]`).value),de:pr(p)}));
    try{await encPromo(rep,o,rows,$('#pv').value); ov.remove()}catch(e){toast('Erro: '+e.message)}}}
async function encPromo(rep,o,rows,val){await loadJsPDF(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4'}); const W=210,H=297,M=12; const logo=await imgData('logo.jpg',900);
  const [m,...cs]=rows; const im=m.p.img?await imgData(m.p.img,900):null; const cim=await Promise.all(cs.map(c=>c.p.img?imgData(c.p.img,400):null));
  const bg=()=>{doc.setFillColor(...PNAVY); doc.rect(0,0,W,H,'F')}; bg(); if(logo) doc.addImage(logo.d,'JPEG',M,8,55,20);
  if(val){doc.setFont('helvetica','bold'); doc.setFontSize(9); const t='Válida até '+val.split('-').reverse().join('/'); const w=doc.getTextWidth(t)+8; doc.setFillColor(...PGOLD); doc.roundedRect(W-M-w,12,w,9,4.5,4.5,'F'); doc.setTextColor(...PNAVY); doc.text(t,W-M-w+4,17.9)}
  doc.setTextColor(255); doc.setFont('helvetica','normal'); doc.setFontSize(9.5); if(o.cli) doc.text(doc.splitTextToSize('Oferta exclusiva para '+o.cli.n,120)[0],M,35);
  doc.setFont('helvetica','bold'); doc.setFontSize(40); doc.text('OFERTA DE',M,52); doc.setTextColor(...PGOLD); doc.text('VOLUME',M+doc.getTextWidth('OFERTA DE '),52);
  doc.setTextColor(220); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(repName(rep)+' · preço especial para compra fechada',M,59);
  const by=66,bh=108; doc.setFillColor(255,255,255); doc.roundedRect(M,by,W-2*M,bh,6,6,'F'); doc.setFillColor(...PSOFT); doc.roundedRect(M,by,84,bh,6,6,'F'); doc.rect(M+78,by,6,bh,'F'); fitImg(doc,im,M+6,by+10,72,bh-20);
  const rx=M+92,rw=W-M-rx-8; let y=by+12; doc.setTextColor(...PGREY); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.text(`Cód. ${m.p.cod}${m.p.attrs&&m.p.attrs.ean?' · EAN '+m.p.attrs.ean:''}`,rx,y); y+=9;
  doc.setTextColor(...PNAVY); doc.setFontSize(15); const nm=doc.splitTextToSize(String(m.p.descricao||'').toUpperCase(),rw).slice(0,3); doc.text(nm,rx,y); y+=nm.length*6.5+3;
  doc.setFillColor(...PGOLD); doc.roundedRect(rx,y,rw,27,4,4,'F'); doc.setTextColor(...PNAVY); doc.setFontSize(9); doc.text(m.q?`COMPRANDO ${m.q.toLocaleString('pt-BR')} UNIDADES`:'PREÇO ESPECIAL',rx+5,y+7); doc.setFontSize(28); doc.text(brl(m.pr),rx+5,y+21); doc.setFontSize(9); doc.text('s/ IPI',rx+8+doc.getTextWidth(brl(m.pr))*28/9,y+21);
  y+=34; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...PGREY);
  if(m.de>m.pr){doc.text('De ',rx,y); const dw=doc.getTextWidth('De '), dt=brl(m.de); doc.text(dt,rx+dw,y); doc.line(rx+dw,y-1.2,rx+dw+doc.getTextWidth(dt),y-1.2); doc.setFont('helvetica','bold'); doc.setTextColor(29,107,56); doc.text(`Economia de ${Math.round((1-m.pr/m.de)*100)}%`,rx+rw,y,{align:'right'}); y+=6}
  doc.setFont('helvetica','normal'); doc.setTextColor(...PGREY); doc.text(`IPI ${pct(m.p.ipi)}${m.q?' · Total do lote: '+brl(m.q*m.pr)+' s/ IPI':''}`,rx,y);
  if(cs.length){let cy=by+bh+12; doc.setTextColor(...PGOLD); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('APROVEITE E COMPLETE O PEDIDO',M,cy); cy+=5; const cw=(W-2*M-6)/2,chh=34;
    cs.forEach((c,i)=>{const col=i%2; if(col===0&&i>0) cy+=chh+5; if(cy+chh>H-22){doc.addPage(); bg(); cy=16} const cx=M+col*(cw+6); doc.setFillColor(42,49,87); doc.roundedRect(cx,cy,cw,chh,4,4,'F'); doc.setFillColor(255,255,255); doc.roundedRect(cx+3,cy+3,28,28,3,3,'F'); fitImg(doc,cim[i],cx+4,cy+4,26,26);
      doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.text(String(c.p.cod),cx+35,cy+8.5); doc.setFont('helvetica','normal'); doc.setFontSize(7.4); doc.setTextColor(210); doc.text(doc.splitTextToSize(String(c.p.descricao||''),cw-38).slice(0,2),cx+35,cy+13); if(c.q) doc.text('A partir de '+c.q.toLocaleString('pt-BR'),cx+35,cy+21.5);
      doc.setTextColor(...PGOLD); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(brl(c.pr),cx+35,cy+29)})}
  doc.setDrawColor(61,70,117); doc.line(M,H-18,W-M,H-18); doc.setTextColor(210); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.text('Condição válida para pedido único na quantidade indicada · Preços sem IPI · Sujeito à disponibilidade.',M,H-12); doc.text(((perfil&&perfil.nome)?'Vendedor: '+perfil.nome+'  ·  ':'')+'Chamae Representações · '+new Date().toLocaleDateString('pt-BR'),M,H-7);
  doc.save(`Promocao_${repName(rep)}_${m.p.cod}.pdf`); toast('PDF salvo')}

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
    const g=t.closest('[data-go3]'); if(g) return go('rep',{rep}); const c=t.closest('[data-cli]'); if(c){await escolherCliente(rep,o,c.dataset.cli); return orc()}
    if(t.id==='usePz'){o.prazo=o.cli.ult.ultimo_prazo||''; saveQ(o); return orc()}
    if(t.id==='oclr'){if(confirm('Começar um novo orçamento desta representada? O atual fica salvo se você tiver tocado em Salvar.')){const q=Q(); delete q[rep]; setQ(q); go('home')}}
    if(t.id==='osave'){await salvar(o,sub+ipi+fr,'rascunho'); toast('Orçamento salvo')}
    if(t.id==='opdf'){t.disabled=true; try{await pdf(o,rows,{sub,ipi,fr,tab,tr:tr[o.transp]}); await salvar(o,sub+ipi+fr,'enviado')}catch(err){toast('Erro no PDF: '+err.message)} t.disabled=false}};
  m.onchange=e=>{const t=e.target; if(t.dataset.oq){const it=o.itens.find(i=>i.pid==t.dataset.oq); it.qt=Math.max(0,+t.value||0); if(!it.qt) o.itens=o.itens.filter(i=>i!==it); saveQ(o); orc()}
    if(t.id==='otab'){o.tabela=+t.value; saveQ(o); lembrarTabela(rep,o.cli,o.tabela); orc()} if(t.id==='opz'){o.prazo=t.value; saveQ(o)} if(t.id==='oobs'){o.obs=t.value; saveQ(o)} if(t.id==='otr'){o.transp=+t.value; saveQ(o); orc()}};
  cliBusca($('#cq'),$('#cres'),rep);}
async function salvar(o,total,sit){try{await api('orcamentos?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:sess.uid.slice(0,8)+'-'+o.rep+'-'+o.id,app:o.rep,cliente:o.cli&&o.cli.n,cnpj:o.cli&&o.cli.cnpj,total:Math.round(total*100)/100,itens:o.itens.length,situacao:sit,dados:o,atualizado_em:new Date().toISOString()})})}catch(e){toast('Salvo no aparelho; sincroniza depois')}}

/* ---------- consulta de pedidos e orçamentos ---------- */
const fmtDt=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';
const csv=(nome,rows)=>{const t=rows.map(r=>r.map(c=>{const s=String(c??''); return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(';')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv'})); a.download=nome+'.csv'; a.click()};
const REPLIST=['Marcon','Marluvas','Medix','Sigma Tools','Camper','ZM Bombas','Terra','Fortlev','Pegorari','Valcan','CID','Chemicals 4U'];
let VENDS=null; async function vendedores(){if(VENDS) return VENDS; try{const r=await apiAll('cliente_rep?select=vendedor'); VENDS=[...new Set(r.map(x=>x.vendedor).filter(Boolean))].sort()}catch(e){VENDS=[]} return VENDS}
async function ped(){const m=$('#main'); const f=L('pedF')||{q:'',rep:'',vend:'',de:'',ate:'',tipo:'ped'}; const V=await vendedores();
  m.innerHTML=`<div class="sec">Pedidos e orçamentos</div>
   <div class="row" style="margin-bottom:8px"><button class="chip${f.tipo==='ped'?' on':''}" data-tp="ped">Pedidos (histórico + Reprio)</button><button class="chip${f.tipo==='orc'?' on':''}" data-tp="orc">Orçamentos do app</button></div>
   <div class="card grid"><input id="pq" type="search" placeholder="Ordem de compra, nº do pedido, cliente, CNPJ ou código de produto" value="${esc(f.q)}">
    <div class="r2"><select id="prep"><option value="">Todas as representadas</option>${REPLIST.map(r=>`<option${r===f.rep?' selected':''}>${r}</option>`).join('')}</select>
    <select id="pvend"><option value="">Todos os vendedores</option>${V.map(v=>`<option${v===f.vend?' selected':''}>${esc(v)}</option>`).join('')}</select>
    <label class="f">De<input id="pde" type="date" value="${f.de}"></label><label class="f">Até<input id="pate" type="date" value="${f.ate}"></label></div>
    <div class="row"><button class="btn" id="pgo">Buscar</button><button class="chip" data-per="30">30 dias</button><button class="chip" data-per="90">90 dias</button><button class="chip" data-per="365">12 meses</button><button class="chip" data-per="0">Tudo</button></div></div>
   <div id="pres" style="margin-top:12px"></div>`;
  const read=()=>{f.q=$('#pq').value.trim(); f.rep=$('#prep').value; f.vend=$('#pvend').value; f.de=$('#pde').value; f.ate=$('#pate').value; LS('pedF',f)};
  m.onclick=e=>{const t=e.target; const tp=t.closest('[data-tp]'); if(tp){read(); f.tipo=tp.dataset.tp; LS('pedF',f); return ped()} const pr=t.closest('[data-per]'); if(pr){const d=+pr.dataset.per; $('#pde').value=d?new Date(Date.now()-d*864e5).toISOString().slice(0,10):''; $('#pate').value=''; read(); return buscar()}
    if(t.id==='pgo'){read(); buscar()} const d=t.closest('[data-pd]'); if(d) detalhe(d.dataset.pd); const o=t.closest('[data-od]'); if(o) abrirOrc(o.dataset.od)};
  $('#pq').onkeydown=e=>{if(e.key==='Enter'){read(); buscar()}};
  async function buscar(){const r=$('#pres'); r.innerHTML='<p class="hint">Buscando…</p>';
    try{if(f.tipo==='orc'){let p='orcamentos?select=id,app,cliente,cnpj,total,itens,situacao,atualizado_em,user_id,dados&order=atualizado_em.desc&limit=200'; if(f.q){const qq=f.q.replace(/[(),*]/g,' ').trim(); p+=`&or=(cliente.ilike.*${encodeURIComponent(qq)}*,cnpj.like.*${encodeURIComponent(qq.replace(/\D/g,'')||'x')}*)`} if(f.de) p+='&atualizado_em=gte.'+f.de; if(f.ate) p+='&atualizado_em=lte.'+f.ate+'T23:59';
        const O=await api(p); const P=await api('perfis?select=id,nome').catch(()=>[]); const nm=id=>(P.find(x=>x.id===id)||{}).nome||'';
        r.innerHTML=`<p class="hint">${O.length} orçamento(s)</p>`+O.map(o=>`<button class="card" data-od="${esc(o.id)}" style="display:block;width:100%;text-align:left;margin-bottom:8px;color:inherit;font:inherit;cursor:pointer"><div class="row" style="justify-content:space-between"><b>${esc(o.cliente||'Sem cliente')}</b><b class="${o.situacao==='pedido'?'ok':o.situacao==='enviado'?'warn':''}">${esc(o.situacao)}</b></div><div class="hint">${esc(o.app)} · ${new Date(o.atualizado_em).toLocaleDateString('pt-BR')} · ${o.itens} itens · ${brl(o.total)} · ${esc(nm(o.user_id))}</div></button>`).join(''); r._O=O; return}
      let ids=null; if(f.q&&/[A-Z]/i.test(f.q)&&/\d/.test(f.q)&&!/\s/.test(f.q)){const it=await api(`pedido_itens?select=pedido_id&cod=ilike.${encodeURIComponent(f.q)}*&limit=500`).catch(()=>[]); if(it.length) ids=[...new Set(it.map(x=>x.pedido_id))].slice(0,150)}
      let p='pedidos?select=id,num,oc,representada,cnpj,cliente,cidade,data,valor,prazo,vendedor,status,itens,origem&order=data.desc&limit=200';
      if(ids) p+=`&id=in.(${ids.map(x=>'"'+x+'"').join(',')})`; else if(f.q){const qq=encodeURIComponent(f.q.replace(/[(),*]/g,' ').trim()); const dg=f.q.replace(/\D/g,''); p+=`&or=(oc.ilike.*${qq}*,num.ilike.*${qq}*,cliente.ilike.*${qq}*${dg.length>=4?`,cnpj.like.*${dg}*`:''})`}
      if(f.rep) p+='&representada=eq.'+encodeURIComponent(f.rep); if(f.vend) p+='&vendedor=eq.'+encodeURIComponent(f.vend); if(f.de) p+='&data=gte.'+f.de; if(f.ate) p+='&data=lte.'+f.ate;
      const R=await api(p); const tot=R.reduce((s,x)=>s+(+x.valor||0),0);
      r.innerHTML=`<div class="row" style="justify-content:space-between"><p class="hint">${R.length}${R.length===200?'+':''} pedido(s) · ${brl(tot)}${ids?' · contendo o produto '+esc(f.q):''}</p><button class="chip" id="pcsv">Exportar</button></div>`+R.map(x=>`<button class="card" data-pd="${esc(x.id)}" style="display:block;width:100%;text-align:left;margin-bottom:8px;color:inherit;font:inherit;cursor:pointer"><div class="row" style="justify-content:space-between"><b>${esc(x.cliente||'')}</b><b>${brl(x.valor)}</b></div><div class="hint">${fmtDt(x.data)} · ${esc(x.representada)} · Pedido ${esc(x.num||'')}${x.oc?' · OC <b>'+esc(x.oc)+'</b>':''} · ${esc(x.vendedor||'')} · ${esc(x.prazo||'')}</div></button>`).join('');
      $('#pcsv').onclick=()=>csv('pedidos',[['Data','Representada','Pedido','OC','Cliente','CNPJ','Cidade','Vendedor','Prazo','Valor'],...R.map(x=>[fmtDt(x.data),x.representada,x.num,x.oc,x.cliente,x.cnpj,x.cidade,x.vendedor,x.prazo,String(x.valor).replace('.',',')])])}
    catch(e){r.innerHTML=`<p class="bad">${esc(e.message)}</p>`}}
  if(f.q||f.de||f.rep) buscar()}
async function detalhe(id){const [p]=await api(`pedidos?select=*&id=eq.${encodeURIComponent(id)}`); const its=await api(`pedido_itens?select=*&pedido_id=eq.${encodeURIComponent(id)}&order=id`);
  const ov=document.createElement('div'); ov.className='ov'; ov.innerHTML=`<div class="sh"><div class="row" style="justify-content:space-between"><div class="sec" style="font-size:20px;margin:0">Pedido ${esc(p.num||'')}</div><button class="chip" data-x>Fechar</button></div>
   <p class="hint">${esc(p.cliente)} · CNPJ ${esc(p.cnpj)} · ${esc(p.cidade||'')}<br>${fmtDt(p.data)} · ${esc(p.representada)} · ${p.oc?'OC '+esc(p.oc)+' · ':''}Prazo ${esc(p.prazo||'')} · ${esc(p.vendedor||'')} · ${esc(p.status||'')}${p.tabela?' · '+esc(p.tabela):''}</p>
   <div style="overflow-x:auto"><table class="t"><tr><th>Código</th><th>Produto</th><th class="n">Qtd.</th><th class="n">Unit.</th><th class="n">Total</th></tr>${its.map(i=>`<tr><td>${esc(i.cod)}</td><td>${esc(String(i.descricao||'').replace(i.cod+' - ',''))}</td><td class="n">${i.qtd}</td><td class="n">${brl(i.preco)}</td><td class="n">${brl(i.total)}</td></tr>`).join('')}</table></div>
   <div class="tot"><span>Total</span><b>${brl(p.valor)}</b></div><div class="row" style="margin-top:10px"><button class="btn" data-dup>Repetir como novo orçamento</button></div></div>`;
  document.body.appendChild(ov); ov.onclick=async e=>{if(e.target===ov||e.target.closest('[data-x]')) return ov.remove();
    if(e.target.closest('[data-dup]')){const rep=Object.keys(HIST_REP).find(k=>HIST_REP[k]===p.representada); if(!rep) return toast('Representada sem catálogo no sistema'); let C; try{C=await catalog(rep)}catch(_){C=[]} if(!C.length) return toast(p.representada+' ainda não tem catálogo no sistema');
      const o=curQ(rep); let n=0; its.forEach(i=>{const pr=C.find(x=>x.cod===String(i.cod)); if(!pr) return; const ex=o.itens.find(x=>x.pid===pr.id); if(ex) ex.qt+=+i.qtd; else o.itens.push({pid:pr.id,qt:+i.qtd}); n++});
      await escolherCliente(rep,o,p.cnpj).catch(()=>{}); if(!o.cli) o.cli={cnpj:p.cnpj,n:p.cliente,cid:p.cidade}; if(!o.prazo) o.prazo=p.prazo||''; saveQ(o); ov.remove(); toast(`${n} de ${its.length} itens adicionados com preço atual`); go('orc',{rep})}}}
function abrirOrc(id){const o=($('#pres')._O||[]).find(x=>x.id===id); if(!o||!o.dados) return; if(!confirm('Abrir este orçamento para continuar/editar? Ele substitui o orçamento em andamento desta representada.')) return; const q=Q(); q[o.dados.rep]=o.dados; setQ(q); go('orc',{rep:o.dados.rep})}

/* ---------- relatórios ---------- */
const RELS=[['mes','Vendas mensais'],['rep','Por representada'],['vend','Por vendedor'],['abcc','Curva ABC de clientes'],['abcp','Curva ABC de produtos'],['prod','Produtos vendidos × clientes'],['queda','Clientes em queda'],['recompra','Recompra atrasada'],['cross','Oportunidades entre representadas'],['nunca','Quem não comprou um produto']];
let PEDS=null; async function pedidosPeriodo(de){const k='peds_'+de; if(PEDS&&PEDS.k===k) return PEDS.d; const d=await apiAll(`pedidos?select=cnpj,cliente,cidade,representada,data,valor,vendedor&data=gte.${de}&order=data`); PEDS={k,d}; return d}
async function rel(){const m=$('#main'); const s=L('relS')||{r:'mes',anos:2,rep:''};
  m.innerHTML=`<div class="sec">Relatórios</div><div class="row" style="margin-bottom:8px">${RELS.map(([k,l])=>`<button class="chip${s.r===k?' on':''}" data-rl="${k}">${l}</button>`).join('')}</div>
   <div class="row"><select id="rrep"><option value="">Todas as representadas</option>${REPLIST.map(r=>`<option${r===s.rep?' selected':''}>${r}</option>`).join('')}</select><select id="ranos">${[[1,'Últimos 12 meses'],[2,'Últimos 2 anos'],[3,'Últimos 3 anos'],[5,'Desde 2022']].map(([v,l])=>`<option value="${v}"${v==s.anos?' selected':''}>${l}</option>`).join('')}</select><button class="chip" id="rcsv">Exportar</button></div>
   <div id="rout" style="margin-top:12px"><p class="hint">Calculando…</p></div>`;
  m.onclick=e=>{const b=e.target.closest('[data-rl]'); if(b){s.r=b.dataset.rl; LS('relS',s); rel()}}; $('#rrep').onchange=e=>{s.rep=e.target.value; LS('relS',s); rel()}; $('#ranos').onchange=e=>{s.anos=+e.target.value; LS('relS',s); rel()};
  const de=new Date(new Date().getFullYear()-(s.anos>=5?5:s.anos),new Date().getMonth(),1).toISOString().slice(0,10); const out=$('#rout'); let X=[];
  const bar=(v,mx)=>`<span style="display:inline-block;height:9px;border-radius:4px;background:var(--accent);width:${Math.max(2,Math.round(v/mx*140))}px;vertical-align:middle"></span>`;
  const tbl=(h,rows,fmt)=>{X=[h,...rows]; return `<div class="card" style="overflow-x:auto"><table class="t"><tr>${h.map((c,i)=>`<th${i&&fmt&&fmt[i]?' class="n"':''}>${esc(c)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${fmt&&fmt[i]?' class="n"':''}>${fmt&&fmt[i]==='brl'?brl(c):fmt&&fmt[i]==='pct'?pct(c):fmt&&fmt[i]==='raw'?c:esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`};
  try{let D=await pedidosPeriodo(de); if(s.rep) D=D.filter(p=>p.representada===s.rep); const tot=D.reduce((a,p)=>a+(+p.valor||0),0); const hoje=new Date();
    if(s.r==='mes'){const g={}; D.forEach(p=>{const k=p.data.slice(0,7); (g[k]=g[k]||{v:0,n:0,c:new Set()}); g[k].v+=+p.valor||0; g[k].n++; g[k].c.add(p.cnpj)}); const ks=Object.keys(g).sort().reverse(); const mx=Math.max(...ks.map(k=>g[k].v),1);
      const ant=k=>{const [y,mm]=k.split('-'); const kk=(+y-1)+'-'+mm; return g[kk]?g[kk].v:null};
      out.innerHTML=`<div class="card row" style="justify-content:space-between"><span>Total ${s.rep||'do escritório'} no período</span><b style="font-size:20px">${brl(tot)}</b></div><div style="height:10px"></div>`+tbl(['Mês','Faturado','','Pedidos','Clientes','vs. ano anterior'],ks.map(k=>{const a=ant(k); return [k.split('-').reverse().join('/'),g[k].v,bar(g[k].v,mx),g[k].n,g[k].c.size,a?((g[k].v/a-1)*100).toFixed(0)+'%':'—']}),[0,'brl','raw',1,1,1])}
    else if(s.r==='rep'||s.r==='vend'){const key=s.r==='rep'?'representada':'vendedor'; const g={}; D.forEach(p=>{const k=p[key]||'—'; (g[k]=g[k]||{v:0,n:0,c:new Set()}); g[k].v+=+p.valor||0; g[k].n++; g[k].c.add(p.cnpj)}); const ks=Object.keys(g).sort((a,b)=>g[b].v-g[a].v); const mx=Math.max(...ks.map(k=>g[k].v),1);
      out.innerHTML=tbl([s.r==='rep'?'Representada':'Vendedor','Faturado','','% do total','Pedidos','Ticket médio','Clientes'],ks.map(k=>[k,g[k].v,bar(g[k].v,mx),g[k].v/tot*100,g[k].n,g[k].v/g[k].n,g[k].c.size]),[0,'brl','raw','pct',1,'brl',1])}
    else if(s.r==='abcc'){const g={}; D.forEach(p=>{const k=p.cnpj; (g[k]=g[k]||{n:p.cliente,c:p.cidade,v:0,q:0,u:p.data}); g[k].v+=+p.valor||0; g[k].q++; if(p.data>g[k].u) g[k].u=p.data}); const ks=Object.keys(g).sort((a,b)=>g[b].v-g[a].v); let ac=0;
      const rows=ks.map(k=>{ac+=g[k].v; const cl=ac/tot<=.8?'A':ac/tot<=.95?'B':'C'; return [cl,g[k].n,g[k].c||'',g[k].v,g[k].v/tot*100,ac/tot*100,g[k].q,fmtDt(g[k].u)]}); const cnt=c=>rows.filter(r=>r[0]===c).length;
      out.innerHTML=`<div class="card row" style="justify-content:space-around;text-align:center"><div><b style="font-size:22px">${cnt('A')}</b><br><small class="hint">Clientes A (80% do faturamento)</small></div><div><b style="font-size:22px">${cnt('B')}</b><br><small class="hint">B (15%)</small></div><div><b style="font-size:22px">${cnt('C')}</b><br><small class="hint">C (5%)</small></div></div><div style="height:10px"></div>`+tbl(['Curva','Cliente','Cidade','Faturado','%','% acumulado','Pedidos','Última compra'],rows,[0,0,0,'brl','pct','pct',1,1])}
    else if(['abcp','prod','nunca'].includes(s.r)){out.innerHTML='<p class="hint">Carregando itens vendidos…</p>'; let I=await apiAll(`pedido_itens?select=cod,descricao,qtd,total,pedidos!inner(cnpj,cliente,data,representada)&pedidos.data=gte.${de}${s.rep?'&pedidos.representada=eq.'+encodeURIComponent(s.rep):''}`);
      const g={}; I.forEach(i=>{const k=i.pedidos.representada+'|'+i.cod; (g[k]=g[k]||{rep:i.pedidos.representada,cod:i.cod,d:String(i.descricao||'').replace(i.cod+' - ',''),q:0,v:0,cl:{}}); g[k].q+=+i.qtd||0; g[k].v+=+i.total||0; const c=g[k].cl[i.pedidos.cnpj]=g[k].cl[i.pedidos.cnpj]||{n:i.pedidos.cliente,q:0,u:i.pedidos.data}; c.q+=+i.qtd||0; if(i.pedidos.data>c.u) c.u=i.pedidos.data});
      const ks=Object.keys(g).sort((a,b)=>g[b].v-g[a].v); const tv=ks.reduce((a,k)=>a+g[k].v,0);
      if(s.r==='abcp'){let ac=0; out.innerHTML=tbl(['Curva','Representada','Código','Produto','Qtd.','Faturado','% acumulado','Clientes'],ks.map(k=>{ac+=g[k].v; return [ac/tv<=.8?'A':ac/tv<=.95?'B':'C',g[k].rep,g[k].cod,g[k].d.slice(0,60),g[k].q,g[k].v,ac/tv*100,Object.keys(g[k].cl).length]}),[0,0,0,0,1,'brl','pct',1])}
      else {out.innerHTML=`<input id="pf" type="search" placeholder="Filtrar produto por código ou descrição" style="width:100%;margin-bottom:8px"><div id="pl2"></div>`; const draw=()=>{const w=norm($('#pf').value); const list=ks.filter(k=>!w||norm(g[k].cod+' '+g[k].d).includes(w)).slice(0,60);
        $('#pl2').innerHTML=list.map(k=>{const x=g[k]; const cls=Object.entries(x.cl).sort((a,b)=>b[1].q-a[1].q); return `<details class="card" style="margin-bottom:8px"><summary style="cursor:pointer"><b>${esc(x.cod)}</b> ${esc(x.d.slice(0,70))} <span class="hint">· ${esc(x.rep)} · ${x.q} un · ${brl(x.v)} · ${cls.length} clientes</span></summary>
         ${s.r==='prod'?`<table class="t" style="margin-top:8px"><tr><th>Cliente que comprou</th><th class="n">Qtd.</th><th class="n">Última</th></tr>${cls.map(([cn,c])=>`<tr><td>${esc(c.n)}</td><td class="n">${c.q}</td><td class="n">${fmtDt(c.u)}</td></tr>`).join('')}</table>`:
          (()=>{const comp=new Set(D.filter(p=>p.representada===x.rep).map(p=>p.cnpj)); const nao=[...comp].filter(cn=>!x.cl[cn]); const nomes={}; D.forEach(p=>nomes[p.cnpj]=p.cliente); return `<p class="hint" style="margin-top:8px">${nao.length} clientes compram ${esc(x.rep)} mas nunca compraram este produto no período:</p><p style="font-size:13px">${nao.slice(0,80).map(cn=>esc(nomes[cn])).join(' · ')}</p>`})()}</details>`}).join('')};
        $('#pf').oninput=draw; draw(); X=[['Representada','Código','Produto','Qtd','Faturado','Cliente','Qtd cliente','Última'],...ks.flatMap(k=>Object.values(g[k].cl).map(c=>[g[k].rep,g[k].cod,g[k].d,g[k].q,g[k].v,c.n,c.q,fmtDt(c.u)]))]}}
    else if(s.r==='queda'){const a=new Date(hoje-365*864e5).toISOString().slice(0,10), b=new Date(hoje-730*864e5).toISOString().slice(0,10); const D2=await pedidosPeriodo(new Date(new Date().getFullYear()-5,0,1).toISOString().slice(0,10)); const g={};
      D2.filter(p=>!s.rep||p.representada===s.rep).forEach(p=>{const k=p.cnpj+'|'+p.representada; (g[k]=g[k]||{n:p.cliente,r:p.representada,v:p.vendedor,a:0,b:0}); if(p.data>=a) g[k].a+=+p.valor||0; else if(p.data>=b) g[k].b+=+p.valor||0});
      const rows=Object.values(g).filter(x=>x.b>5000&&x.a<x.b*.7).sort((x,y)=>(y.b-y.a)-(x.b-x.a)).map(x=>[x.n,x.r,x.v||'',x.b,x.a,(x.a/x.b-1)*100,x.b-x.a]);
      out.innerHTML=`<p class="hint">Clientes que compraram pelo menos R$ 5.000 nos 12 meses anteriores e caíram mais de 30% nos últimos 12 meses. Ordenado pelo valor perdido.</p>`+tbl(['Cliente','Representada','Vendedor','12 meses anteriores','Últimos 12 meses','Variação %','Perda (R$)'],rows,[0,0,0,'brl','brl','pct','brl'])}
    else if(s.r==='recompra'){const g={}; D.forEach(p=>{const k=p.cnpj+'|'+p.representada; (g[k]=g[k]||{n:p.cliente,r:p.representada,v:p.vendedor,d:[],t:0}); g[k].d.push(p.data); g[k].t+=+p.valor||0});
      const rows=Object.values(g).filter(x=>x.d.length>=3).map(x=>{const ds=[...new Set(x.d)].sort().map(d=>+new Date(d)); const gaps=ds.slice(1).map((d,i)=>(d-ds[i])/864e5); const med=gaps.reduce((a,b)=>a+b,0)/gaps.length; const dias=(hoje-ds[ds.length-1])/864e5; return {x,med,dias,ult:ds[ds.length-1]}}).filter(o=>o.dias>o.med*1.3&&o.dias<720).sort((a,b)=>b.x.t-a.x.t)
        .map(o=>[o.x.n,o.x.r,o.x.v||'',Math.round(o.med),Math.round(o.dias),Math.round(o.dias-o.med),fmtDt(new Date(o.ult).toISOString()),o.x.t/o.x.d.length]);
      out.innerHTML=`<p class="hint">Clientes que compram com frequência (3+ pedidos) e já passaram do intervalo normal deles. Ótima lista para ligar esta semana.</p>`+tbl(['Cliente','Representada','Vendedor','Compra a cada (dias)','Sem comprar há','Atraso (dias)','Última','Ticket médio'],rows,[0,0,0,1,1,1,1,'brl'])}
    else if(s.r==='cross'){const D2=s.rep?await pedidosPeriodo(de):D; const g={}; D2.forEach(p=>{(g[p.cnpj]=g[p.cnpj]||{n:p.cliente,c:p.cidade,v:p.vendedor,r:{}}); g[p.cnpj].r[p.representada]=(g[p.cnpj].r[p.representada]||0)+(+p.valor||0)});
      const pares={}; Object.values(g).forEach(c=>{const rs=Object.keys(c.r); REPLIST.forEach(alvo=>{if(c.r[alvo]) return; rs.forEach(orig=>{const k=orig+' → '+alvo; (pares[k]=pares[k]||[]).push(c)})})});
      const buyers=r=>Object.values(g).filter(c=>c.r[r]).length; const alvoOk=r=>buyers(r)>=10;
      const ks=Object.keys(pares).filter(k=>alvoOk(k.split(' → ')[1])&&(!s.rep||k.startsWith(s.rep+' →'))).sort((a,b)=>pares[b].length-pares[a].length).slice(0,15);
      out.innerHTML=`<p class="hint">Clientes que já compram uma representada e ainda não compram outra que vocês vendem bem. Toque para ver a lista.</p>`+ks.map(k=>`<details class="card" style="margin-bottom:8px"><summary style="cursor:pointer"><b>${esc(k)}</b> · ${pares[k].length} clientes</summary><table class="t" style="margin-top:8px"><tr><th>Cliente</th><th>Cidade</th><th>Vendedor</th><th class="n">Compra em ${esc(k.split(' → ')[0])}</th></tr>${pares[k].sort((a,b)=>b.r[k.split(' → ')[0]]-a.r[k.split(' → ')[0]]).slice(0,60).map(c=>`<tr><td>${esc(c.n)}</td><td>${esc(c.c||'')}</td><td>${esc(c.v||'')}</td><td class="n">${brl(c.r[k.split(' → ')[0]])}</td></tr>`).join('')}</table></details>`).join('');
      X=[['Oportunidade','Cliente','Cidade','Vendedor','Compra origem'],...ks.flatMap(k=>pares[k].map(c=>[k,c.n,c.c,c.v,c.r[k.split(' → ')[0]]]))]}
  }catch(e){out.innerHTML=`<p class="bad">${esc(e.message)}</p>`}
  $('#rcsv').onclick=()=>X.length?csv('relatorio_'+s.r,X.map(r=>r.map(c=>typeof c==='number'?String(Math.round(c*100)/100).replace('.',','):String(c).replace(/<[^>]+>/g,'')))):toast('Nada para exportar')}

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
     <label class="f">Grupo<input id="fg" list="glist" value="${esc(grupoOf(rep,p))}"><datalist id="glist">${[...new Set(C.map(x=>grupoOf(rep,x)))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label><label class="f">Link da foto<input id="fimg" value="${esc(p.img||'')}"></label><label class="f" style="display:flex;gap:8px;align-items:center"><input id="fat" type="checkbox"${p.ativo!==false?' checked':''}> Produto ativo</label>
     <table class="t"><tr><th>Tabela</th><th class="n">Bruto</th><th class="n">Líquido (orçamento)</th></tr>${T.map(t=>`<tr><td>${esc(t.nome)}</td><td class="n"><input data-pb="${t.id}" type="number" step="0.01" value="${PR[t.id].base??''}" style="width:110px;padding:6px"></td><td class="n"><input data-pl="${t.id}" type="number" step="0.01" value="${PR[t.id].liq??''}" style="width:110px;padding:6px"></td></tr>`).join('')}</table>
     <button class="btn" id="fsave">Salvar alterações</button></div>`;
    $('#fsave').onclick=async()=>{try{await api(`produtos?id=eq.${p.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({grupo:$('#fg').value||null,descricao:$('#fd').value,un:$('#fu').value,mult:+$('#fm').value||1,ipi:$('#fi').value===''?null:+$('#fi').value,ncm:$('#fn').value,img:$('#fimg').value||null,ativo:$('#fat').checked,attrs:{...(p.attrs||{}),ean:$('#fe').value||null,prazo:$('#fp').value||null},atualizado_em:new Date().toISOString()})});
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
