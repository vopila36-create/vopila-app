-- ============================================================================
-- VOPILA — Mesajlarda Instagram tarzı eylemler:
--  * Gönderimi geri al: gönderen, mesajını iki taraftan da kaldırır (içerik silinir, "geri alındı" kalır).
--  * Kalp tepkisi: sohbet üyesi bir mesaja kalp bırakır / kaldırır (engelli sohbette olmaz).
-- Değişiklikler canlı (UPDATE) yayınlanır; okuma kuralları (RLS) aynen geçerli.
-- ============================================================================
alter table public.messages add column if not exists unsent_at timestamptz;
alter table public.messages add column if not exists hearts uuid[] not null default '{}';

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'post', 'image', 'video', 'audio', 'unsent'));
alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_check
  check (kind in ('post', 'image', 'video', 'audio', 'unsent') or char_length(btrim(text)) > 0);

-- Gönderimi geri al: dosya yolunu döner (istemci dosyayı depodan siler; gönderen kendi klasörünü silebilir)
create or replace function private.unsend_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v public.messages%rowtype;
begin
  select * into v from public.messages where id = p_id for update;
  if not found or v.sender_id <> (select auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v.kind = 'unsent' then
    return null;
  end if;
  update public.messages
     set kind = 'unsent', text = '', media_path = null, post_id = null, duration_ms = null,
         hearts = '{}', unsent_at = now()
   where id = p_id;
  return v.media_path;
end;
$$;
revoke execute on function private.unsend_message(uuid) from public, anon;
grant execute on function private.unsend_message(uuid) to authenticated;

create or replace function public.unsend_message(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_aal();
  return private.unsend_message(p_id);
end;
$$;
revoke execute on function public.unsend_message(uuid) from public, anon;
grant execute on function public.unsend_message(uuid) to authenticated;

-- Kalp tepkisi
create or replace function private.heart_message(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v public.messages%rowtype; v_uid uuid := (select auth.uid());
begin
  select * into v from public.messages where id = p_id for update;
  if not found or not exists (select 1 from public.conversation_members m
                               where m.conversation_id = v.conversation_id and m.user_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if private.dm_blocked(v.conversation_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if v.kind = 'unsent' then
    return;
  end if;
  update public.messages
     set hearts = case when p_on then array_append(array_remove(hearts, v_uid), v_uid)
                       else array_remove(hearts, v_uid) end
   where id = p_id;
end;
$$;
revoke execute on function private.heart_message(uuid, boolean) from public, anon;
grant execute on function private.heart_message(uuid, boolean) to authenticated;

create or replace function public.heart_message(p_id uuid, p_on boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_aal();
  perform private.heart_message(p_id, p_on);
end;
$$;
revoke execute on function public.heart_message(uuid, boolean) from public, anon;
grant execute on function public.heart_message(uuid, boolean) to authenticated;
