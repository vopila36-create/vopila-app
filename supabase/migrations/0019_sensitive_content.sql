-- ============================================================================
-- VOPILA — Zararlı içerik filtresi (Yaş Doğrulama Yönetmeliği md. 8: 18 altı için zararlı içeriği
-- azaltan filtreleme varsayılan açık)
--  * posts.sensitive: paylaşan "Hassas içerik" diye işaretler ya da yönetici şikâyet üzerine işaretler.
--  * 18 altı kullanıcı: hassas gönderileri ve 2+ farklı kişinin şikâyet ettiği (incelenmemiş) gönderileri
--    hiç görmez; bunlara bağlı arena katılımlarını da görmez. Yetişkinler hassas içeriği bulanık görür.
-- ============================================================================

alter table public.posts add column if not exists sensitive boolean not null default false;
grant insert (sensitive), update (sensitive) on public.posts to authenticated;

create index if not exists reports_open_target_idx on public.reports (target_type, target_id) where status = 'open';

-- İzleyen kişi 18 altı mı (sorgu başına bir kez hesaplanır)
create or replace function private.viewer_is_minor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.is_minor((select auth.uid())), false);
$$;
grant execute on function private.viewer_is_minor() to anon, authenticated;

-- Gönderi 18 altı için uygun mu
create or replace function private.minor_safe_post(p_post uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not coalesce((select p.sensitive from public.posts p where p.id = p_post), false)
     and (select count(distinct r.reporter_id) from public.reports r
          where r.target_type = 'post' and r.target_id = p_post and r.status = 'open') < 2;
$$;
grant execute on function private.minor_safe_post(uuid) to anon, authenticated;

drop policy if exists "posts: 18 altı içerik filtresi" on public.posts;
create policy "posts: 18 altı içerik filtresi" on public.posts as restrictive for select to anon, authenticated
  using (
    not (select private.viewer_is_minor())
    or author_id = (select auth.uid())
    or (not sensitive and private.minor_safe_post(id))
  );

drop policy if exists "arena_entries: 18 altı içerik filtresi" on public.arena_entries;
create policy "arena_entries: 18 altı içerik filtresi" on public.arena_entries as restrictive for select to anon, authenticated
  using (
    not (select private.viewer_is_minor())
    or author_id = (select auth.uid())
    or post_id is null
    or private.minor_safe_post(post_id)
  );

-- Yönetici: şikâyeti "hassas olarak işaretle" ile de sonuçlandırabilir
create or replace function private.admin_resolve_report(p_report uuid, p_decision text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.reports%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision not in ('remove', 'dismiss', 'sensitive') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if r.target_type = 'post' then
    if p_decision = 'sensitive' then
      update public.posts set sensitive = true, is_hidden = false where id = r.target_id;
    else
      update public.posts set is_hidden = (p_decision = 'remove') where id = r.target_id;
    end if;
  elsif r.target_type = 'comment' then
    update public.comments set is_hidden = (p_decision = 'remove') where id = r.target_id;
  end if;

  update public.reports
     set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_by = (select auth.uid()), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'report_' || p_decision, r.target_type, r.target_id::text, '{}');
end;
$$;
