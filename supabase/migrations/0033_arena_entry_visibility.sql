-- ============================================================================
-- VOPILA — Güvenlik: arena girişleri de hesap gizliliğine uysun (Instagram kuralı).
-- Önceden arena_entries herkese açıktı: gizli hesabın ya da seni engellemiş birinin arena görseli,
-- onu görmemesi gereken kişiye de (sıralama ve dosya adresi üzerinden) açılabiliyordu.
-- Artık giriş yalnızca yazarını görebilenlere görünür (engel, gizli hesap, askı — can_view_user).
-- Sıralama görünümü (arena_rankings) security_invoker olduğu için aynı kurala uyar; medya dosyası
-- izni de arena_entries üzerinden kontrol edildiğinden dosyalar da korunur.
-- ============================================================================
drop policy if exists "arena_entries: hesap gizliliği" on public.arena_entries;
create policy "arena_entries: hesap gizliliği" on public.arena_entries as restrictive for select to anon, authenticated
  using (author_id = (select auth.uid()) or private.can_view_user(author_id));
