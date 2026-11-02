-- Agentes do Início: mesma resposta, sem a subconsulta repetida linha a linha (7,5 s -> menos de 1 s)
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
dts as (select distinct cn, rp, d from pi),
it as (select cn, rp, cd, max(ds) ds, count(distinct d)::int n, max(d) li, avg(v) vm,
   bool_or(d between current_date-372 and current_date-335) ep, bool_or(d > current_date-60) rec from pi group by 1,2,3),
cand as (select it.* from it join cr using (cn,rp) where it.n>=3 and it.li < current_date-60 and cr.lp >= current_date-120),
ok as (select c.cn, c.rp, c.cd from cand c join dts on dts.cn=c.cn and dts.rp=c.rp and dts.d>c.li group by 1,2,3 having count(*)>=2)
select 'sumiu'::text, c.cn, c.rp, c.cd, c.ds, c.n, c.li, round(c.vm,2) from cand c join ok using (cn,rp,cd)
union all
select 'epoca'::text, it.cn, it.rp, it.cd, it.ds, it.n, it.li, round(it.vm,2) from it where it.ep and not it.rec
$function$;
