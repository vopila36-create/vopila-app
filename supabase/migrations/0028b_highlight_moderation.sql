-- ============================================================================
-- VOPILA — Öne Çıkanlar denetimi (otomatik güvenlik incelemesi)
--  * Yönetici bir anı kaldırınca, o anın albümlerdeki kopyaları da silinir.
--  * Albümler şikâyet edilebilir ('highlight'); kaldırma kararı albümü siler ve sahibine ihlal yazar.
-- ============================================================================

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'moment', 'live', 'highlight'));

create or replace function private.report_set_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.target_author_id := case new.target_type
    when 'post' then (select author_id from public.posts where id = new.target_id)
    when 'comment' then (select author_id from public.comments where id = new.target_id)
    when 'moment' then (select author_id from public.moments where id = new.target_id)
    when 'highlight' then (select owner_id from public.highlights where id = new.target_id)
    when 'user' then new.target_id
    else null end;
  return new;
end;
$$;

create or replace function private.admin_resolve_report(p_report uuid, p_decision text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reports%rowtype;
  v_author uuid;
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
  v_author := r.target_author_id;

  if r.target_type = 'post' then
    if p_decision = 'sensitive' then
      update public.posts set sensitive = true, is_hidden = false where id = r.target_id;
    else
      update public.posts set is_hidden = (p_decision = 'remove') where id = r.target_id;
    end if;
  elsif r.target_type = 'comment' then
    update public.comments set is_hidden = (p_decision = 'remove') where id = r.target_id;
  elsif r.target_type = 'moment' then
    if p_decision = 'remove' then
      -- Anın albümlerdeki kopyaları da kaldırılır
      delete from public.highlight_items hi
       where hi.storage_path in (select mi.storage_path from public.moment_items mi where mi.moment_id = r.target_id);
      delete from public.moments where id = r.target_id;
    end if;
  elsif r.target_type = 'highlight' then
    if p_decision = 'remove' then
      delete from public.highlights where id = r.target_id;
    end if;
  end if;

  update public.reports
     set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_by = (select auth.uid()), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  if p_decision = 'remove' then
    perform private.add_strike(v_author, r.reason, r.target_type, r.target_id);
  end if;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'report_' || p_decision, r.target_type, r.target_id::text,
          jsonb_build_object('reason', r.reason, 'author', v_author));
end;
$$;
