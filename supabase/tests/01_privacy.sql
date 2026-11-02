-- Gizli hesap, takip isteği, engelleme ve profil alanı korumaları
do $$
declare
  a uuid; b uuid; c uuid; p uuid; st text;
  q_post text;
begin
  a := pg_temp.new_user('gizli', p_private => true);
  b := pg_temp.new_user('takipci');
  c := pg_temp.new_user('yabanci');

  perform pg_temp.act_as(a);
  insert into public.posts (author_id, caption) values (a, 'gizli gönderi') returning id into p;
  q_post := format('select 1 from public.posts where id = %L', p);
  perform pg_temp.ok(pg_temp.rows(q_post) = 1, 'sahip kendi gönderisini görmeli');

  -- Yabancı gizli hesabın gönderisini göremez
  perform pg_temp.act_as(c);
  perform pg_temp.ok(pg_temp.rows(q_post) = 0, 'yabancı gizli hesabın gönderisini görmemeli');

  -- Başkası adına gönderi açılamaz, başkasının gönderisi değiştirilemez/silinemez
  perform pg_temp.fails(format('insert into public.posts (author_id, caption) values (%L, %L)', a, 'sahte'),
                        'başkası adına paylaşım engellenmeli');
  perform pg_temp.denied(format('update public.posts set caption = %L where id = %L', 'ele geçirildi', p),
                         'başkasının gönderisi düzenlenmemeli');
  perform pg_temp.denied(format('delete from public.posts where id = %L', p),
                         'başkasının gönderisi silinmemeli');

  -- Gizli hesaba takip isteği beklemede kalır; onaylanana kadar içerik görünmez
  perform pg_temp.act_as(b);
  insert into public.follows (follower_id, following_id) values (b, a);
  select status into st from public.follows where follower_id = b and following_id = a;
  perform pg_temp.ok(st = 'pending', 'gizli hesaba takip beklemede olmalı (durum: ' || coalesce(st, 'yok') || ')');
  perform pg_temp.ok(pg_temp.rows(q_post) = 0, 'onaylanmamış takipçi gönderiyi görmemeli');
  perform pg_temp.denied(format('update public.follows set status = %L where follower_id = %L and following_id = %L',
                                'accepted', b, a),
                         'takipçi kendi isteğini onaylayamamalı');

  -- Hesap sahibi onaylar → görünür
  perform pg_temp.act_as(a);
  update public.follows set status = 'accepted' where follower_id = b and following_id = a;
  perform pg_temp.act_as(b);
  perform pg_temp.ok(pg_temp.rows(q_post) = 1, 'onaylı takipçi gönderiyi görmeli');

  -- Başkası adına takip açılamaz
  perform pg_temp.act_as(c);
  perform pg_temp.fails(format('insert into public.follows (follower_id, following_id) values (%L, %L)', b, c),
                        'başkası adına takip engellenmeli');

  -- Engelleme: engellenen kişi profili ve gönderiyi göremez, mesaj başlatamaz
  perform pg_temp.act_as(a);
  insert into public.blocks (blocker_id, blocked_id) values (a, b);
  perform pg_temp.act_as(b);
  perform pg_temp.ok(pg_temp.rows(q_post) = 0, 'engellenen kişi gönderiyi görmemeli');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.profiles where id = %L', a)) = 0,
                     'engellenen kişi profili görmemeli');
  perform pg_temp.fails(format('select public.get_or_create_dm(%L)', a), 'engellenen kişi mesaj başlatamamalı');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.blocks where blocker_id = %L', a)) = 0,
                     'engellenen kişi engel listesini görmemeli');

  -- Profilde yetkili alanlar kullanıcı tarafından değiştirilemez
  perform pg_temp.act_as(c);
  begin
    update public.profiles set verified = true, discovery_points = 999999, status = 'active' where id = c;
  exception when others then null;
  end;
  perform pg_temp.act_admin();
  perform pg_temp.ok((select not verified and discovery_points < 999999 from public.profiles where id = c),
                     'kullanıcı kendine mavi tik / puan verememeli');
  perform pg_temp.act_as(c);
  perform pg_temp.denied(format('update public.profiles set bio = %L where id = %L', 'hacked', a),
                         'başkasının profili düzenlenmemeli');
end $$;
