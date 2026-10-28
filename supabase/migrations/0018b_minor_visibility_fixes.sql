-- ============================================================================
-- VOPILA — 0018 güvenlik düzeltmeleri (otomatik güvenlik incelemesi)
--  1) Bekleyen takip isteği 18 altı profili görünür yapıyordu → genç kendisi takip ettiyse (istek dahil)
--     ya da karşı tarafın takibini KABUL ettiyse görünür. Aynı kural kişi aramasında.
--  2) Yanlış ebeveyn kodunda hata fırlatılınca deneme kaydı geri alınıyordu → artık null döner.
--     Kod 8 → 12 karakter (60 bit).
-- (parent_link'in son hali 0018c'de)
-- ============================================================================

create or replace function private.minor_related(p_minor uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.follows f
                 where (f.follower_id = p_minor and f.following_id = p_viewer)
                    or (f.follower_id = p_viewer and f.following_id = p_minor and f.status = 'accepted'));
$$;
revoke execute on function private.minor_related(uuid, uuid) from public, anon, authenticated;

create or replace function private.profile_visible(p_target uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group text := private.age_group_of(p_target);
begin
  if v_group in ('unknown', 'adult') then
    return true;
  end if;
  if v_uid is not null and v_uid = p_target then
    return true;
  end if;
  if private.is_admin() then
    return true;
  end if;
  if v_group = 'under15' or v_uid is null then
    return false;
  end if;
  return private.minor_related(p_target, v_uid)
      or exists (select 1 from public.conversation_members a
                 join public.conversation_members b on b.conversation_id = a.conversation_id
                 where a.user_id = v_uid and b.user_id = p_target)
      or exists (select 1 from public.parent_links l where l.child_id = p_target and l.parent_id = v_uid);
end;
$$;

create or replace function private.search_people(p_query text)
returns table (id uuid, username text, name text, avatar_url text, verified boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  q text := regexp_replace(btrim(coalesce(p_query, '')), '[%_\\]', '', 'g');
begin
  if char_length(q) < 2 then
    return;
  end if;
  return query
    select p.id, p.username, p.name, p.avatar_url, p.verified
    from public.profiles p
    where p.id is distinct from v_uid
      and p.status <> 'banned'
      and not private.blocked_pair(p.id, v_uid)
      and (p.username ilike '%' || q || '%' or p.name ilike '%' || q || '%')
      and private.age_group_of(p.id) <> 'under15'
      and (not private.is_minor(p.id) or private.minor_related(p.id, v_uid))
    order by (p.username = lower(q)) desc, p.verified desc, p.username
    limit 20;
end;
$$;

create or replace function private.parent_create_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := extensions.gen_random_bytes(12);
  i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if private.age_group_of(v_uid) <> 'teen' then
    raise exception 'parent_only_for_teens' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.parent_links l where l.child_id = v_uid) then
    raise exception 'parent_already_linked' using errcode = 'P0001';
  end if;
  for i in 0..11 loop
    v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into private.parent_codes (child_id, code_hash, expires_at)
  values (v_uid, encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes')
  on conflict (child_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return v_code;
end;
$$;
