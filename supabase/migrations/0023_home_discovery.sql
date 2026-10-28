-- ============================================================================
-- VOPILA — Ana Sahne keşif verileri
--  * trending_posts: son 14 günün gönderileri; beğeni + 2×yorum (son 7 gün), yaşla azalan puan.
--    Yalnızca kimlikler döner; içerik uygulamada normal güvenlik kurallarıyla (RLS) çekilir.
--  * trending_tags: son 14 günün en çok kullanılan #etiketleri (farklı yazar sayısına göre).
--  * suggest_people: takip önerisi — 18 yaş altı, 15 altı, yasaklı/askıdaki, engellenen ve zaten
--    takip edilen hesaplar önerilmez (Yaş Doğrulama Yönetmeliği md. 8: çocuklar önerilmez).
-- ============================================================================

create or replace function private.trending_posts(p_limit integer default 12)
returns table (post_id uuid, score double precision)
language sql stable security definer set search_path = ''
as $$
  with recent as (
    select p.id, p.author_id, p.created_at
    from public.posts p
    where p.created_at > now() - interval '14 days'
      and not p.is_hidden and p.archived_at is null
      and private.can_view_user(p.author_id)
      and ((select private.viewer_is_adult()) or (not p.sensitive and private.minor_safe_post(p.id)))
  ),
  scored as (
    select r.id,
      ((select count(*) from public.likes l where l.post_id = r.id and l.created_at > now() - interval '7 days')
       + 2 * (select count(*) from public.comments c where c.post_id = r.id and not c.is_hidden
              and c.created_at > now() - interval '7 days') + 1)::double precision
      / power(extract(epoch from (now() - r.created_at)) / 3600 + 2, 1.2) as score
    from recent r
    where r.author_id is distinct from (select auth.uid())
  )
  select id, score from scored order by score desc limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

create or replace function private.trending_tags(p_limit integer default 10)
returns table (tag text, posts integer)
language sql stable security definer set search_path = ''
as $$
  select lower(m[1]) as tag, count(distinct p.author_id)::integer as posts
  from public.posts p,
       regexp_matches(p.caption, '#([[:alnum:]_]{2,40})', 'g') as m
  where p.created_at > now() - interval '14 days'
    and not p.is_hidden and p.archived_at is null
    and private.can_view_user(p.author_id)
    and ((select private.viewer_is_adult()) or (not p.sensitive and private.minor_safe_post(p.id)))
  group by lower(m[1])
  order by posts desc, tag
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

create or replace function private.suggest_people(p_limit integer default 10)
returns table (id uuid, username text, name text, avatar_url text, verified boolean, followers integer)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.name, p.avatar_url, p.verified,
         (select count(*)::integer from public.follows f where f.following_id = p.id and f.status = 'accepted') as followers
  from public.profiles p
  where p.id is distinct from (select auth.uid())
    and p.status = 'active'
    and private.age_group_of(p.id) in ('adult', 'unknown')
    and not private.blocked_pair(p.id, (select auth.uid()))
    and not exists (select 1 from public.follows f
                    where f.follower_id = (select auth.uid()) and f.following_id = p.id)
  order by followers desc, (select count(*) from public.posts x where x.author_id = p.id) desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

grant execute on function private.trending_posts(integer), private.trending_tags(integer),
  private.suggest_people(integer) to authenticated;
revoke execute on function private.trending_posts(integer), private.trending_tags(integer),
  private.suggest_people(integer) from public, anon;

create or replace function public.trending_posts(p_limit integer default 12)
returns table (post_id uuid, score double precision)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.trending_posts(p_limit); end; $$;

create or replace function public.trending_tags(p_limit integer default 10)
returns table (tag text, posts integer)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.trending_tags(p_limit); end; $$;

create or replace function public.suggest_people(p_limit integer default 10)
returns table (id uuid, username text, name text, avatar_url text, verified boolean, followers integer)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.suggest_people(p_limit); end; $$;

revoke execute on function public.trending_posts(integer), public.trending_tags(integer),
  public.suggest_people(integer) from public, anon;
grant execute on function public.trending_posts(integer), public.trending_tags(integer),
  public.suggest_people(integer) to authenticated;
