-- ============================================================================
-- VOPILA — 0035 düzeltmesi: açıklama düzenlenerek bahsetme bildirimi yağdırılamaz.
-- Aynı gönderide aynı kişiye 24 saatte tek bildirim; yazar başına saatte en fazla 30 düzenleme bildirimi.
-- (Gizlenmiş gönderide notify_mentions zaten bildirim göndermez.)
-- ============================================================================
create table if not exists private.mention_edit_log (
  id        bigint generated always as identity primary key,
  author_id uuid not null,
  post_id   uuid not null,
  username  text not null,
  at        timestamptz not null default now()
);
create index if not exists mention_edit_log_pair_idx on private.mention_edit_log (post_id, username, at desc);
create index if not exists mention_edit_log_author_idx on private.mention_edit_log (author_id, at desc);

create or replace function private.on_post_caption_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_new text; v_budget integer;
begin
  if coalesce(new.is_hidden, false) then
    return null;
  end if;
  v_budget := greatest(0, 30 - (select count(*) from private.mention_edit_log l
                                  where l.author_id = new.author_id and l.at > now() - interval '1 hour'))::int;
  if v_budget = 0 then
    return null;
  end if;
  with fresh as (
    select u from (
      select distinct lower(m[1]) u from regexp_matches(coalesce(new.caption, ''), '@([A-Za-z0-9_]{3,20})', 'g') m
      except
      select distinct lower(m[1]) from regexp_matches(coalesce(old.caption, ''), '@([A-Za-z0-9_]{3,20})', 'g') m
    ) x
    where not exists (select 1 from private.mention_edit_log l
                       where l.post_id = new.id and l.username = x.u and l.at > now() - interval '24 hours')
    limit v_budget
  ), logged as (
    insert into private.mention_edit_log (author_id, post_id, username)
    select new.author_id, new.id, u from fresh
    returning username
  )
  select string_agg('@' || username, ' ') into v_new from logged;
  if v_new is not null then
    perform private.notify_mentions(v_new, new.author_id, new.id, 'bir gönderide');
  end if;
  return null;
end;
$$;
revoke execute on function private.on_post_caption_edit() from public, anon, authenticated;
