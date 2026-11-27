-- Cartão "placar" para pedir retorno do orçamento (link público por código)
create extension if not exists pgcrypto;
create table if not exists public.retornos (
  id bigint generated always as identity primary key,
  token text not null unique default encode(extensions.gen_random_bytes(12),'hex'),
  tipo text not null default 'orcamento',
  orcamento_id text, num text, rep text,
  cnpj text, cliente text, comprador text,
  total numeric, itens int,
  vendedor_id uuid default auth.uid(), vendedor_nome text,
  canal text,
  criado_em timestamptz not null default now(),
  aberto_em timestamptz,
  resposta text, detalhe jsonb, respondido_em timestamptz
);
alter table public.retornos enable row level security;
drop policy if exists p_ret_sel on public.retornos;
drop policy if exists p_ret_ins on public.retornos;
create policy p_ret_sel on public.retornos for select to authenticated using (eh_equipe());
create policy p_ret_ins on public.retornos for insert to authenticated with check (eh_equipe());
revoke all on public.retornos from anon;
grant select, insert on public.retornos to authenticated;
create index if not exists retornos_orc on public.retornos(orcamento_id);

-- o cliente (sem login) vê só os dados do cartão daquele código
create or replace function public.retorno_ver(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.retornos;
begin
  if p_token is null or length(p_token)<20 then return null; end if;
  select * into r from public.retornos where token=p_token;
  if not found then return null; end if;
  if r.aberto_em is null then update public.retornos set aberto_em=now() where id=r.id; end if;
  return jsonb_build_object('tipo',r.tipo,'num',r.num,'rep',r.rep,'cliente',r.cliente,'comprador',r.comprador,
    'total',r.total,'itens',r.itens,'vendedor',r.vendedor_nome,'resposta',r.resposta,'detalhe',r.detalhe,
    'criado_em',r.criado_em,'respondido_em',r.respondido_em);
end $$;

-- o cliente responde: grava, registra contato na ficha e cria tarefa para o vendedor
create or replace function public.retorno_responder(p_token text, p_resposta text, p_detalhe jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.retornos; tx text; tit text; volta date; d jsonb := coalesce(p_detalhe,'{}'::jsonb);
begin
  if p_resposta not in ('fechar','ajustar','nao') then raise exception 'resposta inválida'; end if;
  if length(d::text)>2000 then raise exception 'texto muito grande'; end if;
  select * into r from public.retornos where token=p_token for update;
  if not found then raise exception 'link inválido'; end if;
  if r.criado_em < now()-interval '60 days' then raise exception 'link expirado'; end if;
  update public.retornos set resposta=p_resposta, detalhe=d, respondido_em=now(), aberto_em=coalesce(aberto_em,now()) where id=r.id;
  tit := case p_resposta when 'fechar' then '⚽ GOL! Cliente quer fechar' when 'ajustar' then '🔄 Cliente pediu ajuste' else '🤝 Cliente: fica pro próximo jogo' end;
  tx := tit||' — orçamento '||coalesce(r.num,'')||' ('||coalesce(r.rep,'')||')'
    ||case when coalesce(d->>'texto','')<>'' then ': '||(d->>'texto') else '' end
    ||case when coalesce(d->>'motivo','')<>'' then ' · motivo: '||(d->>'motivo') else '' end
    ||' [respondeu pelo cartão placar'||case when coalesce(r.comprador,'')<>'' then ', '||r.comprador else '' end||']';
  volta := case p_resposta when 'nao' then current_date + coalesce(nullif(d->>'dias','')::int,30) else null end;
  if r.cnpj is not null then
    insert into public.contatos(user_id,cnpj,representada,tipo,texto,retorno,resultado,usuario_nome)
    values (r.vendedor_id,r.cnpj,r.rep,'whatsapp',left(tx,1500),volta,
      case p_resposta when 'fechar' then 'Vai comprar' when 'ajustar' then 'Vai pensar' else 'Retornar depois' end,
      r.vendedor_nome);
  end if;
  if p_resposta <> 'nao' then
    insert into public.tarefas(titulo,tipo,cnpj,cliente,rep,orcamento_id,vence,responsavel,responsavel_nome,feita,obs,criado_por)
    values (left(tit||' – '||coalesce(r.cliente,''),200),'followup',r.cnpj,r.cliente,r.rep,r.orcamento_id,current_date,
      r.vendedor_id,r.vendedor_nome,false,left(tx,1500),r.vendedor_id);
  end if;
  return jsonb_build_object('ok',true,'vendedor',r.vendedor_nome);
end $$;

revoke all on function public.retorno_ver(text) from public;
revoke all on function public.retorno_responder(text,text,jsonb) from public;
grant execute on function public.retorno_ver(text) to anon, authenticated;
grant execute on function public.retorno_responder(text,text,jsonb) to anon, authenticated;
