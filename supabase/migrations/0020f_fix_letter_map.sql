-- ============================================================================
-- VOPILA — Filtre harf eşleştirme hatası düzeltmesi: "ö" ile "ç" yer değiştirmişti
-- ("oç" → "o" olarak kaydedilip her "o" kelimesini engelliyordu). Eşleştirme düzeltildi ve
-- yasaklı ifade listesi doğru sadeleştirmeyle baştan yazıldı.
-- ============================================================================

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

delete from private.banned_terms;
insert into private.banned_terms (term, category, exact)
select private.normalize_tr(x.term), x.category, x.exact from (values
  ('orospu', 'kufur', false), ('orosbu', 'kufur', false), ('siktir', 'kufur', false), ('sikerim', 'kufur', false),
  ('sikeyim', 'kufur', false), ('siktim', 'kufur', false), ('sikik', 'kufur', false), ('amına', 'kufur', false),
  ('amcık', 'kufur', false), ('yarrak', 'kufur', false), ('dalyarak', 'kufur', false), ('pezevenk', 'kufur', false),
  ('kahpe', 'kufur', false), ('gavat', 'kufur', false), ('kaltak', 'kufur', false), ('sürtük', 'kufur', false),
  ('götveren', 'kufur', false), ('yavşak', 'kufur', false), ('ibne', 'kufur', false), ('sikko', 'kufur', false),
  ('amk', 'kufur', true), ('amq', 'kufur', true), ('aq', 'kufur', true), ('mk', 'kufur', true), ('sg', 'kufur', true),
  -- 'göt' ve 'piç' İngilizce 'got' / 'pic' ile karıştığı için listede yok (şikâyetle yakalanır)
  ('oç', 'kufur', true), ('puşt', 'kufur', true), ('orsp', 'kufur', true),
  ('şerefsiz', 'hakaret', false), ('haysiyetsiz', 'hakaret', false), ('gerizekalı', 'hakaret', false),
  ('salak', 'hakaret', false), ('aptal', 'hakaret', false), ('dangalak', 'hakaret', false), ('ahmak', 'hakaret', false),
  ('beyinsiz', 'hakaret', false), ('embesil', 'hakaret', false), ('hıyar', 'hakaret', true),
  ('porno', 'cinsel', false), ('sakso', 'cinsel', false), ('seks', 'cinsel', true), ('sex', 'cinsel', true),
  ('nude', 'cinsel', true), ('nudes', 'cinsel', true),
  ('öldürürüm', 'siddet', false), ('öldüreceğim', 'siddet', false), ('gebertirim', 'siddet', false),
  ('geberteceğim', 'siddet', false)
) as x(term, category, exact)
on conflict (term) do nothing;
