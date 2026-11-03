// email-rastreio (03/11): saber quem abriu e clicou nos E-mails do dia.
// GET ?t=<rastreio>          → imagem 1x1 no fim do e-mail: marca aberto_em e soma aberturas
// GET ?t=<rastreio>&c=1&u=…  → botões do e-mail passam por aqui: marca clicado_em e redireciona (só mailto:, WhatsApp e o site do Grupo Chamae)
// Publicar com verify_jwt = false (o cliente que abre o e-mail não tem login). Só grava pela função reativacao_rastrear.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const SITE = "https://chamaeescritorio1-boop.github.io/medix-luvas/";
const SEGURO = /^(mailto:[^\s]+|https:\/\/(wa\.me|api\.whatsapp\.com|chamaeescritorio1-boop\.github\.io)(\/|$))/i;

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const t = u.searchParams.get("t") || "";
  const clique = u.searchParams.get("c") === "1";
  if (/^[0-9a-f-]{36}$/i.test(t)) {
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.rpc("reativacao_rastrear", { p_t: t, p_clique: clique });
    } catch (_) { /* nunca quebra o e-mail do cliente */ }
  }
  if (clique) {
    const dest = u.searchParams.get("u") || "";
    return new Response(null, { status: 302, headers: { Location: SEGURO.test(dest) ? dest : SITE, "Cache-Control": "no-store" } });
  }
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, max-age=0" } });
});
