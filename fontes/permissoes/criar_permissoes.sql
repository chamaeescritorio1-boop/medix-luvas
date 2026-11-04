-- Permissões por pessoa (o gestor liga e desliga na tela Equipe).
-- Fica numa tabela própria: o vendedor NÃO consegue se dar permissão (só gestor grava).
create table if not exists public.permissoes(
  uid uuid not null references public.perfis(id) on delete cascade,
  chave text not null check (chave in ('reps','camp')),
  por uuid default auth.uid(),
  em timestamptz default now(),
  primary key(uid,chave));
alter table public.permissoes enable row level security;
drop policy if exists p_perm_ler on public.permissoes;
create policy p_perm_ler on public.permissoes for select using (eh_equipe());
drop policy if exists p_perm_ges on public.permissoes;
create policy p_perm_ges on public.permissoes for all using (eh_gestor()) with check (eh_gestor());

create or replace function public.tem_perm(k text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select eh_gestor() or (eh_equipe() and exists(select 1 from permissoes x where x.uid=auth.uid() and x.chave=k))
$$;
revoke execute on function public.tem_perm(text) from anon;

-- Representadas: quem tem 'reps' pode ALTERAR (dados, prazos, arquivos, contatos, PDF). Criar/apagar continua só gestor.
drop policy if exists p_rep_perm_upd on public.representadas;
create policy p_rep_perm_upd on public.representadas for update using (tem_perm('reps')) with check (tem_perm('reps'));
-- Campanhas: quem tem 'camp' cria, edita e apaga campanhas.
drop policy if exists p_camp_perm on public.campanhas;
create policy p_camp_perm on public.campanhas for all using (tem_perm('camp')) with check (tem_perm('camp'));
