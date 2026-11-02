-- Etapa 1 (segurança): só gestor muda aprovado/papel/email/id de um perfil via API;
-- vendedor só pode usar o próprio e-mail de login como e-mail de envio.
create or replace function public.perfis_trava() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(),'') in ('authenticated','anon') and not public.eh_gestor() then
    if new.id is distinct from old.id or new.aprovado is distinct from old.aprovado
       or new.papel is distinct from old.papel or new.email is distinct from old.email then
      raise exception 'Só um gestor pode mudar aprovação, papel ou e-mail de login.';
    end if;
    if new.email_envio is distinct from old.email_envio and new.email_envio is not null
       and lower(new.email_envio) <> lower(coalesce(old.email,'')) then
      raise exception 'O e-mail de envio precisa ser o seu e-mail de login. Peça a um gestor para usar outra caixa.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tg_perfis_trava on public.perfis;
create trigger tg_perfis_trava before update on public.perfis for each row execute function public.perfis_trava();
revoke update on public.perfis from anon;
-- Funções sem login
-- (eh_equipe/eh_gestor/meus_cnpjs ficam: as regras das tabelas usam e devolvem falso sem login)
revoke execute on function public.atualizar_resumos(), public.proximo_numero() from anon, public;
alter function public.meu_email() set search_path = public;
