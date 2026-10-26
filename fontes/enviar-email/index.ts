// Envia por e-mail (SMTP da Hostinger, caixas @chamae.com.br) o orçamento do Sistema Chamae, com o PDF anexado.
// Chamado por enviarEmail() no app.js: { para[], cc[], assunto, texto, anexo:{nome,base64}|null, ref:{tipo,id,cnpj} }.
// Contas no secret SMTP_CONTAS (Supabase › Edge Functions › Secrets), uma por linha:  email;senha
//   a 1ª linha é a caixa padrão. Se o e-mail de envio do vendedor (perfis.email_envio) tiver linha própria, sai dele;
//   senão sai da caixa padrão com "Responder para" o vendedor.
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

  let b: any;
  try { b = await req.json(); } catch { return json({ erro: 'Pedido inválido' }, 400); }
  const para = [...new Set((b.para || []).map((x: string) => String(x).trim().toLowerCase()).filter(emailOk))] as string[];
  const cc = [...new Set((b.cc || []).map((x: string) => String(x).trim().toLowerCase()).filter(emailOk))] as string[];
  if (!para.length) return json({ erro: 'Nenhum destinatário válido.' }, 400);
  if (para.length + cc.length > 20) return json({ erro: 'Destinatários demais (máx. 20).' }, 400);
  const assunto = String(b.assunto || '').slice(0, 300) || 'Orçamento Chamae';
  const texto = String(b.texto || '').slice(0, 20000);
  const ref = b.ref || {};

  const C = contas();
  if (!C.length) return json({ erro: 'O envio de e-mail ainda não foi configurado (falta o secret SMTP_CONTAS no Supabase).' }, 503);
  const vend = String(perfil.email_envio || (String(perfil.email || user.email || '').endsWith('@chamae.com.br') ? perfil.email || user.email : '') || '').toLowerCase();
  const conta = C.find((c) => c.email === vend) || C[0];
  const nome = (perfil.nome || 'Chamae') + ' · Chamae Representações';

  const anexos = [];
  if (b.anexo?.base64) {
    const tam = Math.floor(String(b.anexo.base64).length * 3 / 4);
    if (tam > 15 * 1024 * 1024) return json({ erro: 'PDF grande demais para enviar por e-mail.' }, 413);
    anexos.push({ filename: String(b.anexo.nome || 'orcamento.pdf').replace(/[\\/:*?"<>|]/g, '_'), content: b.anexo.base64, encoding: 'base64', contentType: 'application/pdf' });
  }

  const log = { ref_tipo: ref.tipo || null, ref_id: ref.id ? String(ref.id) : null, cnpj: ref.cnpj || null, de: conta.email, para, cc, assunto, anexo: anexos[0]?.filename || null, enviado_por: user.id };
  try {
    const t = nodemailer.createTransport({ host: HOST, port: PORT, secure: PORT === 465, auth: { user: conta.email, pass: conta.senha }, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000 });
    const info = await t.sendMail({
      from: { name: nome, address: conta.email },
      replyTo: vend && vend !== conta.email ? vend : undefined,
      to: para, cc: cc.length ? cc : undefined,
      subject: assunto, text: texto, attachments: anexos,
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
