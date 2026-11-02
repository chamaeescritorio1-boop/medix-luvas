-- Agentes de IA (Fase 1): guarda o que cada vendedor fez com cada oportunidade do cartão "Hoje para você"
-- (feita / adiada / não faz sentido) e até quando ela fica escondida. Também serve para medir os agentes depois.
create table if not exists public.oportunidades (
  k text not null,
  user_id uuid not null,
  usuario_nome text,
  agente text,
  cnpj text,
  cliente text,
  rep text,
  valor numeric,
  status text,
  ate date,
  obs text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  primary key (k, user_id)
);
alter table public.oportunidades enable row level security;
drop policy if exists p_eq_oportunidades on public.oportunidades;
create policy p_eq_oportunidades on public.oportunidades for all using (eh_equipe()) with check (eh_equipe());
