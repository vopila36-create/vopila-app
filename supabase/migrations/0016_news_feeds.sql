-- ============================================================================
-- VOPILA — Otomatik haberler (Türk haber kaynaklarının herkese açık RSS akışları)
--  * Kaynaklar: TRT Haber, BBC Türkçe, DW Türkçe, CNN Türk, Habertürk, Sözcü (kullanıcı seçimi).
--  * Telif (FSEK): haberin TAMAMI alınmaz; yalnızca başlık, kısa özet (≤280 karakter), görsel
--    bağlantısı ve kaynağa bağlantı saklanır. Uygulamada kaynak adı ve "Habere git" görünür.
--  * Her 15 dakikada istekler gönderilir (pg_net), 5 dk sonra yanıtlar işlenir; 7 günden eski
--    otomatik haberler silinir. Bir kaynak bozuk veri gönderirse yalnızca o kaynak atlanır.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

-- ─── Haber tablosuna kaynak bilgisi ─────────────────────────────────────────

alter table public.news_articles add column if not exists source_key text;
alter table public.news_articles add column if not exists source_name text;
alter table public.news_articles add column if not exists source_url text check (source_url is null or source_url ~ '^https://');
alter table public.news_articles add column if not exists guid text;
alter table public.news_articles add column if not exists auto boolean not null default false;
create unique index if not exists news_articles_guid_idx on public.news_articles (guid) where guid is not null;
create index if not exists news_articles_source_idx on public.news_articles (source_key, published_at desc);

-- ─── Kaynaklar ve bekleyen istekler ─────────────────────────────────────────

create table if not exists private.news_sources (
  key               text primary key,
  name              text not null,
  url               text not null check (url ~ '^https://'),
  default_category  text not null default 'Gündem',
  active            boolean not null default true,
  last_ok_at        timestamptz,
  last_error        text
);

insert into private.news_sources (key, name, url, default_category) values
  ('trt', 'TRT Haber', 'https://www.trthaber.com/sondakika.rss', 'Gündem'),
  ('bbc', 'BBC Türkçe', 'https://feeds.bbci.co.uk/turkce/rss.xml', 'Gündem'),
  ('dw', 'DW Türkçe', 'https://rss.dw.com/xml/rss-tur-all', 'Dünya'),
  ('cnnturk', 'CNN Türk', 'https://www.cnnturk.com/feed/rss/all/news', 'Gündem'),
  ('haberturk', 'Habertürk', 'https://www.haberturk.com/rss', 'Gündem'),
  ('sozcu', 'Sözcü', 'https://www.sozcu.com.tr/feeds-rss-category-sozcu', 'Gündem')
on conflict (key) do update set name = excluded.name, url = excluded.url, default_category = excluded.default_category;

create table if not exists private.news_requests (
  request_id  bigint primary key,
  source_key  text not null references private.news_sources (key) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── Yardımcılar ────────────────────────────────────────────────────────────

-- XML/HTML karakter kodlarını çöz (&amp; &#039; &#x27; ...) ve etiketleri temizle
create or replace function private.clean_text(p text, p_max integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := coalesce(p, '');
  m text[];
begin
  -- CDATA kutusu: içeriği koru, yalnızca işaretleri kaldır (yoksa etiket sanılıp silinir)
  s := replace(replace(s, '<![CDATA[', ''), ']]>', '');
  s := regexp_replace(s, '<!--.*?-->', ' ', 'g');
  s := regexp_replace(s, '<[^>]*>', ' ', 'g');
  -- Sayısal kodlar
  for m in select regexp_matches(s, '&#x([0-9a-fA-F]{1,6});', 'g') loop
    s := replace(s, '&#x' || m[1] || ';', chr(('x' || lpad(m[1], 8, '0'))::bit(32)::int));
  end loop;
  for m in select regexp_matches(s, '&#([0-9]{1,7});', 'g') loop
    s := replace(s, '&#' || m[1] || ';', chr(m[1]::int));
  end loop;
  s := replace(replace(replace(replace(replace(replace(s,
         '&quot;', '"'), '&apos;', ''''), '&lt;', '<'), '&gt;', '>'), '&nbsp;', ' '), '&amp;', '&');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  if char_length(s) > p_max then
    s := btrim(left(s, p_max - 1)) || '…';
  end if;
  return s;
end;
$$;
revoke execute on function private.clean_text(text, integer) from public, anon, authenticated;

-- Kaynağın kategorisini / bağlantı adresini uygulamadaki kategorilere eşle
create or replace function private.news_category(p_raw text, p_link text, p_default text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when s ~ '(spor|futbol|basketbol|super-lig|transfer)' then 'Spor'
    when s ~ '(ekonomi|finans|borsa|piyasa|para|doviz|altin|is-dunyasi)' then 'Finans'
    when s ~ '(teknoloji|bilim-teknoloji|technology|yapay-zeka|dijital)' then 'Teknoloji'
    when s ~ '(bilim|saglik|science|uzay|cevre|iklim)' then 'Bilim'
    when s ~ '(dunya|world|uluslararasi|avrupa|ortadogu|abd|amerika)' then 'Dünya'
    else coalesce(nullif(p_default, ''), 'Gündem')
  end
  from (select lower(translate(coalesce(p_raw, '') || ' ' || coalesce(p_link, ''),
                               'ÇĞİIÖŞÜçğıöşü', 'cgiiosucgiosu')) as s) x;
$$;
revoke execute on function private.news_category(text, text, text) from public, anon, authenticated;

-- RSS tarihini çöz ("Wed, 28 Oct 2026 22:37:00 +0300"); çözülemezse şimdi
create or replace function private.parse_rss_date(p text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare v timestamptz;
begin
  begin
    v := regexp_replace(btrim(coalesce(p, '')), '^[A-Za-z]{3},\s*', '')::timestamptz;
  exception when others then
    v := now();
  end;
  return least(v, now());
end;
$$;
revoke execute on function private.parse_rss_date(text) from public, anon, authenticated;

-- ─── 1) İstekleri gönder ────────────────────────────────────────────────────

create or replace function private.fetch_news()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_id bigint;
  n integer := 0;
begin
  -- Yanıtı hiç gelmeyen eski istekleri temizle
  delete from private.news_requests where created_at < now() - interval '1 hour';
  for s in select key, url from private.news_sources where active loop
    v_id := net.http_get(
      url := s.url,
      headers := jsonb_build_object('User-Agent', 'VOPILA-Haber/1.0 (+https://vopila.app)', 'Accept', 'application/rss+xml, application/xml, text/xml'),
      timeout_milliseconds := 20000
    );
    insert into private.news_requests (request_id, source_key) values (v_id, s.key);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function private.fetch_news() from public, anon, authenticated;

-- ─── 2) Yanıtları işle ──────────────────────────────────────────────────────

create or replace function private.ingest_news()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rq record;
  it xml;
  v_doc xml;
  v_body text;
  ns text[][] := array[array['media', 'http://search.yahoo.com/mrss/']];
  v_title text; v_link text; v_desc text; v_guid text; v_date text; v_cat text; v_img text;
  v_src record;
  added integer := 0;
begin
  for rq in
    select r.request_id, r.source_key, h.status_code, h.content
    from private.news_requests r
    join net._http_response h on h.id = r.request_id
  loop
    select * into v_src from private.news_sources where key = rq.source_key;
    begin
      if rq.status_code <> 200 or rq.content is null then
        raise exception 'http %', rq.status_code;
      end if;
      v_body := btrim(replace(rq.content, chr(65279), ''));
      v_doc := xmlparse(document v_body);

      foreach it in array xpath('/rss/channel/item', v_doc, ns) loop
        v_title := private.clean_text((xpath('string(/item/title)', it, ns))[1]::text, 200);
        v_link := btrim(private.clean_text((xpath('string(/item/link)', it, ns))[1]::text, 600));
        continue when v_title = '' or v_link !~ '^https://';
        v_guid := coalesce(nullif(private.clean_text((xpath('string(/item/guid)', it, ns))[1]::text, 600), ''), v_link);
        v_desc := private.clean_text((xpath('string(/item/description)', it, ns))[1]::text, 280);
        v_date := (xpath('string(/item/pubDate)', it, ns))[1]::text;
        v_cat := private.clean_text((xpath('string(/item/category)', it, ns))[1]::text, 80);
        v_img := coalesce(
          nullif(btrim((xpath('string(/item/imageUrl)', it, ns))[1]::text), ''),
          nullif(btrim((xpath('string(/item/image)', it, ns))[1]::text), ''),
          (xpath('/item/media:content/@url', it, ns))[1]::text,
          (xpath('/item/enclosure/@url', it, ns))[1]::text,
          (xpath('/item/media:thumbnail/@url', it, ns))[1]::text
        );
        v_img := private.clean_text(v_img, 600);
        if v_img !~ '^https://' then v_img := null; end if;
        -- BBC küçük resmi büyüt
        if rq.source_key = 'bbc' and v_img is not null then
          v_img := replace(v_img, '/ws/240/', '/ws/800/');
        end if;

        insert into public.news_articles
          (id, category, title, summary, body, ai_summary, image_url, read_time, is_live, is_special,
           published_at, source_key, source_name, source_url, guid, auto)
        values
          ('rss_' || md5(rq.source_key || ':' || v_guid),
           private.news_category(v_cat, v_link, v_src.default_category),
           v_title, v_desc, '{}', '{}', v_img, '1 dk', false, false,
           private.parse_rss_date(v_date), rq.source_key, v_src.name, v_link, rq.source_key || ':' || v_guid, true)
        on conflict do nothing;
        if found then added := added + 1; end if;
      end loop;

      update private.news_sources set last_ok_at = now(), last_error = null where key = rq.source_key;
    exception when others then
      update private.news_sources set last_error = left(sqlerrm, 300) where key = rq.source_key;
    end;
    delete from private.news_requests where request_id = rq.request_id;
  end loop;

  -- 7 günden eski otomatik haberler silinir (elle eklenenler kalır)
  delete from public.news_articles where auto and published_at < now() - interval '7 days';
  return added;
end;
$$;
revoke execute on function private.ingest_news() from public, anon, authenticated;

-- ─── Zamanlama ──────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vopila-news-fetch') then perform cron.unschedule('vopila-news-fetch'); end if;
  if exists (select 1 from cron.job where jobname = 'vopila-news-ingest') then perform cron.unschedule('vopila-news-ingest'); end if;
  perform cron.schedule('vopila-news-fetch', '*/15 * * * *', 'select private.fetch_news();');
  perform cron.schedule('vopila-news-ingest', '3-59/15 * * * *', 'select private.ingest_news();');
end $$;
