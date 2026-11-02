-- ============================================================================
-- VOPILA veritabanı testleri — ortak yardımcılar.
-- Her test dosyası şöyle çalışır:  begin; <_helpers.sql>; <test.sql>; rollback;
-- Yardımcılar pg_temp şemasında (yalnız bu oturumda var olur), test verisi en sonda geri alınır:
-- canlı veritabanında iz kalmaz. Başarısız kontrol 'FAIL: ...' hatası fırlatır.
-- ============================================================================

-- Yönetici (postgres) kimliğine dön
create or replace function pg_temp.act_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Verilen kullanıcı gibi davran (uygulamadaki oturum açmış kişi)
create or replace function pg_temp.act_as(p_user uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Test kullanıcısı aç (davet kodu + doğum tarihi ile, gerçek kayıt yolu)
create or replace function pg_temp.new_user(p_name text, p_birth date default date '2000-01-01',
                                            p_private boolean default false) returns uuid
language plpgsql as $$
declare
  v_id   uuid := gen_random_uuid();
  -- davet kodu biçimi: 8 karakter, A-Z ve 2-9
  v_code text := translate(upper(substr(md5(random()::text), 1, 8)), '01', 'GH');
begin
  perform pg_temp.act_admin();
  insert into private.invites (code, max_uses) values (v_code, 1);
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'tst_' || replace(v_id::text, '-', '') || '@test.invalid',
          '{"provider":"email"}'::jsonb,
          jsonb_build_object('username', left(p_name, 8) || substr(md5(v_id::text), 1, 6),
                             'birth_date', p_birth, 'invite_code', v_code),
          now(), now());
  if p_private then
    update public.profiles set is_private = true where id = v_id;
  end if;
  return v_id;
end $$;

-- Koşul doğru değilse testi düşür
create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAIL: %', p_msg;
  end if;
end $$;

-- Komut hata vermeli (isteğe bağlı: hata metni p_like ile eşleşmeli)
create or replace function pg_temp.fails(p_sql text, p_msg text, p_like text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not ilike '%' || p_like || '%' then
      raise exception 'FAIL: % (beklenmeyen hata: %)', p_msg, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % (hata bekleniyordu, komut geçti)', p_msg;
end $$;

-- Komut kaç satırı etkiledi (RLS sessizce süzdüğünde 0 döner)
create or replace function pg_temp.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Yazma girişimi reddedilmeli: ya hata verir ya da kurallar yüzünden hiçbir satıra dokunmaz
create or replace function pg_temp.denied(p_sql text, p_msg text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    return;
  end;
  if n > 0 then
    raise exception 'FAIL: % (% satır değişti)', p_msg, n;
  end if;
end $$;

-- Sorgunun döndürdüğü satır sayısı
create or replace function pg_temp.rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;
