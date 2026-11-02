-- ============================================================================
-- VOPILA — 0032 düzeltmesi (güvenlik incelemesi): aynı anda gönderilen çok sayıda deneme sayaç
-- kontrolünü aşamasın. Kişi başına işlem kilidi alınır; sayma + kaydetme bu kilit altında yapılır.
-- ============================================================================
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
  -- Aynı kullanıcının denemeleri sıraya girer (işlem bitince kilit kendiliğinden bırakılır)
  perform pg_advisory_xact_lock(hashtext('verify_my_password:' || v_uid::text));
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
