/* Gabarito do motor de semelhança do Converter CA (Sistema teste, 23/11/2026).
   Uso: node fontes/equivalencia/teste_equivalencia.js [produtos.json] [pasta do conversor-ca]
   produtos.json = select id,rep,cod,ref,descricao,grupo,ca,img,mult,attrs from produtos where rep in ('marluvas','medix') (não fica no repositório).
   Sai com código 1 se algum caso piorar: rode antes de publicar mudanças no motor. */
const fs=require('fs'), path=require('path');
const raiz=path.join(__dirname,'..','..');
const app=fs.readFileSync(path.join(raiz,'chamae','app.js'),'utf8');
const i=app.indexOf('/*EQV-MOTOR-INICIO*/'), j=app.indexOf('/*EQV-MOTOR-FIM*/'); if(i<0||j<0) throw new Error('bloco EQV-MOTOR não achado');
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const M=new Function('norm',app.slice(i,j)+';return {eqLer,eqRank}')(norm);
const prodF=process.argv[2]||path.join(__dirname,'produtos.json'), caDir=process.argv[3]||path.join(raiz,'..','conversor-ca');
const C=JSON.parse(fs.readFileSync(prodF,'utf8')); const base=new Map();
for(const f of ['caepi.json','caepi_luvas.json']) for(const x of JSON.parse(fs.readFileSync(path.join(caDir,f),'utf8'))) base.set(String(x.c),x);
const G=JSON.parse(fs.readFileSync(path.join(__dirname,'gabarito.json'),'utf8')).casos; let falhas=0;
for(const c of G){const x=base.get(c.ca); if(!x){console.log('?? CA',c.ca,'fora da base'); falhas++; continue}
  const q=M.eqLer(x.n+' · '+x.d,x.cor); if(c.extra){const e=M.eqLer(c.extra,'',true); delete e.tipo; Object.assign(q,e)}
  const R=M.eqRank(q,C,base,{},5,c.ca); const pos=R.findIndex(r=>r.vars.some(v=>c.aceita.includes(String(v.p.cod))))+1; const ok=pos>0&&pos<=c.top; if(!ok) falhas++;
  console.log(ok?'OK  ':'FALHA',('CA '+c.ca+(c.extra?' + "'+c.extra+'"':'')).padEnd(36),'posição',pos||'-','(máx '+c.top+')','| 1º:',R[0]?R[0].p.cod+' '+Math.round(R[0].pts*100)+'%':'-','|',c.obs)}
console.log(`\n${G.length-falhas}/${G.length} casos ok`); process.exit(falhas?1:0)
