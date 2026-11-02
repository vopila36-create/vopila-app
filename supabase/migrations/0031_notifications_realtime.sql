-- ============================================================================
-- VOPILA — Bildirimler anlık gelsin (Realtime; RLS'e uyar: herkes yalnızca kendi bildirimini alır).
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
