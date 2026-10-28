# VOPILA — Yol Haritası ve Yapılacaklar

> Son güncelleme: 28 Ekim 2026 · `[x]` = bitti, `[ ]` = yapılacak. Adım adım, sırayla ilerlenir.
> Bu dosyada anahtar / şifre gibi gizli bilgi bulunmaz.

## Mimari
| Parça | Servis | Görevi |
|---|---|---|
| Telefon uygulaması | Expo (React Native) | iPhone + Android tek kodla |
| Derleme & mağaza | EAS Build / Submit / Update | Bulutta derleme, mağazaya gönderme, hızlı güncelleme |
| Sunucu | Supabase | Veritabanı, giriş, dosyalar, güvenlik kuralları |
| E-posta | Resend + VOPILA alan adı | Doğrulama kodları, bildirim e-postaları |
| SMS | Netgsm / İleti Merkezi | Telefon doğrulama (ilk oy, ilk sipariş) |
| Canlı yayın | LiveKit | Yayın aç / izle |
| Hata takibi | Sentry / EAS Observe | Çökme ve hata uyarıları |
| Kod | GitHub (private) | Yedek ve geçmiş |

**Maliyet:** Test dönemi ~0 $ (+ alan adı). Yayında: Supabase Pro 25 $/ay, Apple 99 $/yıl, Google 25 $ (bir kez), Resend 3.000 e-posta/ay ücretsiz → sonra 20 $/ay, SMS ~0,10–0,20 TL/adet.

## Kararlar
- **Token** yalnızca arena kazanarak elde edilir, satılmaz. Mağazada gerçek ürünler kargo ile gönderilir.
- **Ödüller:** sezon sonunda otomatik verilir; sistem hile şüphesi bulursa ödül bekletilir ve yönetici onayına düşer.
- **SMS doğrulama:** kayıtta değil; yalnızca **ilk arena oyu / katılımı** (1 telefon = 1 hesap) ve **ilk sipariş** anında.
- **Teslimat:** Adreslerim (birden fazla + varsayılan), İl → İlçe → Mahalle listeden seçilir, sipariş anındaki adres siparişe sabitlenir, adresi yalnızca sahibi ve yönetici görür (KVKK).
- **Kargo:** bir kargo firmasıyla çalışılacak, firma henüz belli değil → sistem firmadan bağımsız (kargo firması + takip numarası alanları; başta elle, sonra entegrasyon).
- **Kod:** GitHub'da gizli depo. Yayından önce ayrı bir "canlı" Supabase projesi açılır.

## ✅ Bitenler
- [x] Aşama 1: tasarım sistemi + 37 tıklanabilir ekran
- [x] Aşama 2: Supabase veritabanı ve güvenlik kuralları; e-posta/şifre, e-posta koduyla giriş, şifremi unuttum, Face ID; profil düzenleme
- [x] Güvenlik: gizli medya, sunucu tarafı tarihler, oy almış arena girişi kilidi, ban/askı, yönetici rolü + denetim kaydı, hız sınırları, engelle/şikayet, toplu şikayet koruması, ödül hilesi tespiti
- [x] Kod GitHub'da (private)

## ⏳ Adım 0 — Beklenen bilgiler (geldikçe hemen yapılır)
- [x] **Ana e-posta:** vopila36@gmail.com — uygulama/yönetici hesabı ve kod kayıtları değişti (26 Ekim 2026)
- [x] Supabase yeni projeye taşındı (vopila36 hesabı, 28 Ekim 2026): tüm tablolar + güvenlik kuralları kuruldu, uygulama bağlandı, yönetici hesabı vopila36
- [ ] Expo ve Resend hesaplarının e-postası → vopila36@gmail.com
- [x] Yeni GitHub hesabı (vopila36-create) → kod yeni gizli depoya taşındı (28 Ekim 2026); eski depo onay alınmadan silinmez
- [ ] Alan adı (Natro) → Resend DNS kayıtları (4 kayıt; Natro bakımda, sonra) → Resend API anahtarı
- [ ] Supabase erişim anahtarı → e-posta servisi (SMTP), Türkçe kodlu e-posta şablonları, e-posta sınırı, CAPTCHA, sızmış şifre koruması, iki adımlı doğrulama

## Adım 1 — Aşama 3: Akış ve sosyal (kod bitti 28 Ekim 2026 — telefonda test bekliyor)
- [x] Gerçek foto/video yükleme, akış (Takip Ettiklerin / Sana Özel), beğeni, yorum, kaydet
- [x] Arenalar + Haberler Reels gibi tam ekran kaydırmalı; arenada yalnızca takip edilen arenalar, kaydırırken yıldızla puan; ilgi algoritması (en çok izlenen konu öne çıkar). Eski sayfalar: Arena Merkezi, Haber Merkezi
- [x] Gerçek profiller, takip / takip isteği (gizli hesap), takip istekleri ekranı, kişi arama
- [x] Mesajlaşma (DM): gelen kutusu, sohbet (canlı), uçak simgesiyle gönderiyi arkadaşına gönder, okunmamış rozeti
- [x] Yorum yanıtı, @bahsetme ve #etiket (bağlantılı + bildirim), etiket sayfası
- [x] Anlar (24 saat, fotoğraf/video, silme), şikayet ve engelle, engellenenler listesi, gerçek bildirimler
- [ ] Telefon bildirimleri (push) → mağaza derlemesi aşamasında (Expo Go'da sınırlı)
- [ ] İlgi algoritmasını sunucuya taşımak (şu an telefonda), Akış'a da uygulamak

## Adım 2 — Aşama 4: Arenalar (kod bitti 28 Ekim 2026)
- [x] Gerçek oylama, arena üyeliği, gerçek sıralama/liderlik, seviye puanı (oy, katılım, ödül) ve keşif puanı
- [x] **Aylık sezon:** her ay 1'inde başlar, ayın son günü gece 12'de (Türkiye saati) biter; ilk 3 + ödülleri herkese açık "Kazananlar" listesinde, üyelere bildirim, yeni ay otomatik açılır (her 15 dk kontrol)
- [x] Türkçe hata mesajları, "ödülün inceleniyor" (Cüzdan + Kazananlar)
- [ ] SMS doğrulama (ilk oy/katılım) → Netgsm / İleti Merkezi hesabı açılınca
- [ ] Rozet kuralları (şu an örnek rozetler)

## Adım 3 — Aşama 5: Token ve Mağaza (kod bitti 28 Ekim 2026)
- [x] Gerçek cüzdan (token hareketleri sunucuda); ürünler, fiyat ve stok sunucudan
- [x] Adreslerim (en fazla 10, bir varsayılan); İl → İlçe → Mahalle/Köy resmî listeden (81 il, 973 ilçe, 32 bin mahalle, 18 bin köy — uygulamaya gömülü, kaynak: ubeydeozdmr/turkiye-api, MIT); cadde/sokak, bina, daire ayrı; kurye notu
- [x] Siparişte adres sabitleme (yalnızca "Hazırlanıyor"ken değişir), KVKK onayı zorunlu, kargo firması + takip no, Hazırlanıyor → Kargoda → Teslim edildi (+ Sorunlu, İptal = token ve stok iadesi), her değişiklikte bildirim
- [ ] SMS doğrulama (ilk sipariş) → SMS sağlayıcısı açılınca
- [ ] Teslim edilen siparişlerde adresi maskeleme süresi → muhasebeci cevabından sonra
- [ ] Haritadan konum seçme (isteğe bağlı)
- [ ] Muhasebeciye sorulacak: ödül vergisi, e-arşiv fatura, T.C. kimlik no gerekli mi

## Adım 4 — Aşama 6: Yönetici paneli (kod bitti 28 Ekim 2026)
- [x] Yalnızca yönetici + **iki adımlı doğrulama** ile açılır (sunucuda zorunlu); Ayarlar > Yönetim > Yönetici Paneli
- [x] Özet sayılar; siparişler (durum, kargo firması, takip no, iptal = iade); ürünler (ekle/düzenle, görsel yükleme, stok, satıştan kaldır)
- [x] Arenalar (ad, açıklama, görsel, 1./2./3. ödül); haberler (ekle/düzenle/sil)
- [x] Şikayet kuyruğu (içerik önizleme, kaldır / sorun yok / hesabı askıya al), bekleyen ödül onayı (hile işaretleri açıklamalı), kullanıcı arama ve askı/yasak, destek talebi yanıtlama (kullanıcıya bildirim), denetim kaydı

## Adım 5 — Ayarlar paketi (Instagram karşılaştırması, kod bitti 28 Ekim 2026)
- [x] Hesabı sil (siparişler kimliksiz saklanır), engellenenler, verilerimi indir (KVKK), yardım ve sorun bildir, topluluk kuralları
- [x] İki adımlı doğrulama (doğrulama uygulaması), tüm cihazlardan çıkış, ayrıntılı bildirimler, yorum/bahsetme/mesaj izinleri, kısıtla/sessize al, gizli kelimeler
- [x] Kaydedilenler, Arşiv, Hareketlerin (beğendiklerin, yorumların), geçirdiğin süre + günlük sınır
- [x] Tema (28 Ekim 2026): Ayarlar > Tema — Koyu · Açık · Pembe · Telefona göre (seçim telefonda saklanır, uygulama yeniden açılır)
- [ ] E-posta değiştir (Resend bağlanınca), dil/yazı boyutu, beğeni sayılarını gizle, ayarlarda arama; "Demo verilerini sıfırla" yayından önce kaldırılır
- [ ] Destek taleplerini yanıtlama ekranı (yönetici paneli, Adım 4)

## Adım 6 — Yasal paket (yayından önce şart)
- [x] 15 yaş sınırı (28 Ekim 2026): kayıtta doğum tarihi (saklanmaz, yalnızca yaş grubu); 15 altı kayıt sunucuda reddedilir; eski hesaplara bir kez sorulur; 15 altı hesap kilitlenir (itiraz + hesap silme açık), itirazı yönetici inceler (Kullanıcılar > Yaş)
- [x] 15–18 yaş (sunucuda): hesap gizli açılır, takipçi/takip listesi yalnızca kendisine, yalnızca takip ettiği kişiler mesaj atabilir, aramada yalnızca ilişkisi olanlara çıkar; uygulamada video otomatik oynamaz, Reels 20 içerikte durur. "Görüldü" bilgisi zaten yok, reklam yok, canlı yayın henüz yok (açılınca 15–18'e kapalı olacak)
- [ ] e-Devlet yaş belirteci (Siber Güvenlik Başkanlığı servisi) → servise başvuru/erişim gerekiyor; mevcut hesaplar 31 Mart 2027'ye kadar doğrulanmalı
- [x] Ebeveyn denetimi (28 Ekim 2026, md. 9): genç 8 haneli tek kullanımlık kod üretir (15 dk), ebeveyn (18+) girer; günlük süre sınırı (dolunca uygulama o gün kilitlenir), hesap gizli kalsın, yalnızca takip edilenler yorum yapsın; genç denetimi ebeveyn onayı olmadan kaldıramaz; her değişiklikte bildirim
- [x] 18 altı profiller veri katmanında gizli (yalnızca kendisi, takip ilişkisi, ortak sohbet, ebeveyn, yönetici); gizli yazar "VOPILA kullanıcısı" görünür. 18 altı gönderi/an/profillerde ekran görüntüsü engeli (expo-screen-capture; Android tam, iOS 13+)
- [x] Zararlı içerik filtresi (28 Ekim 2026): hassas içerik işareti (Instagram listesi), 18 altına hassas/şikâyetli içerik gösterilmez, küfür/hakaret/cinsel ifade/tehdit metin filtresi, ihlal basamakları (uyarı → 1/3/7/30 gün → kapatma; ağır ihlal doğrudan kapatma), Hesap durumu ekranı, ayrıntılı Topluluk Kuralları, gönderi sahibi yorum siler; yorum izni ayarı kaldırıldı. 18'ini dolduranın ebeveyn bağlantısı her gece otomatik kalkar
- [ ] Fotoğraf/video/canlı yayında otomatik görüntü denetimi (pornografi yüklenemesin) → docs/ICERIK-DENETIMI.md. **AWS Rekognition daha sonra incelenecek** (kullanıcı kararı, 28 Ekim 2026)
- [x] "VOPILA" adı ayrılmış (28 Ekim 2026): kullanıcı adında/adında "vopila" ve benzer yazımlar (v0pila, wopila, vo.pila…) ile kayıt ve ad değişikliği yapılamaz; resmî ad yalnızca Yönetim Paneli > Kullanıcılar > Ad ver
- [x] Doğum tarihi kayıtta zorunlu (sunucuda da)
- [x] Kullanıcı adı (Instagram gibi): kayıtta kişi seçer, her ad yalnızca bir kişiye ait (büyük/küçük harf farkı yok), yazarken anında "✓ Kullanılabilir" / "Bu kullanıcı adı alınmış"
- [ ] Yönetmelik md. 8/6: alınan önlemleri web sitesinde yayımlamak; md. 10: yıllık itiraz istatistiği
- [x] Yasal metin taslakları (28 Ekim 2026, src/data/legal.ts): Aydınlatma Metni ve Gizlilik, Kullanım Koşulları, Çocukları Koruma Önlemleri (md. 8/6), Telif ve İçerik Bildirimi; Ayarlar > Yasal ve kayıt ekranında bağlantı; giriş yapmadan okunabilir. "Taslak" uyarısı LEGAL_DRAFT ile kapatılır
- [ ] Hukukçu: metinleri onaylasın; köşeli parantezleri doldur (şirket ünvanı, adres, MERSİS, KEP, yetkili mahkeme, Supabase sunucu ülkesi + KVKK md. 9 yurt dışı aktarım güvencesi), token ödülleri / promosyon / çekiliş mevzuatı, haber kaynaklarından yazılı izin, VERBİS kaydı gerekiyor mu, 5651 temsilci / trafik kaydı yükümlülükleri, e-Devlet yaş belirteci başvurusu
- [ ] Çocukları Koruma Önlemleri sayfasını web sitesinde de yayımla (alan adı açılınca)

## Adım 7 — Aşama 7–9
- [x] Haberler: gerçek kaynaklar (28 Ekim 2026) — TRT Haber, BBC Türkçe, DW Türkçe, CNN Türk, Habertürk, Sözcü RSS; sunucu 15 dk'da bir çeker, 7 günden eskiyi siler; yalnızca başlık + kısa özet + görsel + kaynağa bağlantı (FSEK). Yayından önce kaynaklardan yazılı izin istenmeli (hukukçu listesine eklendi)
- [ ] Yapay zekâ özeti (otomatik haberler için)
- [x] Ana Sahne gerçek veri (29 Ekim 2026): öne çıkan haber (gerçek kaynak), Gündemde (son 7 gün beğeni + yorum, yaşla azalan puan, sunucuda), gündemdeki #etiketler, bu ayın arena liderleri, takip önerileri (18 altı önerilmez)
- [x] İlgi alanları sunucuda (29 Ekim 2026): her cihazda aynı kişisel sıralama, günde %3 sönme, Ayarlar > İlgi alanların (görme + sıfırlama), Verilerimi indir'e eklendi (ilgi, yaş grubu, ihlaller, ebeveyn)
- [x] Keşfet sayfası (29 Ekim 2026): arama boşken gündemdeki etiketler, gerçek takip önerileri, en ilgi gören gönderiler ızgarası
- [ ] Canlı yayın (LiveKit; 15–18 yaşa kapalı)

## Adım 8 — Rakiplerle aradaki farkı kapatma
- [x] Mesajlarda fotoğraf, video ve sesli mesaj (29 Ekim 2026): gizli 'dm' deposu (yalnızca sohbet üyeleri), sesli mesaj en çok 2 dk, hesap silinince mesaj dosyaları da silinir
- [x] Taslaklar (telefonda, medya uygulama klasörüne kopyalanır; Ayarlar > Taslaklar) ve "Yapay zekâ ile üretildi" etiketi (paylaşan işaretler, sonradan kaldıramaz) — 29 Ekim 2026
- [ ] Müzik, düzenleme araçları
- [ ] Anlar çıkartmaları, Öne Çıkanlar, Yakın Arkadaşlar, davet / QR / paylaşım bağlantıları

## Adım 9 — Yayın
- [ ] Ayrı canlı Supabase projesi + Pro plan, EAS Build, gerçek uygulama doğrulaması (App Attest / Play Integrity), Face ID işletim sistemi kilidi, Sentry, bağımsız güvenlik testi
- [ ] TestFlight + Google Play iç test → App Store ve Google Play

## Karar bekleyen
- [ ] **İş modeli** (öneri: sponsorlu arenalar — markalar ödül verir, VOPILA gelir elde eder)
