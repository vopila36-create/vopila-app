-- Gönderi etkileşimleri: yorum, beğeni, yorumları kapatma, etiketleme, sabitleme, bildirim gizliliği
do $$
declare
  a uuid; b uuid; c uuid; p uuid; cm uuid; i int; pid uuid;
begin
  a := pg_temp.new_user('yazar');
  b := pg_temp.new_user('okur');
  c := pg_temp.new_user('rahatsiz');

  perform pg_temp.act_as(a);
  insert into public.posts (author_id, caption) values (a, 'herkese açık') returning id into p;

  -- Yorum ve beğeni yalnız kendi adına
  perform pg_temp.act_as(b);
  insert into public.comments (post_id, author_id, text) values (p, b, 'güzel') returning id into cm;
  insert into public.likes (user_id, post_id) values (b, p);
  perform pg_temp.fails(format('insert into public.likes (user_id, post_id) values (%L, %L)', c, p),
                        'başkası adına beğeni yapılamamalı');
  perform pg_temp.fails(format('insert into public.comments (post_id, author_id, text) values (%L, %L, %L)', p, c, 'taklit'),
                        'başkası adına yorum yapılamamalı');

  -- Yorumları kapatınca başkası yorum yapamaz
  perform pg_temp.act_as(a);
  update public.posts set comments_off = true where id = p;
  perform pg_temp.act_as(b);
  perform pg_temp.fails(format('insert into public.comments (post_id, author_id, text) values (%L, %L, %L)', p, b, 'yine ben'),
                        'yorumlar kapalıyken yorum yapılamamalı');
  perform pg_temp.denied(format('update public.posts set comments_off = false where id = %L', p),
                         'başkası yorumları yeniden açamamalı');

  -- Yorum silme: üçüncü kişi silemez, gönderi sahibi silebilir
  perform pg_temp.act_as(c);
  perform pg_temp.denied(format('delete from public.comments where id = %L', cm), 'başkasının yorumu silinmemeli');
  perform pg_temp.act_as(a);
  perform pg_temp.ok(pg_temp.affected(format('delete from public.comments where id = %L', cm)) = 1,
                     'gönderi sahibi yorumu silebilmeli');
  update public.posts set comments_off = false where id = p;

  -- Etiketleme: etiketlenen kendini kaldırırsa yeniden etiketlenemez; başkası etiket ekleyemez
  insert into public.post_tags (post_id, user_id) values (p, b);
  perform pg_temp.act_as(c);
  perform pg_temp.fails(format('insert into public.post_tags (post_id, user_id) values (%L, %L)', p, c),
                        'gönderi sahibi olmayan etiket ekleyememeli');
  perform pg_temp.act_as(b);
  perform pg_temp.ok(pg_temp.affected(format('delete from public.post_tags where post_id = %L and user_id = %L', p, b)) = 1,
                     'etiketlenen kişi kendini kaldırabilmeli');
  perform pg_temp.act_as(a);
  perform pg_temp.fails(format('insert into public.post_tags (post_id, user_id) values (%L, %L)', p, b),
                        'kendini kaldıran kişi yeniden etiketlenmemeli');

  -- Sabitleme en fazla 3 gönderi
  for i in 1..3 loop
    insert into public.posts (author_id, caption, pinned_at) values (a, 'sabit ' || i, now()) returning id into pid;
  end loop;
  insert into public.posts (author_id, caption) values (a, 'dördüncü') returning id into pid;
  perform pg_temp.fails(format('update public.posts set pinned_at = now() where id = %L', pid),
                        'dördüncü gönderi sabitlenmemeli', 'pin_limit');

  -- Engellenen kişi yorum yapamaz, beğenemez
  insert into public.blocks (blocker_id, blocked_id) values (a, c);
  perform pg_temp.act_as(c);
  perform pg_temp.fails(format('insert into public.comments (post_id, author_id, text) values (%L, %L, %L)', p, c, 'engelliyim'),
                        'engellenen kişi yorum yapamamalı');
  perform pg_temp.fails(format('insert into public.likes (user_id, post_id) values (%L, %L)', c, p),
                        'engellenen kişi beğenememeli');

  -- Bildirimler yalnız sahibine görünür
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.notifications where user_id = %L', a)) = 0,
                     'başkasının bildirimleri görünmemeli');
  perform pg_temp.act_as(a);
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.notifications where user_id = %L', a)) > 0,
                     'yazar beğeni/yorum bildirimlerini görmeli');
end $$;
