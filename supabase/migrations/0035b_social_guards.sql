-- ============================================================================
-- VOPILA — 0035 düzeltmesi (güvenlik incelemesi):
--  * Yeni tablolara askı + hız sınırı koruması (guard_user_write) ve sunucu zamanı (istemci tarih yazamaz).
--  * Etiket: gizlenmiş gönderiden bildirim gitmez; askıdaki hesap etiketleyemez; saatte en fazla 60 etiket;
--    kendini etiketten kaldıran kişi aynı gönderide yeniden etiketlenemez.
-- ============================================================================

insert into private.rate_limits (table_name, max_count, per_seconds) values
  ('comment_likes', 60, 60),
  ('moment_likes', 60, 60),
  ('moment_views', 300, 60)
on conflict (table_name) do update set max_count = excluded.max_count, per_seconds = excluded.per_seconds;

drop trigger if exists guard_user_write on public.comment_likes;
create trigger guard_user_write before insert on public.comment_likes
  for each row execute function private.guard_user_write('user_id', 'created_at');
drop trigger if exists force_insert_timestamps on public.comment_likes;
create trigger force_insert_timestamps before insert on public.comment_likes
  for each row execute function private.force_insert_timestamps();

drop trigger if exists guard_user_write on public.moment_likes;
create trigger guard_user_write before insert on public.moment_likes
  for each row execute function private.guard_user_write('user_id', 'created_at');
drop trigger if exists force_insert_timestamps on public.moment_likes;
create trigger force_insert_timestamps before insert on public.moment_likes
  for each row execute function private.force_insert_timestamps();

-- moment_views: zaman sütunu viewed_at
create or replace function private.force_viewed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.viewed_at := now();
  return new;
end;
$$;
revoke execute on function private.force_viewed_at() from public, anon, authenticated;
drop trigger if exists force_viewed_at on public.moment_views;
create trigger force_viewed_at before insert on public.moment_views
  for each row execute function private.force_viewed_at();
drop trigger if exists guard_user_write on public.moment_views;
create trigger guard_user_write before insert on public.moment_views
  for each row execute function private.guard_user_write('viewer_id', 'viewed_at');

drop trigger if exists force_insert_timestamps on public.post_tags;
create trigger force_insert_timestamps before insert on public.post_tags
  for each row execute function private.force_insert_timestamps();

-- Kendini etiketten kaldıranlar (yeniden etiketlenemez)
create table if not exists private.post_tag_removals (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create or replace function private.on_post_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_author uuid; v_hidden boolean; v_uid uuid := (select auth.uid());
begin
  if (select auth.role()) = 'authenticated' then
    if not private.is_active_user(v_uid) then
      raise exception 'account_suspended' using errcode = 'P0001';
    end if;
    perform pg_advisory_xact_lock(hashtext('post_tags'), hashtext(v_uid::text));
    if (select count(*) from public.post_tags t join public.posts p on p.id = t.post_id
         where p.author_id = v_uid and t.created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from private.post_tag_removals r where r.post_id = new.post_id and r.user_id = new.user_id) then
    raise exception 'tag_removed' using errcode = 'P0001';
  end if;
  if (select count(*) from public.post_tags t where t.post_id = new.post_id) >= 20 then
    raise exception 'tag_limit' using errcode = 'P0001';
  end if;
  select p.author_id, p.is_hidden into v_author, v_hidden from public.posts p where p.id = new.post_id;
  if not coalesce(v_hidden, false) then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select new.user_id, 'mention', v_author, a.name || ' seni bir gönderide etiketledi.', '/gonderi/' || new.post_id::text
    from public.profiles a where a.id = v_author
      and private.can_view_user_as(new.user_id, v_author);
  end if;
  return new;
end;
$$;
revoke execute on function private.on_post_tag() from public, anon, authenticated;

create or replace function private.on_post_untag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id = (select auth.uid()) then
    insert into private.post_tag_removals (post_id, user_id) values (old.post_id, old.user_id)
    on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke execute on function private.on_post_untag() from public, anon, authenticated;
drop trigger if exists post_tags_untag on public.post_tags;
create trigger post_tags_untag after delete on public.post_tags
  for each row execute function private.on_post_untag();

-- Etiket izni: policy_allows doğrudan çağrılamadığı için izinli bir sarmalayıcı
create or replace function private.can_tag(p_user uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select p_user <> (select auth.uid())
     and not private.blocked_pair(p_user, (select auth.uid()))
     and coalesce(private.policy_allows(
           (select s.mention_policy from public.user_settings s where s.user_id = p_user),
           p_user, (select auth.uid())), true);
$$;
revoke execute on function private.can_tag(uuid) from public, anon;
grant execute on function private.can_tag(uuid) to authenticated;

drop policy if exists "post_tags: gönderi sahibi etiketler" on public.post_tags;
create policy "post_tags: gönderi sahibi etiketler" on public.post_tags for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and private.can_tag(user_id)
  );
