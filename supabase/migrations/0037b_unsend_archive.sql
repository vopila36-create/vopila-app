-- ============================================================================
-- VOPILA — 0037 düzeltmesi (güvenlik incelemesi): geri alınan mesaj delil olarak kaybolmasın.
--  * Geri alınan mesajın içeriği gizli arşive kopyalanır (yalnız sunucu/yönetici); 30 gün sonra otomatik silinir.
--  * Askıdaki hesap ve sohbetten çıkmış kişi mesaj geri alamaz.
-- ============================================================================
create table if not exists private.unsent_messages (
  message_id      uuid primary key,
  conversation_id uuid not null,
  sender_id       uuid not null,
  kind            text not null,
  text            text not null,
  post_id         uuid,
  media_path      text,
  sent_at         timestamptz not null,
  unsent_at       timestamptz not null default now()
);
create index if not exists unsent_messages_at_idx on private.unsent_messages (unsent_at);

create or replace function private.unsend_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v public.messages%rowtype; v_uid uuid := (select auth.uid());
begin
  select * into v from public.messages where id = p_id for update;
  if not found or v.sender_id <> v_uid
     or not exists (select 1 from public.conversation_members m
                     where m.conversation_id = v.conversation_id and m.user_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if v.kind = 'unsent' then
    return null;
  end if;
  insert into private.unsent_messages (message_id, conversation_id, sender_id, kind, text, post_id, media_path, sent_at)
  values (v.id, v.conversation_id, v.sender_id, v.kind, v.text, v.post_id, v.media_path, v.created_at)
  on conflict (message_id) do nothing;
  update public.messages
     set kind = 'unsent', text = '', media_path = null, post_id = null, duration_ms = null,
         hearts = '{}', unsent_at = now()
   where id = p_id;
  return v.media_path;
end;
$$;
revoke execute on function private.unsend_message(uuid) from public, anon;
grant execute on function private.unsend_message(uuid) to authenticated;

-- 30 günlük saklama: her gece eski arşiv kayıtları silinir
select cron.unschedule(jobid) from cron.job where jobname = 'vopila-unsent-retention';
select cron.schedule('vopila-unsent-retention', '17 3 * * *',
  $$delete from private.unsent_messages where unsent_at < now() - interval '30 days'$$);
