-- Hesap güvenliği: yaş sınırları, 18 altı koruması, askı, yönetici yetkisi, iki adımlı doğrulama, anonim erişim
do $$
declare
  adult uuid; minor uuid; susp uuid; mfa uuid; priv uuid; p uuid; pp uuid; sp uuid; n bigint; t text;
begin
  -- 15 yaş altı kayıt olamaz
  perform pg_temp.fails(format('select pg_temp.new_user(%L, %L::date)', 'kucuk', (current_date - interval '13 years')::date),
                        '15 yaş altı kayıt reddedilmeli', 'under_15');

  adult := pg_temp.new_user('yetiskin');
  minor := pg_temp.new_user('genc', (current_date - interval '16 years')::date);

  -- Yetişkinin hassas içeriği 18 altına görünmez
  perform pg_temp.act_as(adult);
  insert into public.posts (author_id, caption, sensitive) values (adult, 'hassas', true) returning id into sp;
  insert into public.posts (author_id, caption) values (adult, 'normal') returning id into p;
  perform pg_temp.act_as(minor);
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.posts where id = %L', sp)) = 0,
                     '18 altı hassas içeriği görmemeli');

  -- Tanımadığı yetişkin 18 altına mesaj başlatamaz
  perform pg_temp.act_as(adult);
  perform pg_temp.fails(format('select public.get_or_create_dm(%L)', minor),
                        'yetişkin tanımadığı 18 altına mesaj atamamalı');

  -- Kullanıcı yaşını/yaş grubunu kendisi değiştiremez
  perform pg_temp.act_as(minor);
  perform pg_temp.fails(format('select public.declare_birth_date(%L::date)', date '1990-01-01'),
                        '18 altı doğum tarihini yetişkine çevirememeli');

  -- Yönetici işlemleri sıradan kullanıcıya kapalı
  perform pg_temp.act_as(adult);
  perform pg_temp.ok(not public.am_i_admin(), 'sıradan kullanıcı yönetici sayılmamalı');
  perform pg_temp.fails('select public.admin_overview()', 'admin_overview kapalı olmalı');
  perform pg_temp.fails(format('select public.admin_set_user_status(%L, %L)', minor, 'banned'),
                        'kullanıcı başkasını banlayamamalı');
  perform pg_temp.fails('select public.admin_create_invites(5)', 'kullanıcı davet kodu üretememeli');
  perform pg_temp.fails(format('select public.admin_set_age_group(%L, %L)', adult, 'adult'),
                        'kullanıcı yaş grubu atayamamalı');
  perform pg_temp.fails(format('select public.admin_upsert_product(%L, %L, %L, 1, 1, %L, null, true)', 'x', 'x', 'Spor', 'x'),
                        'kullanıcı ürün ekleyememeli');

  -- Askıya alınan hesap paylaşım yapamaz
  susp := pg_temp.new_user('askida');
  perform pg_temp.act_admin();
  update public.profiles set status = 'suspended' where id = susp;
  perform pg_temp.act_as(susp);
  perform pg_temp.fails(format('insert into public.posts (author_id, caption) values (%L, %L)', susp, 'askıdayım'),
                        'askıdaki hesap paylaşım yapamamalı');

  -- İki adımlı doğrulaması açık hesap, kod girmeden (aal1) veriye erişemez
  mfa := pg_temp.new_user('ikiadim');
  perform pg_temp.act_as(mfa);
  insert into public.posts (author_id, caption) values (mfa, 'korumalı') returning id into p;
  perform pg_temp.act_admin();
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), mfa, 'test', 'totp', 'verified', now(), now());
  perform pg_temp.act_as(mfa, 'aal1');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.posts where id = %L', p)) = 0,
                     'kod girilmeden (aal1) veri okunmamalı');
  perform pg_temp.fails(format('insert into public.posts (author_id, caption) values (%L, %L)', mfa, 'kodsuz'),
                        'kod girilmeden (aal1) paylaşım yapılamamalı');
  perform pg_temp.act_as(mfa, 'aal2');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.posts where id = %L', p)) = 1,
                     'kod girildikten sonra (aal2) veri okunmalı');

  -- Oturum açmamış ziyaretçi (anon): Instagram gibi herkese açık yetişkin içeriği görebilir;
  -- gizli hesabı, hassas içeriği, 18 altı profili ve özel verileri göremez.
  priv := pg_temp.new_user('gizlihes', p_private => true);
  perform pg_temp.act_as(priv);
  insert into public.posts (author_id, caption) values (priv, 'gizli') returning id into pp;
  perform pg_temp.act_admin();
  perform set_config('role', 'anon', true);
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.posts where id = %L', pp)) = 0,
                     'anonim ziyaretçi gizli hesabın gönderisini görmemeli');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.posts where id = %L', sp)) = 0,
                     'anonim ziyaretçi hassas içeriği görmemeli');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.profiles where id = %L', minor)) = 0,
                     'anonim ziyaretçi 18 altı profili görmemeli');
  foreach t in array array['messages', 'conversations', 'conversation_members', 'orders', 'addresses',
                           'notifications', 'token_ledger', 'blocks', 'follows', 'user_settings'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when others then n := 0;
    end;
    perform pg_temp.ok(n = 0, 'anonim ziyaretçi ' || t || ' tablosunu okuyamamalı');
  end loop;
  perform pg_temp.act_admin();
end $$;
