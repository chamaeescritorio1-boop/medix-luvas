-- Pedidos de exclusão de cliente (vendedor pede com motivo, gestor aprova ou recusa).
-- Só ADICIONA uma tabela nova: não mexe em clientes, pedidos nem no Sistema oficial.
-- "Excluir" = status 'aprovado': o cliente some das listas do Sistema (Clientes, carteira,
-- busca do orçamento), mas pedidos, orçamentos e relatórios continuam intactos.
-- Restaurar = gestor muda o status para 'restaurado'.
create table if not exists public.cliente_exclusao (
  id bigserial primary key,
  cnpj text not null,
  cliente text,
  motivo text not null check (length(btrim(motivo)) >= 5),
  pedido_por text,
  pedido_por_id uuid default auth.uid(),
  pedido_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado','cancelado','restaurado')),
  decidido_por text,
  decidido_em timestamptz,
  resposta text
);
-- no máximo um pedido aberto (pendente) ou exclusão valendo (aprovado) por cliente
create unique index if not exists cliente_exclusao_ativo on public.cliente_exclusao (cnpj) where status in ('pendente','aprovado');
alter table public.cliente_exclusao enable row level security;
-- toda a equipe vê
create policy p_cexc_sel on public.cliente_exclusao for select using (public.eh_equipe());
-- vendedor só cria pedido PENDENTE em nome próprio; gestor pode criar já aprovado
create policy p_cexc_ins on public.cliente_exclusao for insert with check (
  public.eh_equipe() and pedido_por_id = auth.uid()
  and (status = 'pendente' or public.eh_gestor()));
-- só o gestor aprova, recusa ou restaura
create policy p_cexc_upd_gestor on public.cliente_exclusao for update using (public.eh_gestor()) with check (public.eh_gestor());
-- quem pediu pode cancelar o próprio pedido enquanto está pendente
create policy p_cexc_upd_cancel on public.cliente_exclusao for update
  using (public.eh_equipe() and pedido_por_id = auth.uid() and status = 'pendente')
  with check (pedido_por_id = auth.uid() and status = 'cancelado');
grant select, insert, update on public.cliente_exclusao to authenticated;
grant usage, select on sequence public.cliente_exclusao_id_seq to authenticated;
