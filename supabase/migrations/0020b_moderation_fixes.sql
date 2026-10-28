-- ============================================================================
-- VOPILA — 0020 düzeltmeleri (otomatik güvenlik incelemesi)
--  1) Şikâyet anında içeriğin sahibi kaydedilir: yazar içeriği silse bile kaldırma kararı ihlal yazar.
--  2) Filtre atlatma: görünmez (sıfır genişlikli, biçim) karakterler silinir; Kiril/Yunan benzer harfler
--     Latin karşılığına çevrilir.
-- ============================================================================

alter table public.reports add column if not exists target_author_id uuid;

create or replace function private.report_set_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.target_author_id := case new.target_type
    when 'post' then (select author_id from public.posts where id = new.target_id)
    when 'comment' then (select author_id from public.comments where id = new.target_id)
    when 'moment' then (select author_id from public.moments where id = new.target_id)
    when 'user' then new.target_id
    else null end;
  return new;
end;
$$;
revoke execute on function private.report_set_author() from public, anon, authenticated;
drop trigger if exists report_set_author on public.reports;
create trigger report_set_author before insert on public.reports
  for each row execute function private.report_set_author();

update public.reports r set target_author_id = case r.target_type
    when 'post' then (select author_id from public.posts where id = r.target_id)
    when 'comment' then (select author_id from public.comments where id = r.target_id)
    when 'moment' then (select author_id from public.moments where id = r.target_id)
    when 'user' then r.target_id end
 where target_author_id is null;

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
      delete from public.moments where id = r.target_id;
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

create or replace function private.normalize_tr(p text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(
           translate(
             lower(replace(replace(
               -- görünmez karakterler: yumuşak tire, sıfır genişlikli, yön işaretleri, BOM
               regexp_replace(coalesce(p, ''), '[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿]', '', 'g'),
               'I', 'ı'), 'İ', 'i')),
             -- Türkçe karakterler + yazım hileleri + Kiril/Yunan benzer harfler
             'ığüşöçâîû0134579@$!|аеорсхуікмнтвзαεορτυικνχѕјԁɡӏ',
             'iguscoaiuoieastgasiiaeopcxyikmhtbzaeoptuikvxsjdgl'),
           '([a-z])\1+', '\1', 'g');
$$;

-- Liste yeni sadeleştirmeyle yeniden yazılır (değişiklik yoksa aynı kalır)
update private.banned_terms set term = private.normalize_tr(term) where term <> private.normalize_tr(term);
