// Teste rápido ("fumaça") do Sistema Chamae — roda sozinho no GitHub a cada mudança.
// Abre o Sistema TESTE e o OFICIAL num navegador, com login falso e Supabase simulado
// (nada é lido nem gravado na base de verdade), passa por todas as telas e falha se
// aparecer erro de JavaScript. Uso: node testes/fumaca.js  (precisa do playwright)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..'), PORTA = 8765;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const TELAS = ['home', 'cli', 'tar', 'orc', 'ped', 'prod', 'rel', 'mais', 'busca', 'trans', 'metas', 'fin', 'tec', 'estr', 'ajuda', 'aj', 'equipe', 'reps', 'admin'];
const PASTAS = (process.argv[2] || 'chamae,sistema').split(',');

const servidor = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/medix-luvas/, '');
  let f = path.join(RAIZ, u);
  if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => servidor.listen(PORTA, r));
  const nav = await chromium.launch();
  let falhas = 0;
  for (const pasta of PASTAS) {
    const ctx = await nav.newContext({ serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', e => erros.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')));
    // Supabase simulado: tudo devolve lista vazia; nada sai para a internet
    await ctx.route(/supabase\.co/, rt => {
      const u = rt.request().url();
      if (/\/perfis\?/.test(u)) return rt.fulfill({ json: [{ id: 'u-teste', nome: 'Teste', email: 'teste@chamae.com.br', papel: 'gestor', aprovado: true }] });
      if (/\/functions\//.test(u)) return rt.fulfill({ json: {} });
      return rt.fulfill({ json: [] });
    });
    await ctx.route(u => !/^http:\/\/localhost/.test(u.href) && !/supabase\.co/.test(u.href), rt => rt.fulfill({ status: 204, body: '' }));
    await pg.addInitScript(() => {
      localStorage.setItem('chamae_sess', JSON.stringify({ at: 'x', rt: 'y', exp: Date.now() + 36e5, uid: 'u-teste', email: 'teste@chamae.com.br' }));
      localStorage.setItem('chamae_perfil', JSON.stringify({ id: 'u-teste', nome: 'Teste', papel: 'gestor', aprovado: true }));
      localStorage.setItem('chamae_meuNome', JSON.stringify('Teste'));
      window.confirm = () => false; window.alert = () => {};
    });
    await pg.goto(`http://localhost:${PORTA}/medix-luvas/${pasta}/`, { waitUntil: 'load' });
    await pg.waitForTimeout(2500);
    const logou = await pg.evaluate(() => { const l = document.querySelector('#lock'); return !l || l.hidden; });
    if (!logou) erros.push('a tela de login não saiu (o Sistema não entrou com o login de teste)');
    for (const t of TELAS) {
      const antes = erros.length;
      try { await pg.evaluate(t => { const n = document.querySelector('#nav'), b = document.createElement('button'); b.dataset.go = t; b.hidden = true; n.appendChild(b); b.click(); b.remove(); }, t); } catch (e) { erros.push(`tela ${t}: ${String(e.message).split('\n')[0]}`); }
      await pg.waitForTimeout(500);
      const vazio = await pg.evaluate(() => !document.querySelector('#main') || !document.querySelector('#main').innerHTML.trim());
      if (vazio) erros.push(`tela ${t}: ficou em branco`);
      for (let i = antes; i < erros.length; i++) if (!erros[i].startsWith('tela ')) erros[i] = `tela ${t}: ${erros[i]}`;
    }
    if (erros.length) { falhas += erros.length; console.log(`❌ ${pasta}: ${erros.length} problema(s)`); erros.forEach(e => console.log('   - ' + e)); }
    else console.log(`✅ ${pasta}: abriu e passou por ${TELAS.length} telas sem erro`);
    await ctx.close();
  }
  await nav.close(); servidor.close();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
