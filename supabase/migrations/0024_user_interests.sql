-- ============================================================================
-- VOPILA — İlgi alanları sunucuda (kişisel sıralama her cihazda aynı)
--  * Konu: 'news:<Kategori>' ya da 'arena:<anahtar>'. Puan izleme süresinden gelir, günde %3 söner.
--  * Yalnızca sahibi okur; yazma yalnızca bump_interests ile (tek çağrıda en çok 30 konu, konu başına
--    en çok 60 puan). Kullanıcı Ayarlar > İlgi alanların'dan görür ve sıfırlar (KVKK şeffaflık).
--  * Reklam için kullanılmaz; 18 altı için profil çıkarımına dayalı reklam zaten yok.
-- ============================================================================

create table if not exists public.user_interests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  topic       text not null check (topic ~ '^(news|arena):[[:alnum:]_ ]{1,30}$'),
  score       real not null default 0 check (score >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, topic)
);
alter table public.user_interests enable row level security;

drop policy if exists "aal2 gerekli" on public.user_interests;
create policy "aal2 gerekli" on public.user_interests as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "user_interests: sahibi okur" on public.user_interests;
create policy "user_interests: sahibi okur" on public.user_interests for select to authenticated
  using (user_id = (select auth.uid()));

-- Zamanla sönen puan (günde %3)
create or replace function private.decayed(p_score real, p_at timestamptz)
returns real
language sql stable set search_path = ''
as $$
  select (p_score * power(0.97, greatest(extract(epoch from (now() - p_at)) / 86400, 0)))::real;
$$;

create or replace function private.bump_interests(p_deltas jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  k text;
  v numeric;
  n integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_deltas) <> 'object' then
    return;
  end if;
  for k, v in select key, (value #>> '{}')::numeric from jsonb_each(p_deltas) loop
    n := n + 1;
    exit when n > 30;
    continue when k !~ '^(news|arena):[[:alnum:]_ ]{1,30}$' or v is null or v <= 0;
    insert into public.user_interests (user_id, topic, score, updated_at)
    values (v_uid, k, least(v, 60), now())
    on conflict (user_id, topic) do update
      set score = least(private.decayed(public.user_interests.score, public.user_interests.updated_at) + least(v, 60), 100000),
          updated_at = now();
  end loop;
  -- Çok sönmüş konuları temizle
  delete from public.user_interests
   where user_id = v_uid and private.decayed(score, updated_at) < 0.05;
end;
$$;

create or replace function private.my_interests()
returns table (topic text, score real)
language sql stable security definer set search_path = ''
as $$
  select i.topic, private.decayed(i.score, i.updated_at)
  from public.user_interests i
  where i.user_id = (select auth.uid())
  order by 2 desc;
$$;

create or replace function private.reset_interests()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.user_interests where user_id = (select auth.uid());
$$;

grant execute on function private.bump_interests(jsonb), private.my_interests(), private.reset_interests() to authenticated;
revoke execute on function private.bump_interests(jsonb), private.my_interests(), private.reset_interests() from public, anon;
revoke execute on function private.decayed(real, timestamptz) from public, anon;
grant execute on function private.decayed(real, timestamptz) to authenticated;

create or replace function public.bump_interests(p_deltas jsonb) returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.bump_interests(p_deltas); end; $$;
create or replace function public.my_interests() returns table (topic text, score real) language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.my_interests(); end; $$;
create or replace function public.reset_interests() returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.reset_interests(); end; $$;

revoke execute on function public.bump_interests(jsonb), public.my_interests(), public.reset_interests() from public, anon;
grant execute on function public.bump_interests(jsonb), public.my_interests(), public.reset_interests() to authenticated;
