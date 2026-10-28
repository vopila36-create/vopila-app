-- ============================================================================
-- VOPILA — "Yapay zekâ ile üretildi" etiketi (Kullanım Koşulları md. 3: YZ içeriği belirtilmeli)
-- Paylaşan işaretler; sonradan kaldıramaz (yalnızca yönetici değiştirebilir).
-- ============================================================================
alter table public.posts add column if not exists ai_generated boolean not null default false;
grant insert (ai_generated) on public.posts to authenticated;
