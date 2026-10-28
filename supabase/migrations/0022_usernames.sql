-- ============================================================================
-- VOPILA — Kullanıcı adı (Instagram gibi): kayıtta kişi kendisi seçer, her ad yalnızca bir kişiye ait
-- (büyük/küçük harf farkı yok: adlar zaten küçük harf). Yazarken anında "alınmış" kontrolü.
-- username_status: ok | invalid | taken | reserved
-- ============================================================================

create or replace function private.username_status(p text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p, ''))) !~ '^[a-z0-9_]{3,20}$' then 'invalid'
    when private.is_reserved_name(p) then 'reserved'
    when exists (select 1 from public.profiles x where x.username = lower(btrim(p))
                 and x.id is distinct from (select auth.uid())) then 'taken'
    else 'ok' end;
$$;
grant execute on function private.username_status(text) to anon, authenticated;

create or replace function public.username_status(p_username text)
returns text
language sql stable set search_path = ''
as $$ select private.username_status(p_username); $$;
grant execute on function public.username_status(text) to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate     text;
  display_name  text;
  v_birth       text := new.raw_user_meta_data ->> 'birth_date';
  v_group       text;
  v_wanted      text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if v_birth is null and new.raw_app_meta_data ->> 'provider' = 'email' then
    raise exception 'birth_date_required' using errcode = 'P0001';
  end if;
  if v_birth is not null then
    begin
      v_group := private.age_group_from(v_birth::date);
    exception when others then
      raise exception 'invalid_birth_date' using errcode = 'P0001';
    end;
    if v_group = 'under15' then
      raise exception 'under_15' using errcode = 'P0001';
    end if;
  end if;

  if v_wanted <> '' then
    -- Kullanıcının seçtiği ad (Instagram gibi): her ad yalnızca bir kişiye ait
    if private.username_status(v_wanted) <> 'ok' then
      raise exception 'username_%', private.username_status(v_wanted) using errcode = 'P0001';
    end if;
    candidate := v_wanted;
  else
    base_username := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
    if char_length(base_username) < 3 or private.is_reserved_name(base_username) then
      base_username := 'kasif';
    end if;
    candidate := base_username;
    while exists (select 1 from public.profiles p where p.username = candidate) loop
      candidate := base_username || '_' || substr(md5(random()::text), 1, 4);
    end loop;
  end if;

  display_name := left(coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    candidate
  ), 60);

  insert into public.profiles (id, username, name, avatar_url)
  values (
    new.id,
    candidate,
    display_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  if v_group is not null then
    perform private.apply_age_group(new.id, v_group, 'self');
    perform private.set_next_change(new.id, v_birth::date);
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' where id = new.id;
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- Ayrılmış ad kalıbı harf tekrarına dayanıklı ("vo.opila", "vvopiilaa" de yakalanır)
create or replace function private.is_reserved_name(p text)
returns boolean
language sql immutable set search_path = ''
as $$
  select regexp_replace(private.normalize_tr(p), '[^a-z]', '', 'g') ~ '[vw]+o+p+[il]+a';
$$;
