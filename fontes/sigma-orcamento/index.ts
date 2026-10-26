// Cria na Sigma (Effective/Prodest) o orçamento ORV de um orçamento Sigma do Sistema Chamae.
// Só CRIA e grava o orçamento; efetivar (virar pedido) continua à mão no portal (decisão do Victor, 26/10/2026).
// Receita validada em 26/10 (ORV-204736): /mnt/project-files/sigma/receita-orcamento-sigma.md
// O login é compartilhado com o vendedor no portal: se houver rascunho em aberto, NÃO mexe e devolve "ocupada".
// Um envio por vez (rpc sigma_pegar / sigma_soltar). Resultado gravado em orcamentos.dados.sigma.
const BASE = 'http://ts.sigmatools.com.br:90';
const SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) orcamento Chamae';
const VENDEDOR = '10745'; // representante da conta na Sigma (lov relva001b)
const LISTA = 'INDUSTRIA'; // lista padrão quando o rascunho não traz ListaPreco

let jar: Record<string, string> = {};
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
  const r = await fetch(BASE + path, { ...init, headers: h, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  guardar(r);
  return r;
}
// tela inteira, como o navegador: sem X-Requested-With e seguindo redirecionamentos (com os cookies)
async function pagina(path: string) {
  let url = path;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(BASE + url, {
      headers: { 'User-Agent': UA, Cookie: cookie(), Accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    guardar(r);
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      await r.text().catch(() => {});
      url = loc.startsWith('http') ? loc.replace(/^https?:\/\/[^/]+/, '') : loc.startsWith('/') ? loc : '/' + loc;
      continue;
    }
    return { status: r.status, url, html: await r.text() };
  }
  throw new Error('A Sigma ficou redirecionando ' + path);
}
const form = (o: Record<string, unknown>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  body: new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v ?? '')])),
});
const json = (o: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  body: JSON.stringify(o),
});
async function jreq(path: string, init: RequestInit = {}) {
  const r = await req(path, init);
  const txt = await r.text();
  let j: any = null;
  try { j = JSON.parse(txt); } catch { /* HTML */ }
  if (j && typeof j.returnUrl === 'string' && /acessar/i.test(j.returnUrl)) throw new Error('A sessão na Sigma caiu (' + path + ')');
  return { status: r.status, j, txt };
}
// etapas: sucesso = Success true
async function etapa(nome: string, path: string, init: RequestInit) {
  const { status, j, txt } = await jreq(path, init);
  if (status !== 200 || !j || j.Success !== true) {
    throw new Error(`${nome}: ${j?.Message || j?.message || 'HTTP ' + status + ' ' + txt.slice(0, 120)}`);
  }
  return j;
}

async function login() {
  jar = {};
  await (await req('/Acessar')).text();
  const { status, j, txt } = await jreq('/Home/Login', form({
    Cqa013Email1: Deno.env.get('SIGMA_EMAIL') ?? '',
    Cqa013Senha: Deno.env.get('SIGMA_SENHA') ?? '',
    chaveSecreta: '', chave2FA: '', browserName: 'Chrome', armazena2FA: 'N', novaSenha: '', returnUrl: '',
  }));
  if (status !== 200 || !j || j.ResponseObject?.valida2FA || j.ResponseObject?.precisaAlterarSenha || (!j.returnUrl && j.Success === false)) {
    throw new Error('Login na Sigma falhou (HTTP ' + status + '): ' + (j?.Message || txt.slice(0, 200)));
  }
  // como o navegador: abre a página de destino do login (pode escolher empresa/filial na sessão)
  if (typeof j.returnUrl === 'string' && j.returnUrl.startsWith('/')) await pagina(j.returnUrl).catch(() => {});
}

const n2t = (v: unknown) => (v == null || v === '' ? '0' : String(v).replace('.', ','));
const dataBR = (v: unknown) => {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/\/Date\((-?\d+)/);
  const d = m ? new Date(+m[1]) : /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10) + 'T12:00:00Z') : null;
  if (!d) return /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s : '';
  return d.toISOString().slice(0, 10).split('-').reverse().join('/');
};
const ocValida = (s: string) => /^[^\s\-\/]+[\-\/ ]\d+$/.test(s.trim());

type Linha = { cod: string; qt: number; pu?: number; ptab?: number; desc?: string };

async function criarORV(o: any) {
  const d = o.dados || {};
  const cnpj = String(o.cnpj || d.cli?.cnpj || '').replace(/\D/g, '');
  if (!cnpj) throw new Error('O orçamento não tem CNPJ do cliente');
  const its: Linha[] = (d.linhas || []).filter((l: Linha) => l.cod && +l.qt > 0);
  if (!its.length) throw new Error('Orçamento sem itens com quantidade');
  const avisos: string[] = [];

  await login();
  try {
    // 1) rascunho em aberto no login compartilhado? não mexe
    const pg = await pagina('/orcamentos');
    const bt = pg.html.match(/<[^>]*\bid=["']?sw-btn-inserir\b[^>]*>/i)?.[0] || '';
    if (!bt) {
      const tit = (pg.html.match(/<title>([^<]*)/i)?.[1] || pg.html.replace(/\s+/g, ' ').slice(0, 80)).trim();
      throw new Error(`Não achei o botão de novo orçamento na Sigma (HTTP ${pg.status} em ${pg.url}: ${tit})`);
    }
    if (/data-pedido=["']?True\b/i.test(bt)) return { ocupada: true };

    // 2) abre o assistente
    await pagina('/pedidosnovo/inserir?orc=true&prospect=false');
    const instanceId = String(Math.floor(Math.random() * 1e9));

    // 3) cliente pelo CNPJ
    const lv = await jreq(`/lov/cllva001?queryFilter=${cnpj}&pl=100&lovAvancada=false&init=`);
    const rs: any[] = lv.j?.results || lv.j?.Results || [];
    const cli = rs.find((x) => String(x.Ppa001Cnpj || '').replace(/\D/g, '') === cnpj) || (rs.length === 1 ? rs[0] : null);
    if (!cli) throw new Error('Cliente com CNPJ ' + cnpj + ' não está cadastrado na Sigma');

    let tmp = 0;
    try {
      const e1 = await etapa('Cliente', '/PedidosNovo/ValidarEtapa1', form({ codCliente: cli.Ppa001Pessoa, orcamento: true, prospect: false, instanceId }));
      const p1 = e1.ResponseObject?.pedido || {};
      if (String(p1.Cliente?.Ppa001Cnpj || '').replace(/\D/g, '') !== cnpj) throw new Error('A Sigma selecionou outro cliente; envio interrompido');
      const cond = p1.Condicao?.Taa008Condicao ?? p1.Pet101Condicao;
      if (cond == null) throw new Error('O cliente não tem condição de pagamento padrão na Sigma');
      const lista = p1.ListaPreco?.Lpa001Lista || LISTA;

      const e2 = await etapa('Cabeçalho', '/PedidosNovo/ValidarEtapa2', form({
        sqa003: 'ORV', taa008: cond, lpa001: lista, vendedor: VENDEDOR, tipoOperacao: 2, campanha: '',
        nome: '', tipoPessoa: '', cnpj: '', pais: '', estado: '', cidade: '', endereco: '', complemento: '', telefone: '',
        instanceId,
      }));
      const p2 = e2.ResponseObject?.pedido || {};
      tmp = +p2.Pet101Id || 0;
      if (!tmp) throw new Error('A Sigma não abriu o rascunho (sem número)');

      // 4) itens: quick add com o preço da lista; desconto % quando o nosso preço é menor
      const entregaSol = dataBR(d.programado);
      for (const l of its) {
        const ins = await jreq('/PedidosNovo/InserirLinha', json({
          prod: String(l.cod), prodconf: '0', quickAdd: true, quantidade: n2t(+l.qt), descontoModel: null, addRapido: 'S', senha: '', idPedidoTemp: tmp,
        }));
        const linhas: any[] = ins.j?.Pedido?.Pet201 || ins.j?.pet101?.Pet201 || [];
        if (ins.status !== 200 || ins.j?.Success === false || !linhas.length) {
          throw new Error(`Item ${l.cod}: ${ins.j?.Message || 'a Sigma não aceitou'}`);
        }
        const lin = [...linhas].reverse().find((x) => String(x.Pet201Produto).trim() === String(l.cod).trim());
        if (!lin) throw new Error(`Item ${l.cod}: não voltou no rascunho`);
        const lst = +lin.Pet201Precolista || 0, pu = +(l.pu ?? 0);
        if (lst > 0 && pu > 0 && pu < lst * 0.9995) {
          const perc = Math.round((1 - pu / lst) * 10000) / 100;
          const p203 = Array(10).fill('0'); p203[0] = n2t(perc);
          const c203 = Array(10).fill(false); c203[0] = true;
          const alt = await jreq('/PedidosNovo/AlterarLinha', json({
            talva002: lin.Pet201Umvenda ?? '', Pet201Umvenda: lin.Pet201Umvenda ?? '',
            Pet201Id: String(lin.Pet201Id ?? ''), Pet201Linha: String(lin.Pet201Linha ?? ''),
            Pet201Produto: lin.Pet201Produto, Pet201Produtoconf: String(lin.Pet201Produtoconf ?? '0'), Pet201Proddesc: lin.Pet201Proddesc ?? '',
            Pet201Qtdesol: n2t(lin.Pet201Qtdesol), Pet201Embalagem: n2t(lin.Pet201Embalagem),
            Pet201Listapreco: lin.Pet201Listapreco ?? '', Pet201Precolista: n2t(lst), Pet201Precobruto: n2t(lin.Pet201Precobruto ?? lst),
            Pet201Acrescimo: n2t(lin.Pet201Acrescimo), Pet201Precoliquido: n2t(lin.Pet201Precoliquido ?? lst),
            Pet201Desconto: n2t(perc), Pet201Perc: n2t(perc), Pet203Perc: p203, Pet203Check: c203,
            Pet201Dtentregasol: dataBR(lin.Pet201Dtentregasol) || entregaSol, Pet201Dtentregaprev: dataBR(lin.Pet201Dtentregaprev) || dataBR(lin.Pet201Dtentregasol) || entregaSol,
            Pet201Dtembarque: dataBR(lin.Pet201Dtembarque), Pet201Pedidocompra: lin.Pet201Pedidocompra ?? '', Pet201Itempedidocompra: lin.Pet201Itempedidocompra ?? '',
            Pet201Observacao: lin.Pet201Observacao ?? '', Pet201Margem: n2t(lin.Pet201Margem),
            Pet201Senha: '', idPedidoTemp: tmp,
          }));
          const nl = (alt.j?.pet101?.Pet201 || alt.j?.Pedido?.Pet201 || []).find((x: any) => x.Pet201Id === lin.Pet201Id);
          const liq = nl ? +nl.Pet201Precoliquido : 0;
          if (alt.status !== 200 || alt.j?.Success === false || !nl || Math.abs(liq - pu) > 0.011) {
            avisos.push(`${l.cod}: desconto de ${perc}% não aplicado na Sigma (${alt.j?.Message || (nl ? 'ficou ' + liq.toFixed(2) : 'sem resposta')}); conferir o preço no portal`);
          }
        } else if (lst > 0 && pu > lst * 1.0005) {
          avisos.push(`${l.cod}: nosso preço (${pu.toFixed(2)}) é maior que a lista da Sigma (${lst.toFixed(2)}); foi com o preço da Sigma`);
        }
      }

      const e3 = await etapa('Itens', '/PedidosNovo/ValidarEtapa3', form({ idPedidoTemp: tmp, confirmaOrdemCompra: false }));
      const r3 = e3.ResponseObject || {};

      // 5) frete, OC e observação (copiarPara nunca vazio: dá ORA-00900)
      const oc = String(d.oc || '').trim();
      const docCliente = oc && ocValida(oc) ? oc : '';
      if (oc && !docCliente) avisos.push(`OC "${oc}" fora do formato da Sigma (texto-número); foi na observação`);
      const obs = [
        `Orçamento Sistema Chamae${d.num ? ' nº ' + d.num : ''}`,
        d.vend ? 'Vendedor: ' + d.vend : '',
        oc && !docCliente ? 'OC do cliente: ' + oc : '',
        d.obs ? String(d.obs) : '',
      ].filter(Boolean).join(' · ').slice(0, 900);
      const corpo4 = {
        condpgto: String(cond), transporte: '', redespacho: '',
        tipoFrete: String(r3.Frete?.TipoFrete ?? 0), valorFrete: 0, valorRateio: 0,
        data: dataBR(r3.DataFaturamento), obs, docCliente, dtEmbarque: '',
        copiarPara: r3.Prodest48 || 'SP', contato: '', confirmaOrdemCompra: false, indPres: '',
        observacoes: [], jsonAplicadores: '', idPedidoTemp: tmp, dataEntregaSol: entregaSol,
      };
      let e4 = await jreq('/PedidosNovo/ValidarEtapa4', json(corpo4));
      if (e4.j?.Success === false && e4.j?.Message === 'confirmaOrdemCompra') {
        avisos.push('A Sigma avisou que essa OC já existe em outro documento');
        e4 = await jreq('/PedidosNovo/ValidarEtapa4', json({ ...corpo4, confirmaOrdemCompra: true }));
      }
      if (e4.status !== 200 || e4.j?.Success !== true) throw new Error('Frete/OC: ' + (e4.j?.Message || 'HTTP ' + e4.status));
      const p4 = e4.j.ResponseObject?.pedido || {};

      // 6) grava o ORV (resposta sem Success; sucesso = Pedido.Pedido)
      const cf = await jreq('/PedidosNovo/Confirmar', form({ idPedidoTemp: tmp }));
      const orv = cf.j?.Pedido?.Pedido;
      if (!orv) throw new Error('Gravar: ' + (cf.j?.Message || 'HTTP ' + cf.status));
      tmp = 0;
      return {
        orv: 'ORV-' + orv, num: orv, total: +p4.Pet101Totalprod || null, impostos: +p4.Pet101Totalimpostos || null,
        totalPed: +p4.Pet101Totalpedi || null, cond: p1.Condicao?.Taa008Descricao || String(cond), lista, avisos,
      };
    } finally {
      if (tmp) await req('/PedidosNovo/Cancelar', { method: 'POST' }).then((r) => r.text()).catch(() => {});
    }
  } finally {
    await req('/Home/Logout').then((r) => r.text()).catch(() => {});
  }
}

async function rpc(auth: string, fn: string, body: unknown = {}) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.ok ? await r.json().catch(() => null) : null;
}
async function srv(path: string, init: RequestInit = {}) {
  const h = new Headers(init.headers);
  h.set('apikey', SRV); h.set('Authorization', 'Bearer ' + SRV); h.set('Content-Type', 'application/json');
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: h });
  if (!r.ok) throw new Error('Base: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.status === 204 ? null : r.json();
}
async function marcar(id: string, sg: Record<string, unknown>) {
  const [o] = await srv(`orcamentos?select=dados&id=eq.${encodeURIComponent(id)}`);
  if (!o) return;
  const dados = { ...(o.dados || {}), sigma: { ...((o.dados || {}).sigma || {}), ...sg, at: new Date().toISOString() } };
  await srv(`orcamentos?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ dados }) });
}

Deno.serve(async (rq) => {
  if (rq.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const resp = (o: unknown, s = 200) => Response.json(o, { status: s, headers: CORS });
  const auth = rq.headers.get('Authorization') ?? '';
  if ((await rpc(auth, 'eh_equipe')) !== true) return resp({ erro: 'Sem acesso.' }, 403);
  const b = await rq.json().catch(() => ({}));
  const id = String(b.id || '');
  if (!id) return resp({ erro: 'Informe o orçamento.' }, 400);
  const [o] = await srv(`orcamentos?select=id,app,cnpj,cliente,dados&id=eq.${encodeURIComponent(id)}`);
  if (!o) return resp({ erro: 'Orçamento não encontrado.' }, 404);
  if (((o.dados || {}).rep || o.app) !== 'sigma') return resp({ erro: 'Não é um orçamento da Sigma.' }, 400);
  const ja = (o.dados || {}).sigma;
  if (ja?.orv && !b.reenviar) return resp({ ok: true, ja: true, ...ja });
  const por = String(b.por || '').slice(0, 60);
  if ((await rpc(auth, 'sigma_pegar', { p_seg: 150 })) !== true) {
    await marcar(id, { st: 'aguardando', msg: 'Outro envio para a Sigma em andamento', por });
    return resp({ ocupada: true, msg: 'Outro envio para a Sigma em andamento; tenta de novo em instantes.' });
  }
  try {
    const r: any = await criarORV(o);
    if (r.ocupada) {
      const msg = 'Sigma ocupada: há um pedido em digitação no portal';
      await marcar(id, { st: 'aguardando', msg, por });
      return resp({ ocupada: true, msg });
    }
    const ant = ja?.orv && b.reenviar ? ja.orv : undefined;
    await marcar(id, { st: 'ok', msg: null, por, em: new Date().toISOString(), ...r, anterior: ant });
    return resp({ ok: true, ...r, anterior: ant });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await marcar(id, { st: 'erro', msg, por }).catch(() => {});
    return resp({ erro: msg }, 502);
  } finally {
    await rpc(auth, 'sigma_soltar');
  }
});
