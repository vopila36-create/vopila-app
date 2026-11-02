-- ============================================================================
-- VOPILA — Mesajlarda "yazıyor…" göstergesi: gizli Realtime yayın kanalı `typing:<sohbet>`.
-- Kanalı yalnızca o sohbetin üyeleri dinleyebilir ve kanala yazabilir (başkası katılamaz, sahte sinyal gönderemez).
-- ============================================================================
create or replace function private.is_typing_member(p_topic text)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select split_part(p_topic, ':', 1) = 'typing'
     and exists (
       select 1 from public.conversation_members m
        where m.conversation_id::text = split_part(p_topic, ':', 2)
          and m.user_id = (select auth.uid())
     );
$$;
revoke execute on function private.is_typing_member(text) from public, anon;
grant execute on function private.is_typing_member(text) to authenticated;

drop policy if exists "typing: sohbet üyeleri dinler" on realtime.messages;
create policy "typing: sohbet üyeleri dinler" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.is_typing_member((select realtime.topic())));

drop policy if exists "typing: sohbet üyeleri yazar" on realtime.messages;
create policy "typing: sohbet üyeleri yazar" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and private.is_typing_member((select realtime.topic())));
