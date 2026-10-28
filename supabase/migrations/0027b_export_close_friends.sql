-- Verilerimi indir: Yakın Arkadaşlar listesi de eklendi (export_my_data, 0024b'nin devamı)
create or replace function private.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.export_my_data_base() || jsonb_build_object(
    'ilgi_alanlari', coalesce((select jsonb_agg(jsonb_build_object('konu', topic, 'puan', round(score::numeric, 1)))
                               from private.my_interests()), '[]'),
    'yas_grubu', (select jsonb_build_object('grup', a.age_group, 'yontem', a.method, 'degisim_ayi', a.next_change)
                  from private.user_age a where a.user_id = v_uid),
    'ihlaller', coalesce((select jsonb_agg(jsonb_build_object('neden', private.reason_label(s.reason), 'tur', s.target_type,
                                                              'agir', s.severe, 'tarih', s.created_at) order by s.created_at)
                          from private.strikes s where s.user_id = v_uid), '[]'),
    'ebeveyn_baglantisi', (select jsonb_build_object('rol', case when l.parent_id = v_uid then 'ebeveyn' else 'cocuk' end,
                                                     'durum', l.status, 'tarih', l.created_at)
                           from public.parent_links l where v_uid in (l.parent_id, l.child_id) limit 1),
    'yakin_arkadaslar', coalesce((select jsonb_agg(jsonb_build_object('kullanici', p.username, 'tarih', c.created_at))
                                  from public.close_friends c join public.profiles p on p.id = c.friend_id
                                  where c.owner_id = v_uid), '[]')
  );
end;
$$;
