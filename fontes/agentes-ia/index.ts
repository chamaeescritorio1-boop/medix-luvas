// Agentes de IA do Sistema Chamae (Fase 1): recebe as oportunidades do dia que o app já encontrou por regras
// (carteira parada, orçamento sem retorno, ritmo da meta) e devolve, para cada uma, por que importa,
// o que falar e uma mensagem de WhatsApp pronta. Os números vêm do app; a IA só redige e prioriza.
// Chamado por agHoje() no app.js com { vendedor, meta, itens:[{k, agente, cliente, rep, fatos}] }.
// Secret: GROQ_API_KEY (IA grátis; o mesmo das ligações). GROQ_LLM_MODEL fixa um modelo (opcional).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PREF_GROQ = ['openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];
let modeloGroq: string | null = null;
async function escolherModelo(key: string, ruim?: string) {
  const fixo = Deno.env.get('GROQ_LLM_MODEL');
  if (fixo && fixo !== ruim) return fixo;
  if (modeloGroq && modeloGroq !== ruim) return modeloGroq;
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + key } });
  if (r.status === 401) throw new Error('A chave da Groq não foi aceita (secret GROQ_API_KEY).');
  const ids: string[] = r.ok ? ((await r.json()).data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id)) : [];
  const ok = ids.filter((id) => id !== ruim && !/whisper|tts|guard|distil|playai|orpheus|compound/i.test(id));
  modeloGroq = PREF_GROQ.find((m) => ok.includes(m)) || ok.find((id) => /gpt-oss|kimi|llama|qwen|gemma|mistral/i.test(id)) || ok[0] || null;
  if (!modeloGroq) throw new Error('Nenhum modelo de IA disponível na conta Groq.');
  return modeloGroq;
}

const SISTEMA = `Você é o assistente de vendas da Chamae, um escritório de representação comercial B2B (EPI, calçados e luvas de segurança, ferramentas: Marluvas, Medix, Sigma Tools, Marcon, Camper e outras).
Recebe a lista de oportunidades do dia de UM vendedor, já encontradas pelo sistema com números reais. Para cada oportunidade escreva em português do Brasil, curto e direto:
- "prioridade": 1 (fazer primeiro), 2 ou 3. Considere valor, risco de perder o cliente e se a fábrica está atrasada na meta do mês.
- "porque": uma frase (máx. 20 palavras) dizendo por que vale agir hoje, citando o número que importa.
- "falar": uma sugestão prática do que dizer ou oferecer na ligação (máx. 30 palavras). Nada de inventar preço, desconto, prazo ou produto que não esteja nos fatos.
- "whatsapp": mensagem pronta para o cliente, cordial e informal-profissional, 2 a 4 frases, sem emojis em excesso, sem citar números internos (ciclo de compra, meta, ranking). Comece com "Olá" e não assine.
Responda SOMENTE com JSON: {"itens":[{"k":"<mesma chave recebida>","prioridade":1,"porque":"","falar":"","whatsapp":""}]}. Inclua todas as chaves recebidas.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('GROQ_API_KEY');
    if (!key) return json({ erro: 'Falta o secret GROQ_API_KEY no Supabase.' }, 500);
    const body = await req.json();
    const itens = (Array.isArray(body.itens) ? body.itens : []).slice(0, 15);
    if (!itens.length) return json({ itens: [] });
    const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const msg = `Hoje é ${hoje}. Vendedor: ${String(body.vendedor || 'não informado').slice(0, 60)}.
<meta_do_mes>
${String(body.meta || 'sem meta cadastrada').slice(0, 1500)}
</meta_do_mes>
<oportunidades>
${JSON.stringify(itens).slice(0, 12000)}
</oportunidades>`;
    let modelo = await escolherModelo(key), ultimo = '';
    for (let t = 0; t < 3; t++) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, response_format: { type: 'json_object' }, max_tokens: 6000, temperature: 0.4,
          messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: msg }] }),
      });
      const tx = await r.text();
      if (r.status === 429) return json({ erro: 'Limite grátis da Groq atingido; tente mais tarde.' }, 429);
      if (!r.ok) { ultimo = tx; if (/model_not_found|decommissioned|does not exist|not supported/i.test(tx)) { modeloGroq = null; modelo = await escolherModelo(key, modelo); } continue; }
      try {
        const o = JSON.parse(JSON.parse(tx).choices[0].message.content);
        const s = (x: unknown, n: number) => String(x ?? '').slice(0, n);
        const out = (Array.isArray(o.itens) ? o.itens : []).map((x: any) => ({ k: s(x.k, 200), prioridade: Math.min(3, Math.max(1, +x.prioridade || 2)), porque: s(x.porque, 300), falar: s(x.falar, 400), whatsapp: s(x.whatsapp, 800) }));
        return json({ itens: out, modelo: JSON.parse(tx).model });
      } catch (_) { ultimo = 'resposta fora do formato'; }
    }
    return json({ erro: 'Falha na IA grátis: ' + ultimo.slice(0, 200) }, 502);
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
