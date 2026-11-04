-- O que cada vendedor atende (Bater carteira e Plano do dia). Só o gestor grava; a equipe lê.
create table if not exists public.vendedor_carteira(
 vend text primary key,
 reps text[] not null default '{}',
 sem_clientes jsonb not null default '[]',
 atualizado_em timestamptz default now(),
 atualizado_por text);
alter table public.vendedor_carteira enable row level security;
drop policy if exists p_vcart_ler on public.vendedor_carteira;
create policy p_vcart_ler on public.vendedor_carteira for select using (eh_equipe());
drop policy if exists p_vcart_grv on public.vendedor_carteira;
create policy p_vcart_grv on public.vendedor_carteira for all using (eh_gestor()) with check (eh_gestor());
grant select,insert,update,delete on public.vendedor_carteira to authenticated;
