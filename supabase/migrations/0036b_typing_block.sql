-- ============================================================================
-- VOPILA — 0036 düzeltmesi: engellenen kişiler arasında "yazıyor…" sinyali gitmez (mesaj kuralıyla aynı);
-- kanal adındaki sohbet kimliği güvenli biçimde okunur.
-- ============================================================================
create or replace function private.is_typing_member(p_topic text)
returns boolean
language plpgsql
stable security definer
set search_path = ''
as $$
declare v_conv uuid;
begin
  if split_part(p_topic, ':', 1) <> 'typing' then
    return false;
  end if;
  begin
    v_conv := split_part(p_topic, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  return exists (select 1 from public.conversation_members m
                  where m.conversation_id = v_conv and m.user_id = (select auth.uid()))
     and not private.dm_blocked(v_conv);
end;
$$;
revoke execute on function private.is_typing_member(text) from public, anon;
grant execute on function private.is_typing_member(text) to authenticated;
