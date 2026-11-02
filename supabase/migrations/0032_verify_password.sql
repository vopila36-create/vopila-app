-- ============================================================================
-- VOPILA — Şifre değiştirirken mevcut şifre kontrolü (kilidi açık telefonu eline alan biri şifreyi
-- değiştiremesin). Deneme sınırı: 15 dakikada 5. Hata fırlatılmaz (deneme kaydı geri alınmasın diye
-- sonuç metin olarak döner): ok | wrong | rate_limited | no_password
-- ============================================================================

create table if not exists private.password_check_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists password_check_attempts_idx on private.password_check_attempts (user_id, at);
revoke all on private.password_check_attempts from public, anon, authenticated;

create or replace function private.verify_my_password(p_password text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hash text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from private.password_check_attempts where at < now() - interval '15 minutes';
  if (select count(*) from private.password_check_attempts where user_id = v_uid) >= 5 then
    return 'rate_limited';
  end if;
  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_hash is null or v_hash = '' then
    return 'no_password';
  end if;
  if extensions.crypt(coalesce(p_password, ''), v_hash) = v_hash then
    delete from private.password_check_attempts where user_id = v_uid;
    return 'ok';
  end if;
  insert into private.password_check_attempts (user_id) values (v_uid);
  return 'wrong';
end;
$$;
revoke execute on function private.verify_my_password(text) from public, anon;
grant execute on function private.verify_my_password(text) to authenticated;

create or replace function public.verify_my_password(p_password text)
returns text
language plpgsql security invoker set search_path = ''
as $$
begin
  perform private.require_aal();
  return private.verify_my_password(p_password);
end;
$$;
revoke execute on function public.verify_my_password(text) from public, anon;
grant execute on function public.verify_my_password(text) to authenticated;
