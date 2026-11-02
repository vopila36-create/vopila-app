-- ============================================================================
-- VOPILA — Instagram tarzı eksikler:
--  1) Gönderi: sonradan düzenleme (düzenlendi işareti), yorumları kapatma, profilde sabitleme (en fazla 3)
--  2) Yorum beğenme (+ yorum sahibine bildirim)
--  3) Anı görenler (yalnız anın sahibi görür)
--  4) Gönderide kişi etiketleme (bahsetme izni geçerli, engelli kişi etiketlenemez, en fazla 20)
-- ============================================================================

-- ─── 1) Gönderi yönetimi ────────────────────────────────────────────────────
alter table public.posts add column if not exists comments_off boolean not null default false;
alter table public.posts add column if not exists pinned_at timestamptz;
alter table public.posts add column if not exists edited_at timestamptz;
grant update (comments_off, pinned_at) on table public.posts to authenticated;
create index if not exists posts_pinned_idx on public.posts (author_id, pinned_at) where pinned_at is not null;

create or replace function private.post_update_meta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_tags text;
  v_new_tags text;
begin
  -- edited_at yalnız sunucu yazar
  new.edited_at := old.edited_at;
  if new.caption is distinct from old.caption or new.location is distinct from old.location then
    new.edited_at := now();
  end if;
  -- Sabitleme: zamanı sunucu koyar, en fazla 3 gönderi
  if new.pinned_at is not null and old.pinned_at is null then
    new.pinned_at := now();
    if (select count(*) from public.posts p
         where p.author_id = new.author_id and p.pinned_at is not null and p.id <> new.id) >= 3 then
      raise exception 'pin_limit' using errcode = 'P0001';
    end if;
  elsif new.pinned_at is not null then
    new.pinned_at := old.pinned_at;
  end if;
  -- Arşivlenen gönderi sabit kalmaz
  if new.archived_at is not null then
    new.pinned_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.post_update_meta() from public, anon, authenticated;
drop trigger if exists post_update_meta on public.posts;
create trigger post_update_meta before update on public.posts
  for each row execute function private.post_update_meta();

-- Düzenlemede yeni eklenen @bahsetmelere bildirim
create or replace function private.on_post_caption_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_new text;
begin
  select string_agg('@' || u, ' ') into v_new
  from (
    select distinct lower(m[1]) u from regexp_matches(coalesce(new.caption, ''), '@([A-Za-z0-9_]{3,20})', 'g') m
    except
    select distinct lower(m[1]) from regexp_matches(coalesce(old.caption, ''), '@([A-Za-z0-9_]{3,20})', 'g') m
  ) x;
  if v_new is not null then
    perform private.notify_mentions(v_new, new.author_id, new.id, 'bir gönderide');
  end if;
  return null;
end;
$$;
revoke execute on function private.on_post_caption_edit() from public, anon, authenticated;
drop trigger if exists posts_caption_edit on public.posts;
create trigger posts_caption_edit after update of caption on public.posts
  for each row when (new.caption is distinct from old.caption)
  execute function private.on_post_caption_edit();

-- Yorumları kapalı gönderiye yalnız sahibi yorum yazabilir
create or replace function private.can_comment(p_post uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select private.policy_allows(s.comment_policy, po.author_id, (select auth.uid()))
         and (not po.comments_off or po.author_id = (select auth.uid()))
  from public.posts po
  left join public.user_settings s on s.user_id = po.author_id
  where po.id = p_post;
$$;

-- ─── 2) Yorum beğenme ───────────────────────────────────────────────────────
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;
revoke all on table public.comment_likes from anon, authenticated;
grant select, insert, delete on table public.comment_likes to authenticated;

drop policy if exists "aal2 gerekli" on public.comment_likes;
create policy "aal2 gerekli" on public.comment_likes as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());

drop policy if exists "comment_likes: görünür yorumun beğenileri" on public.comment_likes;
create policy "comment_likes: görünür yorumun beğenileri" on public.comment_likes for select to authenticated
  using (
    exists (select 1 from public.comments c where c.id = comment_id)
    and (user_id = (select auth.uid()) or private.can_view_user(user_id))
  );

drop policy if exists "comment_likes: görebildiği yorumu beğenir" on public.comment_likes;
create policy "comment_likes: görebildiği yorumu beğenir" on public.comment_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id)
  );

drop policy if exists "comment_likes: kendi beğenisini kaldırır" on public.comment_likes;
create policy "comment_likes: kendi beğenisini kaldırır" on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_author uuid; v_post uuid;
begin
  select c.author_id, c.post_id into v_author, v_post from public.comments c where c.id = new.comment_id;
  if v_author is null or v_author = new.user_id or private.blocked_pair(v_author, new.user_id) then
    return null;
  end if;
  -- Aynı kişi aynı yoruma tekrar beğeni atarsa bildirim çoğalmasın
  if exists (select 1 from public.notifications n
              where n.user_id = v_author and n.actor_id = new.user_id and n.kind = 'like'
                and n.href = '/gonderi/' || v_post::text and n.text like '%yorumunu beğendi.'
                and n.created_at > now() - interval '1 day') then
    return null;
  end if;
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select v_author, 'like', new.user_id, a.name || ' yorumunu beğendi.', '/gonderi/' || v_post::text
  from public.profiles a where a.id = new.user_id;
  return null;
end;
$$;
revoke execute on function private.notify_comment_like() from public, anon, authenticated;
drop trigger if exists comment_likes_notify on public.comment_likes;
create trigger comment_likes_notify after insert on public.comment_likes
  for each row execute function private.notify_comment_like();

-- ─── 3) Anı görenler ────────────────────────────────────────────────────────
create table if not exists public.moment_views (
  moment_id uuid not null references public.moments (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (moment_id, viewer_id)
);
create index if not exists moment_views_viewer_idx on public.moment_views (viewer_id);

alter table public.moment_views enable row level security;
revoke all on table public.moment_views from anon, authenticated;
grant select, insert on table public.moment_views to authenticated;

drop policy if exists "aal2 gerekli" on public.moment_views;
create policy "aal2 gerekli" on public.moment_views as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());

drop policy if exists "moment_views: kendi ve anın sahibi görür" on public.moment_views;
create policy "moment_views: kendi ve anın sahibi görür" on public.moment_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (select 1 from public.moments m where m.id = moment_id and m.author_id = (select auth.uid()))
  );

drop policy if exists "moment_views: görebildiği anı görüntüler" on public.moment_views;
create policy "moment_views: görebildiği anı görüntüler" on public.moment_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (select 1 from public.moments m where m.id = moment_id and m.author_id <> (select auth.uid()))
  );

-- ─── 4) Gönderide kişi etiketleme ───────────────────────────────────────────
create table if not exists public.post_tags (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_tags_user_idx on public.post_tags (user_id, created_at desc);

alter table public.post_tags enable row level security;
revoke all on table public.post_tags from anon, authenticated;
grant select, insert, delete on table public.post_tags to authenticated;

drop policy if exists "aal2 gerekli" on public.post_tags;
create policy "aal2 gerekli" on public.post_tags as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());

drop policy if exists "post_tags: görünür gönderi ve kişi" on public.post_tags;
create policy "post_tags: görünür gönderi ve kişi" on public.post_tags for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and (user_id = (select auth.uid()) or private.can_view_user(user_id))
  );

drop policy if exists "post_tags: gönderi sahibi etiketler" on public.post_tags;
create policy "post_tags: gönderi sahibi etiketler" on public.post_tags for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and user_id <> (select auth.uid())
    and not private.blocked_pair(user_id, (select auth.uid()))
    and coalesce(private.policy_allows(
          (select s.mention_policy from public.user_settings s where s.user_id = post_tags.user_id),
          user_id, (select auth.uid())), true)
  );

drop policy if exists "post_tags: sahibi ya da etiketlenen kaldırır" on public.post_tags;
create policy "post_tags: sahibi ya da etiketlenen kaldırır" on public.post_tags for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );

create or replace function private.on_post_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_author uuid;
begin
  if (select count(*) from public.post_tags t where t.post_id = new.post_id) >= 20 then
    raise exception 'tag_limit' using errcode = 'P0001';
  end if;
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select new.user_id, 'mention', v_author, a.name || ' seni bir gönderide etiketledi.', '/gonderi/' || new.post_id::text
  from public.profiles a where a.id = v_author
    and private.can_view_user_as(new.user_id, v_author);
  return new;
end;
$$;
revoke execute on function private.on_post_tag() from public, anon, authenticated;
drop trigger if exists post_tags_before on public.post_tags;
create trigger post_tags_before before insert on public.post_tags
  for each row execute function private.on_post_tag();
