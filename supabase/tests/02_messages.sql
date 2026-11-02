-- Mesaj gizliliği, geri alma, kalp ve engelleme
do $$
declare
  a uuid; b uuid; c uuid; conv uuid; m uuid; m2 uuid; v_kind text; v_text text;
  q_conv text;
begin
  a := pg_temp.new_user('ayse');
  b := pg_temp.new_user('burak');
  c := pg_temp.new_user('cem');

  perform pg_temp.act_as(a);
  conv := public.get_or_create_dm(b);
  insert into public.messages (conversation_id, sender_id, text) values (conv, a, 'merhaba') returning id into m;
  q_conv := format('select 1 from public.messages where conversation_id = %L', conv);

  perform pg_temp.act_as(b);
  perform pg_temp.ok(pg_temp.rows(q_conv) = 1, 'alıcı mesajı görmeli');
  insert into public.messages (conversation_id, sender_id, text) values (conv, b, 'selam') returning id into m2;

  -- Üçüncü kişi sohbeti okuyamaz, araya giremez, kimseyi taklit edemez
  perform pg_temp.act_as(c);
  perform pg_temp.ok(pg_temp.rows(q_conv) = 0, 'üçüncü kişi mesajları okuyamamalı');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.conversation_members where conversation_id = %L', conv)) = 0,
                     'üçüncü kişi sohbet üyelerini görmemeli');
  perform pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, text) values (%L, %L, %L)', conv, c, 'araya girdim'),
                        'üye olmayan sohbete yazamamalı');
  perform pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, text) values (%L, %L, %L)', conv, a, 'taklit'),
                        'başkası adına mesaj yazılamamalı');
  perform pg_temp.fails(format('select public.unsend_message(%L)', m), 'üye olmayan mesajı geri alamamalı');
  perform pg_temp.fails(format('select public.heart_message(%L, true)', m), 'üye olmayan kalp bırakamamalı');
  perform pg_temp.fails(format('insert into public.conversation_members (conversation_id, user_id) values (%L, %L)', conv, c),
                        'kimse kendini başkasının sohbetine ekleyememeli');

  -- Alıcı: mesajı geri alamaz, düzenleyemez, silemez; kalp bırakabilir
  perform pg_temp.act_as(b);
  perform pg_temp.fails(format('select public.unsend_message(%L)', m), 'alıcı karşı tarafın mesajını geri alamamalı');
  perform pg_temp.denied(format('update public.messages set text = %L where id = %L', 'değişti', m), 'mesaj düzenlenememeli');
  perform pg_temp.denied(format('delete from public.messages where id = %L', m), 'mesaj doğrudan silinememeli');
  perform public.heart_message(m, true);
  perform pg_temp.ok((select b = any(hearts) from public.messages where id = m), 'alıcının kalbi kaydedilmeli');

  -- Gönderen geri alır: iki taraftan da içerik kalkar
  perform pg_temp.act_as(a);
  perform public.unsend_message(m);
  perform pg_temp.act_as(b);
  select kind, text into v_kind, v_text from public.messages where id = m;
  perform pg_temp.ok(v_kind = 'unsent' and v_text = '', 'geri alınan mesajın içeriği alıcıda da silinmeli');

  -- Geri alınan mesajın metni 30 gün güvenlik arşivinde kalır, ama kullanıcılar okuyamaz
  perform pg_temp.act_admin();
  perform pg_temp.ok((select count(*) = 1 from private.unsent_messages where message_id = m and text = 'merhaba'),
                     'geri alınan mesaj güvenlik arşivine yazılmalı');

  -- Engelleme: engellenen kişi yazamaz ve tepki veremez
  perform pg_temp.act_as(a);
  insert into public.blocks (blocker_id, blocked_id) values (a, b);
  perform pg_temp.act_as(b);
  perform pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, text) values (%L, %L, %L)', conv, b, 'hâlâ burada mıyım'),
                        'engellenen kişi mesaj yazamamalı');
  perform pg_temp.act_as(a);
  perform pg_temp.fails(format('select public.heart_message(%L, true)', m2), 'engelli sohbette kalp bırakılamamalı');
end $$;
