-- Desfaz: volta a função agentes_itens como estava em 02/11/2026
CREATE OR REPLACE FUNCTION public.agentes_itens()
 RETURNS TABLE(tipo text, cnpj text, rep text, cod text, descr text, n integer, ultimo date, valor numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
with pi as (select regexp_replace(p.cnpj,'\D','','g') cn, p.representada rp, p.data_ref d, upper(trim(i.cod)) cd, max(i.descricao) ds, sum(coalesce(i.total,i.qtd*i.preco,0)) v
  from pedidos p join pedido_itens i on i.pedido_id=p.id
  where p.data_ref > current_date - 540 and p.data_ref <= current_date
    and (p.status is null or p.status in ('finalizado','para_transmitir') or p.status ilike 'aprovado%')
    and coalesce(p.cnpj,'')<>'' and coalesce(i.cod,'')<>''
  group by 1,2,3,4),
cr as (select cn, rp, max(d) lp from pi group by 1,2),
it as (select cn, rp, cd, max(ds) ds, count(distinct d)::int n, max(d) li, avg(v) vm,
   bool_or(d between current_date-372 and current_date-335) ep, bool_or(d > current_date-60) rec from pi group by 1,2,3)
select 'sumiu'::text, it.cn, it.rp, it.cd, it.ds, it.n, it.li, round(it.vm,2) from it join cr using (cn,rp)
  where it.n>=3 and it.li < current_date-60 and cr.lp >= current_date-120
    and (select count(distinct pi.d) from pi where pi.cn=it.cn and pi.rp=it.rp and pi.d>it.li)>=2
union all
select 'epoca'::text, it.cn, it.rp, it.cd, it.ds, it.n, it.li, round(it.vm,2) from it where it.ep and not it.rec
$function$;
