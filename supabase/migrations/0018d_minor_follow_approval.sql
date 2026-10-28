-- ============================================================================
-- VOPILA — 18 yaş altına gelen her takip gencin onayını bekler (hesap herkese açık olsa bile).
-- Aksi halde bir yorumdaki kimlikle takip edip (otomatik kabul) gizli profili görmek mümkündü.
-- ============================================================================

create or replace function private.follows_set_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce((select p.is_private from public.profiles p where p.id = new.following_id), false)
     or private.is_minor(new.following_id) then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;
  return new;
end;
$$;

create or replace function private.accept_pending_on_public()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_private and not new.is_private and not private.is_minor(new.id) then
    update public.follows set status = 'accepted'
    where following_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
