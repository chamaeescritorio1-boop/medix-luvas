// Envia por e-mail (SMTP da Hostinger, caixas @chamae.com.br) o orçamento do Sistema Chamae, com o PDF anexado.
// Chamado por enviarEmail() no app.js: { para[], cc[], assunto, texto, anexo:{nome,base64}|null, ref:{tipo,id,cnpj} }.
// Contas no secret SMTP_CONTAS (Supabase › Edge Functions › Secrets), uma por linha:  email;senha
//   cada vendedor sai SEMPRE da própria caixa (perfis.email_envio, ou o e-mail de login @chamae.com.br).
//   03/11: se a caixa do vendedor não tiver linha no SMTP_CONTAS, o envio é recusado com aviso claro
//   (antes caía na 1ª linha, a caixa do Victor, e o e-mail do Clayton saiu como se fosse do Victor).
//   { checar:true } só responde de qual caixa vai sair e se ela está pronta (a janela de envio mostra isso).
// Opcional: SMTP_HOST (padrão smtp.hostinger.com) e SMTP_PORT (padrão 465, SSL). Cada envio fica em email_envios.
import nodemailer from 'npm:nodemailer@6.9.16';

const SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HOST = Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com';
const PORT = +(Deno.env.get('SMTP_PORT') || 465);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const contas = () =>
  (Deno.env.get('SMTP_CONTAS') || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.includes(';') && l.includes('@'))
    .map((l) => { const i = l.indexOf(';'); return { email: l.slice(0, i).trim().toLowerCase(), senha: l.slice(i + 1).trim() }; });
const emailOk = (e: string) => /^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/.test(e);
const rest = (path: string, init: RequestInit = {}) =>
  fetch(SB + '/rest/v1/' + path, { ...init, headers: { apikey: SRV, Authorization: 'Bearer ' + SRV, 'Content-Type': 'application/json', ...(init.headers || {}) } });

// só a equipe aprovada (gestor/vendedor, fora do portal B2B)
// 03/11: confere se o domínio de cada destinatário existe (MX ou A). Ex.: vendas1@chamae.comn.br (erro de digitação)
// voltava só depois, como "Undelivered Mail". Se o DNS não puder ser consultado, deixa passar (não trava o envio).
async function dominioExiste(dom: string): Promise<boolean> {
  const tenta = async (tipo: 'MX' | 'A') => {
    try { const r = await Promise.race([Deno.resolveDns(dom, tipo), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]) as unknown[]; return r.length > 0 ? true : null; }
    catch (e) { const n = (e as Error)?.name || ''; return /NotFound/i.test(n) || /no ?data|nxdomain|not found/i.test(String((e as Error)?.message)) ? false : null; }
  };
  const mx = await tenta('MX'); if (mx) return true;
  const a = await tenta('A'); if (a) return true;
  return !(mx === false && a === false);
}

async function ehEquipe(auth: string) {
  const r = await fetch(SB + '/rest/v1/rpc/eh_equipe', { method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST' }, 405);

  // quem está enviando (precisa ser da equipe aprovada)
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, Authorization: req.headers.get('Authorization') || '' } });
  if (!u.ok) return json({ erro: 'Sessão expirada. Entre de novo no Sistema.' }, 401);
  const user = await u.json();
  const pr = await rest(`perfis?id=eq.${user.id}&select=nome,email,aprovado,email_envio,assinatura`);
  const perfil = (await pr.json())?.[0];
  if (!perfil?.aprovado) return json({ erro: 'Seu usuário ainda não foi aprovado.' }, 403);
  if (!(await ehEquipe(req.headers.get('Authorization') || ''))) return json({ erro: 'Sem acesso.' }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ erro: 'Pedido inválido' }, 400); }

  // de qual caixa sai: a do próprio vendedor, nunca a de outra pessoa
  const C = contas();
  const vend = String(perfil.email_envio || (String(perfil.email || user.email || '').endsWith('@chamae.com.br') ? perfil.email || user.email : '') || '').trim().toLowerCase();
  const conta = C.find((c) => c.email === vend);
  // 03/11: a caixa não pode ser a de outra pessoa (ex.: Clayton com o e-mail de envio do Victor no perfil)
  if (vend) {
    const dono = await rest(`perfis?select=id&id=neq.${user.id}&or=(email.ilike.${encodeURIComponent(vend)},email_envio.ilike.${encodeURIComponent(vend)})`);
    const outros = dono.ok ? await dono.json() : [];
    if (outros.length) return json({ erro: `A caixa ${vend} é de outro usuário. Cada vendedor envia só pela própria caixa. Nada foi enviado.` }, 403);
  }
  if (b.checar) return json({ de: vend || null, pronta: !!conta });
  if (!C.length) return json({ erro: 'O envio de e-mail ainda não foi configurado (falta o secret SMTP_CONTAS no Supabase).' }, 503);
  if (!vend) return json({ erro: 'Seu usuário não tem e-mail @chamae.com.br de envio. Peça ao gestor para preencher o e-mail de envio no seu perfil.' }, 409);
  if (!conta) return json({ erro: `Sua caixa ${vend} ainda não está liberada para enviar pelo Sistema. Peça ao Victor para cadastrá-la (Supabase › Edge Functions › Secrets › SMTP_CONTAS). Nada foi enviado.` }, 409);
  const para = [...new Set((b.para || []).map((x: string) => String(x).trim().toLowerCase()).filter(emailOk))] as string[];
  const cc = [...new Set((b.cc || []).map((x: string) => String(x).trim().toLowerCase()).filter(emailOk))] as string[];
  if (!para.length) return json({ erro: 'Nenhum destinatário válido.' }, 400);
  if (para.length + cc.length > 20) return json({ erro: 'Destinatários demais (máx. 20).' }, 400);
  const doms = [...new Set([...para, ...cc].map((e) => e.split('@')[1]))];
  const ruins = (await Promise.all(doms.map(async (d) => (await dominioExiste(d)) ? null : d))).filter(Boolean) as string[];
  if (ruins.length) {
    const ends = [...para, ...cc].filter((e) => ruins.includes(e.split('@')[1]));
    return json({ erro: `Endereço com erro de digitação: ${ends.join(', ')} (o domínio ${ruins.join(', ')} não existe). Corrija e envie de novo. Nada foi enviado.`, invalidos: ends }, 422);
  }
  const assunto = String(b.assunto || '').slice(0, 300) || 'Orçamento Chamae';
  const texto = String(b.texto || '').slice(0, 20000);
  const ref = b.ref || {};
  // opcional (02/11, Estratégia do dia): corpo em HTML e imagens no corpo (cid), ex.: a arte do e-mail de reativação
  const html = b.html ? String(b.html).slice(0, 60000) : undefined;

  const nome = (perfil.nome || 'Chamae') + ' · Chamae Representações';

  const anexos = [];
  if (b.anexo?.base64) {
    const tam = Math.floor(String(b.anexo.base64).length * 3 / 4);
    if (tam > 15 * 1024 * 1024) return json({ erro: 'PDF grande demais para enviar por e-mail.' }, 413);
    anexos.push({ filename: String(b.anexo.nome || 'orcamento.pdf').replace(/[\\/:*?"<>|]/g, '_'), content: b.anexo.base64, encoding: 'base64', contentType: 'application/pdf' });
  }

  for (const im of (Array.isArray(b.imagens) ? b.imagens : []).slice(0, 3)) {
    if (!im?.base64 || !im?.cid) continue;
    if (String(im.base64).length * 3 / 4 > 3 * 1024 * 1024) return json({ erro: 'Imagem grande demais (máx. 3 MB).' }, 413);
    const nomeI = String(im.nome || 'imagem.png').replace(/[\\/:*?"<>|]/g, '_');
    anexos.push({ filename: nomeI, content: im.base64, encoding: 'base64', cid: String(im.cid).slice(0, 60), contentType: /\.jpe?g$/i.test(nomeI) ? 'image/jpeg' : 'image/png', contentDisposition: 'inline' });
  }

  const log = { ref_tipo: ref.tipo || null, ref_id: ref.id ? String(ref.id) : null, cnpj: ref.cnpj || null, de: conta.email, para, cc, assunto, anexo: anexos[0]?.filename || null, enviado_por: user.id };
  try {
    const t = nodemailer.createTransport({ host: HOST, port: PORT, secure: PORT === 465, auth: { user: conta.email, pass: conta.senha }, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000 });
    const info = await t.sendMail({
      from: { name: nome, address: conta.email },
      to: para, cc: cc.length ? cc : undefined,
      subject: assunto, text: texto, html, attachments: anexos,
    });
    await rest('email_envios', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...log, status: 'enviado', provedor_id: info.messageId || null }) }).catch(() => {});
    return json({ ok: true, de: conta.email, id: info.messageId });
  } catch (e) {
    const m = String((e as Error)?.message || e);
    const erro = /auth|535|credential|password/i.test(m) ? `A caixa ${conta.email} recusou a senha (confira o SMTP_CONTAS).` : 'Falha no envio: ' + m.slice(0, 200);
    await rest('email_envios', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...log, status: 'erro', erro }) }).catch(() => {});
    return json({ erro }, 502);
  }
});
