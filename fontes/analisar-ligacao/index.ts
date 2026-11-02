// Transcreve e analisa uma ligação (ou um resumo falado) enviada pelo Sistema Chamae.
// Chamado por ligIA() no app.js com { id } de uma linha da tabela `ligacoes` (áudio no bucket arquivos, ligacoes/<cnpj>/...).
// Responde na hora e trabalha em segundo plano; o app acompanha pela coluna `status`:
//   enviado → transcrevendo → analisando → pronto  (ou erro, com a mensagem em `erro`).
// Secrets (Supabase › Edge Functions › Secrets):
//   ANTHROPIC_API_KEY  – opcional: resumo, próximos passos e feedback com o Claude (pago, melhor feedback)
//                        sem ela, o resumo usa a IA grátis da Groq (escolhe sozinho um modelo ativo; GROQ_LLM_MODEL fixa um)
//   GROQ_API_KEY       – transcrição (Whisper na Groq, tem plano grátis)  …ou OPENAI_API_KEY (Whisper da OpenAI)
//   CLAUDE_MODEL       – opcional, padrão claude-opus-5-5
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODELO = Deno.env.get('CLAUDE_MODEL') || 'claude-opus-5-5';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const rest = (path: string, init: RequestInit = {}) =>
  fetch(SB + '/rest/v1/' + path, { ...init, headers: { apikey: SRV, Authorization: 'Bearer ' + SRV, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const restJson = async (path: string) => { const r = await rest(path); return r.ok ? await r.json() : []; };
const marcar = (id: number, campos: Record<string, unknown>) =>
  rest(`ligacoes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...campos, atualizado_em: new Date().toISOString() }) });

// Palavras do dia a dia da Chamae, para a transcrição acertar nomes e termos.
const GLOSSARIO = 'Chamae, Marluvas, Medix, Sigma, Marcon, Gurgelmix, Camper, EPI, CA, luva nitrílica, luva de vaqueta, botina, bota de PVC, calçado de segurança, orçamento, pedido, ordem de compra, boleto, prazo, tabela, frete CIF, FOB.';

function chaveTranscricao() {
  const groq = Deno.env.get('GROQ_API_KEY');
  if (groq) return { url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: groq, modelo: 'whisper-large-v3' };
  const oa = Deno.env.get('OPENAI_API_KEY');
  if (oa) return { url: 'https://api.openai.com/v1/audio/transcriptions', key: oa, modelo: 'whisper-1' };
  return null;
}

async function transcrever(lig: any) {
  const cfg = chaveTranscricao()!;
  const a = await fetch(`${SB}/storage/v1/object/arquivos/${lig.audio_path}`, { headers: { apikey: SRV, Authorization: 'Bearer ' + SRV } });
  if (!a.ok) throw new Error('Não encontrei o áudio enviado. Envie de novo.');
  const blob = await a.blob();
  if (blob.size > 25 * 1024 * 1024) throw new Error('Áudio grande demais (máx. 25 MB, cerca de 25 minutos). Corte ou envie em partes.');
  const fd = new FormData();
  fd.append('file', blob, lig.audio_nome || 'ligacao.m4a');
  fd.append('model', cfg.modelo);
  fd.append('language', 'pt');
  fd.append('response_format', 'verbose_json');
  fd.append('prompt', GLOSSARIO);
  const r = await fetch(cfg.url, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key }, body: fd });
  const tx = await r.text();
  if (!r.ok) {
    if (r.status === 401) throw new Error('A chave do serviço de transcrição não foi aceita. Confira o secret no Supabase.');
    if (r.status === 429) throw new Error('Limite do serviço de transcrição atingido. Tente de novo em alguns minutos.');
    if (/format|decode|invalid file|unsupported/i.test(tx)) throw new Error('Formato de áudio não aceito. Use m4a, mp3, wav, ogg, webm ou mp4.');
    throw new Error('Falha na transcrição: ' + tx.slice(0, 200));
  }
  const j = JSON.parse(tx);
  return { texto: String(j.text || '').trim(), duracao: j.duration ? Math.round(+j.duration) : null };
}

async function contexto(cnpj: string) {
  if (!cnpj) return 'Cliente não identificado.';
  const [cli, cts, peds, orcs, tars] = await Promise.all([
    restJson(`clientes?cnpj=eq.${cnpj}&select=razao,fantasia,cidade,uf,segmento,vendedor`),
    restJson(`contatos?cnpj=eq.${cnpj}&select=criado_em,tipo,resultado,texto,usuario_nome&order=criado_em.desc&limit=5`),
    restJson(`pedidos?cnpj=eq.${cnpj}&select=data,representada,valor,status,prazo,pedido_itens(cod,descricao,qtd,preco)&order=data.desc&limit=8`),
    restJson(`orcamentos?cnpj=eq.${cnpj}&select=app,total,situacao,status,atualizado_em&order=atualizado_em.desc&limit=5`),
    restJson(`tarefas?cnpj=eq.${cnpj}&feita=eq.false&select=titulo,vence,hora&order=vence&limit=5`),
  ]);
  const c = cli[0] || {};
  const L: string[] = [];
  L.push(`Cliente: ${c.razao || cnpj}${c.fantasia ? ` (${c.fantasia})` : ''} · ${[c.cidade, c.uf].filter(Boolean).join('/')}${c.segmento ? ' · segmento ' + c.segmento : ''}${c.vendedor ? ' · vendedor ' + c.vendedor : ''}`);
  if (cts.length) L.push('Últimos contatos:\n' + cts.map((x: any) => `- ${String(x.criado_em).slice(0, 10)} ${x.tipo || ''}${x.usuario_nome ? ' (' + x.usuario_nome + ')' : ''}: ${x.resultado ? '[' + x.resultado + '] ' : ''}${String(x.texto || '').slice(0, 300)}`).join('\n'));
  if (peds.length) L.push('Últimos pedidos:\n' + peds.map((p: any) => `- ${p.data} ${p.representada} R$ ${(+p.valor || 0).toFixed(2)}${p.prazo ? ' prazo ' + p.prazo : ''}: ` + (p.pedido_itens || []).slice(0, 6).map((i: any) => `${i.qtd}x ${i.cod} ${String(i.descricao || '').slice(0, 50)} R$ ${(+i.preco || 0).toFixed(2)}`).join('; ')).join('\n'));
  if (orcs.length) L.push('Orçamentos recentes:\n' + orcs.map((o: any) => `- ${String(o.atualizado_em).slice(0, 10)} ${o.app} R$ ${(+o.total || 0).toFixed(2)} ${o.situacao || o.status || ''}`).join('\n'));
  if (tars.length) L.push('Retornos já agendados:\n' + tars.map((t: any) => `- ${t.vence}${t.hora ? ' ' + t.hora : ''} ${t.titulo}`).join('\n'));
  return L.join('\n\n');
}

const lista = { type: 'array', items: { type: 'string' } };
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo_audio', 'resumo', 'pontos_chave', 'proximos_passos', 'resultado', 'proximo_contato', 'feedback', 'alertas'],
  properties: {
    tipo_audio: { type: 'string', enum: ['conversa', 'resumo_do_vendedor', 'sem_conteudo'] },
    resumo: { type: 'string' },
    pontos_chave: lista,
    proximos_passos: lista,
    resultado: { type: 'string', enum: ['Pediu orçamento', 'Vai comprar', 'Sem demanda agora', 'Não atendeu', 'Retornar depois', 'Outro'] },
    proximo_contato: {
      type: 'object', additionalProperties: false, required: ['data', 'hora', 'motivo'],
      properties: { data: { type: 'string' }, hora: { type: 'string' }, motivo: { type: 'string' } },
    },
    feedback: {
      type: 'object', additionalProperties: false, required: ['pontos_fortes', 'melhorar', 'frase_sugerida'],
      properties: { pontos_fortes: lista, melhorar: lista, frase_sugerida: { type: 'string' } },
    },
    alertas: lista,
  },
};

const SISTEMA = `Você ajuda a equipe de vendas da Chamae, uma representação comercial de EPIs (luvas, calçados de segurança e afins) que vende para empresas em nome de várias fábricas (Marluvas, Medix, Sigma, Marcon e outras).
Você recebe a transcrição automática de uma ligação entre um vendedor da Chamae e um cliente, ou um resumo que o próprio vendedor falou depois da ligação, junto com o histórico do cliente no sistema.
A transcrição não separa quem fala e pode ter erros em nomes, códigos e números: deduza pelo contexto quem é o vendedor e quem é o cliente, e use o histórico para corrigir nomes de produtos quando for claro.

Responda em português do Brasil, direto e prático, como um gerente de vendas experiente falaria com o vendedor:
- resumo: 2 a 5 frases com o que foi conversado e como o cliente está.
- pontos_chave: fatos concretos ditos (produtos, quantidades, preços, prazos, concorrente citado, objeções, pessoa de contato, prazo de compra). Só o que foi dito.
- proximos_passos: ações claras que o vendedor precisa fazer, em ordem.
- resultado: a opção que melhor descreve como terminou a conversa.
- proximo_contato: data (AAAA-MM-DD) e hora (HH:MM) do próximo contato. Use o que foi combinado na conversa; se nada foi combinado, sugira uma data razoável para o caso (dia útil). Hora vazia se não foi combinada. Data vazia só se não fizer sentido voltar a ligar. motivo: o que fazer nesse contato.
- feedback: com base no que aparece na transcrição, pontos_fortes do vendedor e o que ele poderia ter feito diferente (melhorar), sempre citando o momento da conversa. Pense em: descobrir necessidade e volume, oferecer itens que o cliente costuma comprar ou complementares, tratar objeção de preço, criar urgência, fechar com um próximo passo e data. frase_sugerida: uma frase pronta que o vendedor poderia ter usado. Se o áudio for só um resumo do vendedor, diga que o feedback é limitado e foque no que ele contou.
- alertas: riscos ou oportunidades importantes (cliente insatisfeito, comprando de concorrente, pedido grande à vista, reclamação). Lista vazia se não houver.
Se o áudio não tiver conteúdo útil (silêncio, caixa postal, ruído), use tipo_audio "sem_conteudo", resultado "Não atendeu" se for o caso, e listas vazias.`;

// Modelos de texto da Groq em ordem de preferência; a Groq tira modelos do ar, então escolhe o primeiro que a conta tiver.
const PREF_GROQ = ['openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];
let modeloGroq: string | null = null;
async function escolherModeloGroq(key: string, ruim?: string) {
  const fixo = Deno.env.get('GROQ_LLM_MODEL');
  if (fixo && fixo !== ruim) return fixo;
  if (modeloGroq && modeloGroq !== ruim) return modeloGroq;
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + key } });
  if (r.status === 401) throw new Error('A chave da Groq não foi aceita. Confira o secret GROQ_API_KEY no Supabase.');
  const ids: string[] = r.ok ? ((await r.json()).data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id)) : [];
  const ok = ids.filter((id) => id !== ruim && !/whisper|tts|guard|distil|playai|orpheus|compound/i.test(id));
  modeloGroq = PREF_GROQ.find((m) => ok.includes(m)) || ok.find((id) => /gpt-oss|kimi|llama|qwen|gemma|mistral/i.test(id)) || ok[0] || null;
  if (!modeloGroq) throw new Error('Não achei nenhum modelo de IA disponível na sua conta Groq.');
  return modeloGroq;
}

async function analisarGroq(msg: string) {
  const key = Deno.env.get('GROQ_API_KEY')!;
  let modelo = await escolherModeloGroq(key);
  const sis = SISTEMA + '\n\nResponda SOMENTE com um objeto JSON neste formato (todas as chaves, listas podem ser vazias): ' + JSON.stringify(ESQUEMA);
  let ultimo = '';
  for (let t = 0; t < 3; t++) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, response_format: { type: 'json_object' }, max_tokens: 8000,
        messages: [{ role: 'system', content: sis }, { role: 'user', content: msg }] }),
    });
    const tx = await r.text();
    if (r.status === 401) throw new Error('A chave da Groq não foi aceita. Confira o secret GROQ_API_KEY no Supabase.');
    if (r.status === 429) throw new Error('Limite grátis da Groq atingido. Tente de novo em alguns minutos.');
    if (!r.ok) { ultimo = tx; if (/model_not_found|decommissioned|does not exist|not supported/i.test(tx)) { modeloGroq = null; modelo = await escolherModeloGroq(key, modelo); } continue; }
    try {
      const o = JSON.parse(JSON.parse(tx).choices[0].message.content);
      const arr = (x: unknown) => Array.isArray(x) ? x.map(String) : [];
      const pc = o.proximo_contato || {}, fb = o.feedback || {};
      return { tipo_audio: String(o.tipo_audio || 'conversa'), resumo: String(o.resumo || ''), pontos_chave: arr(o.pontos_chave), proximos_passos: arr(o.proximos_passos),
        resultado: String(o.resultado || 'Outro'), proximo_contato: { data: String(pc.data || ''), hora: String(pc.hora || ''), motivo: String(pc.motivo || '') },
        feedback: { pontos_fortes: arr(fb.pontos_fortes), melhorar: arr(fb.melhorar), frase_sugerida: String(fb.frase_sugerida || '') }, alertas: arr(o.alertas),
        modelo: JSON.parse(tx).model };
    } catch (_) { ultimo = 'resposta fora do formato'; }
  }
  throw new Error('Falha na IA grátis: ' + ultimo.slice(0, 200));
}

async function analisar(lig: any, transcricao: string) {
  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const ctx = await contexto(lig.cnpj);
  const msg = `Hoje é ${hoje} (${iso}). Vendedor: ${lig.usuario_nome || 'não informado'}.
Origem do áudio: ${lig.origem === 'resumo_falado' ? 'resumo falado pelo vendedor depois da ligação' : 'gravação da ligação'}.

<historico_do_cliente>
${ctx}
</historico_do_cliente>

<transcricao>
${transcricao}
</transcricao>`;
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return analisarGroq(msg);
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const r = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: msg }],
  });
  if (r.stop_reason === 'refusal') throw new Error('A IA não conseguiu analisar este áudio.');
  if (r.stop_reason === 'max_tokens') throw new Error('A análise ficou longa demais. Tente de novo.');
  const txt = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const out = JSON.parse(txt);
  out.modelo = r.model;
  return out;
}

async function processar(lig: any) {
  try {
    let texto = lig.transcricao as string | null;
    if (!texto) {
      await marcar(lig.id, { status: 'transcrevendo', erro: null });
      const t = await transcrever(lig);
      texto = t.texto;
      await marcar(lig.id, { transcricao: texto, duracao_seg: t.duracao });
    }
    if (!texto || texto.length < 5) throw new Error('Não deu para entender nada no áudio. Confira se a gravação tem som.');
    await marcar(lig.id, { status: 'analisando' });
    const analise = await analisar(lig, texto);
    await marcar(lig.id, { status: 'pronto', analise, erro: null });
  } catch (e) {
    let m = e instanceof Error ? e.message : String(e);
    if (e instanceof Anthropic.AuthenticationError) m = 'A chave da IA (ANTHROPIC_API_KEY) não foi aceita. Confira o secret no Supabase.';
    else if (e instanceof Anthropic.RateLimitError) m = 'Limite da IA atingido. Tente de novo em alguns minutos.';
    else if (e instanceof Anthropic.APIError) m = 'Falha na IA: ' + m.slice(0, 200);
    await marcar(lig.id, { status: 'erro', erro: m.slice(0, 500) });
  }
}

// só a equipe aprovada (gestor/vendedor, fora do portal B2B)
async function ehEquipe(auth: string) {
  const r = await fetch(SB + '/rest/v1/rpc/eh_equipe', { method: 'POST', headers: { apikey: ANON, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST' }, 405);

  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: ANON, Authorization: req.headers.get('Authorization') || '' } });
  if (!u.ok) return json({ erro: 'Sessão expirada. Entre de novo no Sistema.' }, 401);
  const user = await u.json();
  const perfil = (await restJson(`perfis?id=eq.${user.id}&select=aprovado`))?.[0];
  if (!perfil?.aprovado) return json({ erro: 'Seu usuário ainda não foi aprovado.' }, 403);
  if (!(await ehEquipe(req.headers.get('Authorization') || ''))) return json({ erro: 'Sem acesso.' }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ erro: 'Pedido inválido' }, 400); }
  const id = +b.id;
  if (!id) return json({ erro: 'Ligação não informada' }, 400);
  const lig = (await restJson(`ligacoes?id=eq.${id}&select=*`))?.[0];
  if (!lig) return json({ erro: 'Ligação não encontrada' }, 404);
  if (!lig.audio_path && !lig.transcricao) return json({ erro: 'Essa ligação não tem áudio.' }, 400);

  const faltam: string[] = [];
  if (!lig.transcricao && !chaveTranscricao() && Deno.env.get('ANTHROPIC_API_KEY')) faltam.push('GROQ_API_KEY (transcrição)');
  if (!Deno.env.get('ANTHROPIC_API_KEY') && !Deno.env.get('GROQ_API_KEY')) faltam.push('GROQ_API_KEY (grátis, faz a transcrição e o resumo)');
  if (faltam.length) {
    const m = 'A análise de ligações ainda não foi configurada. Falta no Supabase: ' + faltam.join(' e ') + '.';
    await marcar(id, { status: 'erro', erro: m });
    return json({ erro: m }, 503);
  }
  if (b.reanalisar) await marcar(id, { analise: null });
  await marcar(id, { status: lig.transcricao ? 'analisando' : 'transcrevendo', erro: null });
  EdgeRuntime.waitUntil(processar(lig));
  return json({ ok: true, status: 'processando' });
});
