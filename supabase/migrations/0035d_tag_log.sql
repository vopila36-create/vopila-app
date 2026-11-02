-- ============================================================================
-- VOPILA — 0035 düzeltmesi: etiket sınırı silinmeyen bir kayıttan sayılır (etiketle-kaldır-etiketle ile
-- sınır aşılamaz) ve aynı kişiye aynı gönderi için 24 saatte en fazla bir etiket bildirimi gider.
-- ============================================================================
create table if not exists private.post_tag_log (
  id        bigint generated always as identity primary key,
  tagger_id uuid not null,
  post_id   uuid not null,
  user_id   uuid not null,
  at        timestamptz not null default now()
);
create index if not exists post_tag_log_tagger_idx on private.post_tag_log (tagger_id, at desc);
create index if not exists post_tag_log_pair_idx on private.post_tag_log (post_id, user_id, at desc);

create or replace function private.on_post_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_author uuid; v_hidden boolean; v_uid uuid := (select auth.uid()); v_recent boolean;
begin
  select p.author_id, p.is_hidden into v_author, v_hidden from public.posts p where p.id = new.post_id;
  if (select auth.role()) = 'authenticated' then
    if not private.is_active_user(v_uid) then
      raise exception 'account_suspended' using errcode = 'P0001';
    end if;
    perform pg_advisory_xact_lock(hashtext('post_tags'), hashtext(v_uid::text));
    if (select count(*) from private.post_tag_log l
         where l.tagger_id = v_uid and l.at > now() - interval '1 hour') >= 60 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from private.post_tag_removals r where r.post_id = new.post_id and r.user_id = new.user_id) then
    raise exception 'tag_removed' using errcode = 'P0001';
  end if;
  if (select count(*) from public.post_tags t where t.post_id = new.post_id) >= 20 then
    raise exception 'tag_limit' using errcode = 'P0001';
  end if;
  v_recent := exists (select 1 from private.post_tag_log l
                       where l.post_id = new.post_id and l.user_id = new.user_id and l.at > now() - interval '24 hours');
  insert into private.post_tag_log (tagger_id, post_id, user_id) values (coalesce(v_uid, v_author), new.post_id, new.user_id);
  if not coalesce(v_hidden, false) and not v_recent then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select new.user_id, 'mention', v_author, a.name || ' seni bir gönderide etiketledi.', '/gonderi/' || new.post_id::text
    from public.profiles a where a.id = v_author
      and private.can_view_user_as(new.user_id, v_author);
  end if;
  return new;
end;
$$;
revoke execute on function private.on_post_tag() from public, anon, authenticated;
