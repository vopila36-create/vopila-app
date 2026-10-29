-- ============================================================================
-- VOPILA — Kapalı beta: kayıt yalnızca davet koduyla açılır.
--  * Yönetici panelden kod üretir (her kod varsayılan 1 kişilik), bağlantıyı paylaşır.
--  * Kayıt sırasında kod sunucuda (handle_new_user) kontrol edilir ve harcanır; kodsuz kayıt reddedilir.
--  * "Kapalı beta" anahtarı kapatılınca herkes kodsuz kaydolabilir. Mevcut hesaplar etkilenmez.
-- ============================================================================

create table if not exists private.beta_settings (
  id boolean primary key default true check (id),
  invite_required boolean not null default true
);
insert into private.beta_settings (id) values (true) on conflict do nothing;

create table if not exists private.invites (
  code        text primary key check (code ~ '^[A-Z2-9]{8}$'),
  note        text check (char_length(note) <= 60),
  max_uses    integer not null default 1 check (max_uses between 1 and 100),
  used_count  integer not null default 0,
  revoked     boolean not null default false,
  expires_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists private.invite_uses (
  code     text not null references private.invites (code) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  used_at  timestamptz not null default now(),
  primary key (code, user_id)
);

revoke all on private.beta_settings, private.invites, private.invite_uses from public, anon, authenticated;

-- Kod durumu: ok | invalid | used | expired | revoked
create or replace function private.invite_code_status(p text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when i.code is null then 'invalid'
    when i.revoked then 'revoked'
    when i.expires_at is not null and i.expires_at < now() then 'expired'
    when i.used_count >= i.max_uses then 'used'
    else 'ok' end
  from (select 1) d
  left join private.invites i on i.code = upper(btrim(coalesce(p, '')));
$$;

create or replace function private.invite_required()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select invite_required from private.beta_settings), true); $$;

-- Herkese açık: kayıt ekranı kodu önceden kontrol eder (sunucu kayıtta yine kontrol eder)
create or replace function public.invite_status(p_code text)
returns text
language sql stable set search_path = ''
as $$
  select case when not private.invite_required() then 'not_required'
              else private.invite_code_status(p_code) end;
$$;
grant execute on function private.invite_code_status(text) to anon, authenticated;
grant execute on function private.invite_required() to anon, authenticated;
grant execute on function public.invite_status(text) to anon, authenticated;

-- ─── Kayıt: davet kodu zorunlu (kapalı beta açıkken) ─────────────────────────
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
  v_code        text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_inv         private.invites%rowtype;
begin
  -- Kapalı beta: geçerli davet kodu olmadan hesap açılmaz (kod kilitlenerek harcanır)
  if private.invite_required() then
    select * into v_inv from private.invites where code = v_code for update;
    if not found or v_inv.revoked or (v_inv.expires_at is not null and v_inv.expires_at < now())
       or v_inv.used_count >= v_inv.max_uses then
      raise exception 'invite_invalid' using errcode = 'P0001';
    end if;
    update private.invites set used_count = used_count + 1 where code = v_code;
    insert into private.invite_uses (code, user_id) values (v_code, new.id);
  end if;

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
  end if;
  -- Doğum tarihi ve davet kodu hesap bilgisinde tutulmaz
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' - 'invite_code' where id = new.id;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- ─── Yönetici ───────────────────────────────────────────────────────────────
create or replace function private.admin_create_invites(p_count integer, p_uses integer, p_note text, p_days integer)
returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_count not between 1 and 50 or p_uses not between 1 and 100 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  for i in 1 .. p_count loop
    loop
      select string_agg(substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1), '')
        into v_code from generate_series(1, 8);
      exit when not exists (select 1 from private.invites where code = v_code);
    end loop;
    insert into private.invites (code, note, max_uses, expires_at, created_by)
    values (v_code, nullif(left(btrim(coalesce(p_note, '')), 60), ''), p_uses,
            case when coalesce(p_days, 0) > 0 then now() + make_interval(days => p_days) end,
            (select auth.uid()));
    return next v_code;
  end loop;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'invites_created', 'invite', null,
          jsonb_build_object('count', p_count, 'uses', p_uses, 'note', p_note));
end;
$$;

create or replace function private.admin_list_invites()
returns table (code text, note text, max_uses integer, used_count integer, status text,
               expires_at timestamptz, created_at timestamptz, used_by text[])
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select i.code, i.note, i.max_uses, i.used_count, private.invite_code_status(i.code),
         i.expires_at, i.created_at,
         coalesce((select array_agg(p.username order by u.used_at)
                     from private.invite_uses u join public.profiles p on p.id = u.user_id
                    where u.code = i.code), '{}')
    from private.invites i
   order by i.created_at desc
   limit 500;
end;
$$;

create or replace function private.admin_revoke_invite(p_code text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update private.invites set revoked = true where code = upper(btrim(p_code));
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'invite_revoked', 'invite', upper(btrim(p_code)), '{}'::jsonb);
end;
$$;

-- p_required null → yalnızca okur; değer verilirse değiştirir
create or replace function private.admin_invite_required(p_required boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_required is not null then
    update private.beta_settings set invite_required = p_required where id;
    insert into private.audit_log (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'beta_invite_required', 'setting', null, jsonb_build_object('value', p_required));
  end if;
  return private.invite_required();
end;
$$;

grant execute on function private.admin_create_invites(integer, integer, text, integer) to authenticated;
grant execute on function private.admin_list_invites() to authenticated;
grant execute on function private.admin_revoke_invite(text) to authenticated;
grant execute on function private.admin_invite_required(boolean) to authenticated;

create or replace function public.admin_create_invites(p_count integer, p_uses integer default 1, p_note text default null, p_days integer default null)
returns setof text language sql security invoker set search_path = ''
as $$ select * from private.admin_create_invites(p_count, p_uses, p_note, p_days); $$;

create or replace function public.admin_list_invites()
returns table (code text, note text, max_uses integer, used_count integer, status text,
               expires_at timestamptz, created_at timestamptz, used_by text[])
language sql stable security invoker set search_path = ''
as $$ select * from private.admin_list_invites(); $$;

create or replace function public.admin_revoke_invite(p_code text)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_revoke_invite(p_code); $$;

create or replace function public.admin_invite_required(p_required boolean default null)
returns boolean language sql security invoker set search_path = ''
as $$ select private.admin_invite_required(p_required); $$;

revoke execute on function public.admin_create_invites(integer, integer, text, integer) from public, anon;
revoke execute on function public.admin_list_invites() from public, anon;
revoke execute on function public.admin_revoke_invite(text) from public, anon;
revoke execute on function public.admin_invite_required(boolean) from public, anon;
grant execute on function public.admin_create_invites(integer, integer, text, integer) to authenticated;
grant execute on function public.admin_list_invites() to authenticated;
grant execute on function public.admin_revoke_invite(text) to authenticated;
grant execute on function public.admin_invite_required(boolean) to authenticated;
