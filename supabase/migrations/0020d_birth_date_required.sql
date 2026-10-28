-- ============================================================================
-- VOPILA — E-postayla kayıtta doğum tarihi zorunlu (sunucuda da). Doğum tarihi yine saklanmaz.
-- Başka yollarla açılan hesaplara (ileride Google ile giriş) uygulama açılışta bir kez sorar.
-- ============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate     text;
  display_name  text;
  v_birth       text := new.raw_user_meta_data ->> 'birth_date';
  v_group       text;
begin
  -- E-postayla kayıtta doğum tarihi zorunlu (uygulama dışından yapılan kayıtlar dahil)
  if v_birth is null and new.raw_app_meta_data ->> 'provider' = 'email' then
    raise exception 'birth_date_required' using errcode = 'P0001';
  end if;
  if v_birth is not null then
    begin
      v_group := private.age_group_from(v_birth::date);
    exception when others then
      raise exception 'invalid_birth_date' using errcode = 'P0001';
    end;
    if v_group = 'under15' then
      raise exception 'under_15' using errcode = 'P0001';
    end if;
  end if;

  base_username := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base_username) < 3 then
    base_username := 'kasif';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    candidate := base_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  display_name := left(coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    candidate
  ), 60);

  insert into public.profiles (id, username, name, avatar_url)
  values (
    new.id,
    candidate,
    display_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  if v_group is not null then
    perform private.apply_age_group(new.id, v_group, 'self');
    perform private.set_next_change(new.id, v_birth::date);
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' where id = new.id;
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- Filtre: önce Unicode NFKD (tam genişlikli / matematiksel harfler → düz Latin, işaretli harfler → harf + işaret), sonra işaretler,
-- etiket ve görünmez karakterler silinir, sonra benzer harfler çevrilir (otomatik güvenlik incelemesi).
create or replace function private.normalize_tr(p text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(
           translate(
             lower(replace(replace(
               regexp_replace(normalize(coalesce(p, ''), NFKD),
                 '[\u0300-\u036F\u0483-\u0489\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u20D0-\u20FF\u3164\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\U000E0000-\U000E007F]',
                 '', 'g'),
               'I', 'ı'), 'İ', 'i')),
             'ığüşöçâîû0134579@$!|аеорсхуікмнтвзαεορτυικνχѕјԁɡӏ',
             'igusocaiuoieastgasiiaeopcxyikmhtbzaeoptuikvxsjdgl'),
           '([a-z])\1+', '\1', 'g');
$$;
update private.banned_terms set term = private.normalize_tr(term) where term <> private.normalize_tr(term);
