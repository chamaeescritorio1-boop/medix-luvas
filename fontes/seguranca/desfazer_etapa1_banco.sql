-- Desfaz a etapa 1: volta as permissões como estavam em 02/11/2026.
drop trigger if exists tg_perfis_trava on public.perfis;
drop function if exists public.perfis_trava();
grant update on public.perfis to anon;
grant execute on function public.atualizar_resumos(), public.proximo_numero() to anon, authenticated, public;
alter function public.meu_email() reset search_path;
