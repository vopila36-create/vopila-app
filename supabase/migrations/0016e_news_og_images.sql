-- ============================================================================
-- VOPILA — Görseli olmayan otomatik haberler için paylaşım görseli (og:image)
-- DW Türkçe RSS'i görsel göndermiyor. Haberin kendi sayfasındaki sosyal medya paylaşım
-- görselinin yalnızca ADRESİ alınır (sayfa içeriği saklanmaz). Her haber için en fazla 2 deneme.
-- ============================================================================

create table if not exists private.news_image_requests (
  request_id  bigint primary key,
  article_id  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists private.news_image_tries (
  article_id  text primary key,
  tries       integer not null default 0
);

-- Görselsiz haberlerin sayfasını iste (DW için kısa adres: https://www.dw.com/tr/a-<numara>)
create or replace function private.fetch_news_images()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  v_url text;
  v_id bigint;
  n integer := 0;
begin
  delete from private.news_image_requests where created_at < now() - interval '1 hour';
  for a in
    select na.id, na.source_key, na.source_url
    from public.news_articles na
    left join private.news_image_tries t on t.article_id = na.id
    -- Güvenlik (SSRF): yalnızca DW, adresi bizim kurduğumuz sabit kalıpla istenir
    where na.auto and na.image_url is null and na.source_key = 'dw' and na.source_url ~ '/a-[0-9]{4,12}([/?#]|$)'
      and coalesce(t.tries, 0) < 2
      and not exists (select 1 from private.news_image_requests r where r.article_id = na.id)
    order by na.published_at desc
    limit 20
  loop
    -- Haberin numarasından sabit DW adresi kurulur; dış kaynaktan gelen adres hiç istenmez
    v_url := 'https://www.dw.com/tr/' || substring(a.source_url from '/(a-[0-9]{4,12})');
    continue when v_url !~ '^https://www\.dw\.com/tr/a-[0-9]{4,12}$';
    v_id := net.http_get(
      url := v_url,
      headers := jsonb_build_object('User-Agent', 'VOPILA-Haber/1.0 (+https://vopila.app)'),
      timeout_milliseconds := 20000
    );
    insert into private.news_image_requests (request_id, article_id) values (v_id, a.id);
    insert into private.news_image_tries (article_id, tries) values (a.id, 1)
    on conflict (article_id) do update set tries = private.news_image_tries.tries + 1;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function private.fetch_news_images() from public, anon, authenticated;

-- Gelen sayfalardan og:image adresini çıkar ve habere yaz
create or replace function private.ingest_news_images()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rq record;
  v_img text;
  n integer := 0;
begin
  for rq in
    select r.request_id, r.article_id, h.status_code, h.content
    from private.news_image_requests r
    join net._http_response h on h.id = r.request_id
  loop
    v_img := null;
    if rq.status_code = 200 and rq.content is not null then
      v_img := coalesce(
        substring(rq.content from '<meta[^>]*content="(https://[^"]+)"[^>]*property="og:image"'),
        substring(rq.content from '<meta[^>]*property="og:image"[^>]*content="(https://[^"]+)"')
      );
    end if;
    if v_img is not null and char_length(v_img) <= 600 and v_img !~ '[<>\s]' then
      update public.news_articles set image_url = v_img where id = rq.article_id and image_url is null;
      n := n + 1;
    end if;
    delete from private.news_image_requests where request_id = rq.request_id;
  end loop;
  -- Silinen haberlerin deneme kayıtlarını temizle
  delete from private.news_image_tries t where not exists (select 1 from public.news_articles a where a.id = t.article_id);
  return n;
end;
$$;
revoke execute on function private.ingest_news_images() from public, anon, authenticated;

-- Haber işlenmesinden sonra görsel istekleri; 5 dk sonra işlenir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vopila-news-images-fetch') then perform cron.unschedule('vopila-news-images-fetch'); end if;
  if exists (select 1 from cron.job where jobname = 'vopila-news-images-ingest') then perform cron.unschedule('vopila-news-images-ingest'); end if;
  perform cron.schedule('vopila-news-images-fetch', '5-59/15 * * * *', 'select private.fetch_news_images();');
  perform cron.schedule('vopila-news-images-ingest', '9-59/15 * * * *', 'select private.ingest_news_images();');
end $$;
