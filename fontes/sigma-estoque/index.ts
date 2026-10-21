// Consulta ao vivo de estoque/preço na Sigma (Effective Prodest) para a equipe Chamae.
// Só leitura: GET /Acessar -> POST /Home/Login -> GET /Produtos/Listar. Nunca grava nada na Sigma.
// Login vem dos segredos SIGMA_EMAIL / SIGMA_SENHA. Acesso só para usuários eh_equipe().
const BASE = 'http://ts.sigmatools.com.br:90';
const SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) consulta-estoque Chamae';

let jar: Record<string, string> = {};
let logado = false;
const cache = new Map<string, { t: number; v: unknown }>();

function guardar(r: Response) {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
}
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

async function req(path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers);
  h.set('User-Agent', UA);
  h.set('Cookie', cookie());
  h.set('X-Requested-With', 'XMLHttpRequest');
  const r = await fetch(BASE + path, { ...init, headers: h, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  guardar(r);
  return r;
}

async function login() {
  jar = {};
  logado = false;
  await (await req('/Acessar')).text();
  const body = new URLSearchParams({
    Cqa013Email1: Deno.env.get('SIGMA_EMAIL') ?? '',
    Cqa013Senha: Deno.env.get('SIGMA_SENHA') ?? '',
    chaveSecreta: '', chave2FA: '', browserName: 'Chrome', armazena2FA: 'N', novaSenha: '', returnUrl: '',
  });
  const r = await req('/Home/Login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  });
  const txt = await r.text();
  let j: any = null;
  try { j = JSON.parse(txt); } catch { /* resposta não-JSON */ }
  if (r.status !== 200 || !j || j.ResponseObject?.valida2FA || j.ResponseObject?.precisaAlterarSenha || (!j.returnUrl && j.Success === false)) {
    throw new Error('Login na Sigma falhou (HTTP ' + r.status + '): ' + (j?.Message || j?.message || txt.slice(0, 200)));
  }
  logado = true;
}

const num = (s: string) => {
  const v = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(v) ? null : v;
};
const limpa = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function campo(li: string, rot: string) {
  const m = li.match(new RegExp(rot + '\\s*:\\s*<strong>([\\s\\S]*?)</strong>', 'i'));
  return m ? limpa(m[1]) : '';
}

function parse(html: string) {
  const itens = [];
  for (const m of html.matchAll(/<li\s+data-produto="([^"]*)"([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const at = m[2], li = m[3];
    const a = (n: string) => limpa((at.match(new RegExp(n + '="([^"]*)"')) || [])[1] || '');
    itens.push({
      cod: m[1].trim(),
      desc: a('data-descricao'),
      um: campo(li, 'UM') || a('data-um'),
      ref: campo(li, 'Ref\\.'),
      est: num(campo(li, 'Est\\.')),
      disp: num(campo(li, 'Est\\. Disp\\.')),
      preco: num(campo(li, 'Preço')),
      ipi: num(campo(li, 'Perc\\. IPI')),
      grupo: campo(li, 'Agrupamento'),
      ativo: /badge-success/.test(li),
    });
  }
  return itens;
}

async function listar(f: string, p: number, q: number, estoque: string, idCliente: string) {
  const qs = new URLSearchParams({
    f, estoque, orderByValue: 'PRODUTO', tpFilter: '', situacao: 'S', idCliente,
    embalagem: '', localizacao: 'false', p: String(p), q: String(q), _: String(Date.now()),
  });
  for (let tent = 0; tent < 2; tent++) {
    if (!logado) await login();
    const r = await req('/Produtos/Listar?' + qs);
    const txt = await r.text();
    let j: any = null;
    try { j = JSON.parse(txt); } catch { /* sessão expirada costuma voltar HTML/redirect */ }
    if (r.status === 200 && j && typeof j.html === 'string') {
      return { total: j.totalOfResults ?? null, itens: parse(j.html) };
    }
    logado = false;
  }
  throw new Error('A Sigma não devolveu a lista de produtos.');
}

async function ehEquipe(auth: string) {
  const r = await fetch(SB + '/rest/v1/rpc/eh_equipe', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (rq) => {
  if (rq.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const resp = (o: unknown, s = 200) => Response.json(o, { status: s, headers: CORS });
  try {
    const auth = rq.headers.get('Authorization') ?? '';
    if (!(await ehEquipe(auth))) return resp({ erro: 'Sem acesso.' }, 403);
    const b = await rq.json().catch(() => ({}));
    const f = String(b.f ?? '').trim().slice(0, 80);
    if (!f) return resp({ erro: 'Informe o código ou a descrição.' }, 400);
    const p = Math.max(1, Math.min(500, Number(b.p) || 1));
    const q = [10, 25, 50, 100].includes(Number(b.q)) ? Number(b.q) : 25;
    const estoque = ['0', 'C', 'S'].includes(b.estoque) ? b.estoque : '0';
    const idCliente = String(b.idCliente ?? '').replace(/\D/g, '').slice(0, 20);
    const ch = [f, p, q, estoque, idCliente].join('|');
    const c = cache.get(ch);
    if (c && Date.now() - c.t < 30000) return resp(c.v);
    const v = { ts: new Date().toISOString(), ...(await listar(f, p, q, estoque, idCliente)) };
    cache.set(ch, { t: Date.now(), v });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    return resp(v);
  } catch (e) {
    return resp({ erro: String((e as Error).message || e) }, 502);
  }
});
