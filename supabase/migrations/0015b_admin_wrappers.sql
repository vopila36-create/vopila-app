-- ============================================================================
-- VOPILA — Yönetici fonksiyonlarını proje kalıbına taşı (güvenlik denetimi uyarısı 0029)
-- Asıl işi yapan SECURITY DEFINER fonksiyonlar API'ye açık olmayan "private" şemaya alınır;
-- "public" şemada yalnızca SECURITY INVOKER ince sarmalayıcılar kalır. Davranış değişmez.
-- ============================================================================

alter function public.admin_overview() set schema private;
alter function public.admin_audit_log(integer) set schema private;
alter function public.admin_upsert_product(text, text, text, integer, integer, text, text, boolean) set schema private;
alter function public.admin_upsert_news(text, text, text, text, text[], text[], text, text, text, boolean, boolean) set schema private;
alter function public.admin_delete_news(text) set schema private;
alter function public.admin_update_arena(text, text, text, text, text, integer[]) set schema private;
alter function public.admin_answer_ticket(uuid, text, boolean) set schema private;

create or replace function public.admin_overview()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_overview(); $$;

create or replace function public.admin_audit_log(p_limit integer default 100)
returns table (id bigint, actor_name text, action text, target_type text, target_id text, details jsonb, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.admin_audit_log(p_limit); $$;

create or replace function public.admin_upsert_product(
  p_id text, p_name text, p_category text, p_price integer, p_stock integer,
  p_description text, p_image_url text, p_active boolean
)
returns text language sql security invoker set search_path = ''
as $$ select private.admin_upsert_product(p_id, p_name, p_category, p_price, p_stock, p_description, p_image_url, p_active); $$;

create or replace function public.admin_upsert_news(
  p_id text, p_category text, p_title text, p_summary text, p_body text[], p_ai_summary text[],
  p_image_url text, p_video_url text, p_read_time text, p_is_live boolean, p_is_special boolean
)
returns text language sql security invoker set search_path = ''
as $$ select private.admin_upsert_news(p_id, p_category, p_title, p_summary, p_body, p_ai_summary, p_image_url, p_video_url, p_read_time, p_is_live, p_is_special); $$;

create or replace function public.admin_delete_news(p_id text)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_delete_news(p_id); $$;

create or replace function public.admin_update_arena(
  p_key text, p_name text, p_tagline text, p_description text, p_image_url text, p_prizes integer[]
)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_update_arena(p_key, p_name, p_tagline, p_description, p_image_url, p_prizes); $$;

create or replace function public.admin_answer_ticket(p_id uuid, p_reply text, p_close boolean default false)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_answer_ticket(p_id, p_reply, p_close); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_overview()', 'admin_audit_log(integer)',
    'admin_upsert_product(text, text, text, integer, integer, text, text, boolean)',
    'admin_upsert_news(text, text, text, text, text[], text[], text, text, text, boolean, boolean)',
    'admin_delete_news(text)', 'admin_update_arena(text, text, text, text, text, integer[])',
    'admin_answer_ticket(uuid, text, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
    execute format('revoke execute on function private.%s from public, anon', f);
    execute format('grant execute on function private.%s to authenticated', f);
  end loop;
end $$;
