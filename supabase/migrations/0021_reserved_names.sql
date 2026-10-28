-- ============================================================================
-- VOPILA — "vopila" adı ayrılmış: kullanıcı adı ya da görünen adında "vopila" (ve benzer yazımları:
-- v0pila, VOPİLA, vo.pila, wopila, vopi1a…) geçen hesap açılamaz / ad değiştirilemez.
-- Yalnızca yönetici, Yönetim Paneli'nden (iki adımlı doğrulamayla) resmî ad verebilir.
-- ============================================================================

create or replace function private.is_reserved_name(p text)
returns boolean
language sql immutable set search_path = ''
as $$
  -- sadeleştir, harf dışını sil, sonra v/w + o + p + (i/l)+ + a kalıbı
  select regexp_replace(private.normalize_tr(p), '[^a-z]', '', 'g') ~ '[vw]op[il]+a';
$$;

create or replace function private.guard_reserved_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username and new.name is not distinct from old.name then
    return new;
  end if;
  -- Yönetici (iki adımlı doğrulamayla) ayrılmış adı kullanabilir; başka kimse kullanamaz
  if (private.is_reserved_name(new.username) or private.is_reserved_name(new.name)) and not private.is_admin() then
    raise exception 'reserved_name' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_reserved_name() from public, anon, authenticated;
drop trigger if exists guard_reserved_name on public.profiles;
create trigger guard_reserved_name before insert or update of username, name on public.profiles
  for each row execute function private.guard_reserved_name();

-- Kayıt: e-postadan türetilen kullanıcı adı ayrılmış ada denk gelirse "kasif" kullanılır;
-- görünen adda "vopila" varsa kayıt reddedilir (tetikleyici).
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

  base_username := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base_username) < 3 or private.is_reserved_name(base_username) then
    base_username := 'kasif';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    candidate := base_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

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

-- Yönetici: bir hesaba (resmî) kullanıcı adı ve görünen ad verir — "vopila" içeren adlar dahil
create or replace function private.admin_set_identity(p_user uuid, p_username text, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  update public.profiles set username = v_username, name = v_name where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'set_identity', 'user', p_user::text, jsonb_build_object('username', v_username, 'name', v_name));
end;
$$;
grant execute on function private.admin_set_identity(uuid, text, text) to authenticated;
revoke execute on function private.admin_set_identity(uuid, text, text) from public, anon;

create or replace function public.admin_set_identity(p_user uuid, p_username text, p_name text)
returns void
language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_set_identity(p_user, p_username, p_name); end; $$;
revoke execute on function public.admin_set_identity(uuid, text, text) from public, anon;
grant execute on function public.admin_set_identity(uuid, text, text) to authenticated;
