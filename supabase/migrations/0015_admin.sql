-- ============================================================================
-- VOPILA — Yönetici paneli (Aşama 6)
--  * Yönetici yetkisi yalnızca iki adımlı doğrulamalı (aal2) oturumda geçerlidir.
--  * Ürün, haber, arena düzenleme; destek yanıtı; özet sayılar; denetim kaydı okuma.
--  * Ürün görselleri için herkese açık "catalog" kovası (yalnızca yönetici yükler).
--  Tüm işlemler denetim kaydına (private.audit_log) yazılır.
-- ============================================================================

-- ─── Yönetici = yönetici hesabı + iki adımlı doğrulanmış oturum ─────────────

create or replace function private.is_admin_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;
revoke execute on function private.is_admin_account() from public;
grant execute on function private.is_admin_account() to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin_account() and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- Uygulama paneli göstermek için: 'none' (yönetici değil) · 'needs_2fa' · 'ok'
create or replace function public.admin_status()
returns text language sql stable security invoker set search_path = ''
as $$
  select case when not private.is_admin_account() then 'none'
              when private.is_admin() then 'ok'
              else 'needs_2fa' end;
$$;
revoke execute on function public.admin_status() from public, anon;
grant execute on function public.admin_status() to authenticated;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501', hint = 'Yönetici ve iki adımlı doğrulama gerekli.';
  end if;
end;
$$;
revoke execute on function private.require_admin() from public;
grant execute on function private.require_admin() to authenticated;

create or replace function private.audit(p_action text, p_type text, p_id text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_type, p_id, coalesce(p_details, '{}'));
$$;
revoke execute on function private.audit(text, text, text, jsonb) from public, anon, authenticated;

-- ─── Özet ve denetim kaydı ──────────────────────────────────────────────────

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_today', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
    'posts_today', (select count(*) from public.posts where created_at > now() - interval '1 day'),
    'open_reports', (select count(distinct (target_type, target_id)) from public.reports where status = 'open'),
    'pending_rewards', (select count(*) from public.pending_rewards where status = 'pending'),
    'orders_preparing', (select count(*) from public.orders where status = 'preparing'),
    'orders_problem', (select count(*) from public.orders where status = 'problem'),
    'open_tickets', (select count(*) from public.support_tickets where status = 'open'),
    'suspended', (select count(*) from public.profiles where status <> 'active')
  );
end;
$$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_audit_log(p_limit integer default 100)
returns table (id bigint, actor_name text, action text, target_type text, target_id text, details jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select l.id, coalesce(p.username, '—'), l.action, l.target_type, l.target_id, l.details, l.created_at
    from private.audit_log l
    left join public.profiles p on p.id = l.actor_id
    order by l.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;
revoke execute on function public.admin_audit_log(integer) from public, anon;
grant execute on function public.admin_audit_log(integer) to authenticated;

-- ─── Ürünler ────────────────────────────────────────────────────────────────

drop policy if exists "products: yönetici hepsini görür" on public.products;
create policy "products: yönetici hepsini görür" on public.products
  for select to authenticated using (private.is_admin());

create or replace function public.admin_upsert_product(
  p_id text, p_name text, p_category text, p_price integer, p_stock integer,
  p_description text, p_image_url text, p_active boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_id text;
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://' then
    raise exception 'invalid_image' using errcode = 'P0001';
  end if;
  v_id := coalesce(nullif(btrim(p_id), ''), 'pr' || substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.products (id, name, category, price, stock, description, image_url, active)
  values (v_id, btrim(p_name), p_category, p_price, greatest(p_stock, 0), coalesce(p_description, ''), p_image_url, coalesce(p_active, true))
  on conflict (id) do update
    set name = excluded.name, category = excluded.category, price = excluded.price, stock = excluded.stock,
        description = excluded.description, image_url = excluded.image_url, active = excluded.active;
  perform private.audit('product_upsert', 'product', v_id,
    jsonb_build_object('name', p_name, 'price', p_price, 'stock', p_stock, 'active', p_active));
  return v_id;
end;
$$;
revoke execute on function public.admin_upsert_product(text, text, text, integer, integer, text, text, boolean) from public, anon;
grant execute on function public.admin_upsert_product(text, text, text, integer, integer, text, text, boolean) to authenticated;

-- Ürün görselleri: herkese açık kova, yalnızca yönetici yazar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "catalog: yönetici yükler" on storage.objects;
create policy "catalog: yönetici yükler" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalog' and private.is_admin());
drop policy if exists "catalog: yönetici günceller" on storage.objects;
create policy "catalog: yönetici günceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog' and private.is_admin()) with check (bucket_id = 'catalog' and private.is_admin());
drop policy if exists "catalog: yönetici siler" on storage.objects;
create policy "catalog: yönetici siler" on storage.objects
  for delete to authenticated using (bucket_id = 'catalog' and private.is_admin());

-- ─── Haberler ───────────────────────────────────────────────────────────────

create or replace function public.admin_upsert_news(
  p_id text, p_category text, p_title text, p_summary text, p_body text[], p_ai_summary text[],
  p_image_url text, p_video_url text, p_read_time text, p_is_live boolean, p_is_special boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_id text;
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_title, ''))) < 5 then
    raise exception 'invalid_title' using errcode = 'P0001';
  end if;
  if (p_image_url is not null and p_image_url !~ '^https://') or (p_video_url is not null and p_video_url !~ '^https://') then
    raise exception 'invalid_url' using errcode = 'P0001';
  end if;
  v_id := coalesce(nullif(btrim(p_id), ''), 'n' || substr(md5(gen_random_uuid()::text), 1, 10));
  insert into public.news_articles (id, category, title, summary, body, ai_summary, image_url, video_url, read_time, is_live, is_special, published_at)
  values (v_id, p_category, btrim(p_title), coalesce(p_summary, ''), coalesce(p_body, '{}'), coalesce(p_ai_summary, '{}'),
          p_image_url, p_video_url, coalesce(p_read_time, ''), coalesce(p_is_live, false), coalesce(p_is_special, false), now())
  on conflict (id) do update
    set category = excluded.category, title = excluded.title, summary = excluded.summary, body = excluded.body,
        ai_summary = excluded.ai_summary, image_url = excluded.image_url, video_url = excluded.video_url,
        read_time = excluded.read_time, is_live = excluded.is_live, is_special = excluded.is_special;
  perform private.audit('news_upsert', 'news', v_id, jsonb_build_object('title', p_title));
  return v_id;
end;
$$;
revoke execute on function public.admin_upsert_news(text, text, text, text, text[], text[], text, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_upsert_news(text, text, text, text, text[], text[], text, text, text, boolean, boolean) to authenticated;

create or replace function public.admin_delete_news(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.news_articles where id = p_id;
  perform private.audit('news_delete', 'news', p_id, '{}');
end;
$$;
revoke execute on function public.admin_delete_news(text) from public, anon;
grant execute on function public.admin_delete_news(text) to authenticated;

-- ─── Arenalar ───────────────────────────────────────────────────────────────

create or replace function public.admin_update_arena(
  p_key text, p_name text, p_tagline text, p_description text, p_image_url text, p_prizes integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if array_length(p_prizes, 1) <> 3 or exists (select 1 from unnest(p_prizes) x where x <= 0) then
    raise exception 'invalid_prizes' using errcode = 'P0001';
  end if;
  if p_image_url is not null and p_image_url !~ '^https://' then
    raise exception 'invalid_image' using errcode = 'P0001';
  end if;
  update public.arenas
     set name = coalesce(nullif(btrim(p_name), ''), name),
         tagline = coalesce(p_tagline, tagline),
         description = coalesce(p_description, description),
         image_url = coalesce(p_image_url, image_url),
         prizes = p_prizes
   where key = p_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.audit('arena_update', 'arena', p_key, jsonb_build_object('prizes', p_prizes));
end;
$$;
revoke execute on function public.admin_update_arena(text, text, text, text, text, integer[]) from public, anon;
grant execute on function public.admin_update_arena(text, text, text, text, text, integer[]) to authenticated;

-- ─── Destek talepleri: yönetici yanıtı kullanıcıya bildirim olarak gider ────

alter table public.support_tickets add column if not exists admin_reply text check (admin_reply is null or char_length(admin_reply) <= 2000);
alter table public.support_tickets add column if not exists answered_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'arena', 'token', 'order', 'mention', 'reply', 'support'));

create or replace function public.admin_answer_ticket(p_id uuid, p_reply text, p_close boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_reply, ''))) < 2 then
    raise exception 'invalid_reply' using errcode = 'P0001';
  end if;
  update public.support_tickets
     set admin_reply = btrim(p_reply), answered_at = now(),
         status = case when p_close then 'closed' else 'answered' end
   where id = p_id
  returning user_id into v_user;
  if v_user is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.notifications (user_id, kind, text, href)
  values (v_user, 'support', 'Destek talebine yanıt geldi: "' || left(btrim(p_reply), 80) || '"', '/destek');
  perform private.audit('ticket_answer', 'ticket', p_id::text, '{}');
end;
$$;
revoke execute on function public.admin_answer_ticket(uuid, text, boolean) from public, anon;
grant execute on function public.admin_answer_ticket(uuid, text, boolean) to authenticated;
