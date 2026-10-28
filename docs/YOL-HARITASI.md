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
- [ ] E-posta değiştir (Resend bağlanınca), dil/tema/yazı boyutu, beğeni sayılarını gizle, ayarlarda arama; "Demo verilerini sıfırla" yayından önce kaldırılır
- [ ] Destek taleplerini yanıtlama ekranı (yönetici paneli, Adım 4)

## Adım 6 — Yasal paket (yayından önce şart)
- [ ] 15 yaş sınırı + e-Devlet yaş doğrulama (yönetmelik 1 Kasım 2026'da yürürlükte; mevcut hesaplar 31 Mart 2027'ye kadar)
- [ ] 15–18 yaş: hesap varsayılan gizli, canlı yayın kapalı, "görüldü" bilgisi yok, kişiye özel reklam yok, sonsuz kaydırma kapalı
- [ ] KVKK metinleri, 5651 sayılı Kanun yükümlülükleri, hukukçu görüşü (token ödülleri / promosyon)

## Adım 7 — Aşama 7–9
- [ ] Haberler: gerçek haber kaynağı + yapay zekâ özeti
- [ ] Ana Sahne: gerçek öneri motoru, keşfet, trendler, arama
- [ ] Canlı yayın (LiveKit; 15–18 yaşa kapalı)

## Adım 8 — Rakiplerle aradaki farkı kapatma
- [ ] Mesajlaşma (DM), dikey video akışı, müzik, düzenleme araçları, taslaklar
- [ ] Anlar çıkartmaları, Öne Çıkanlar, Yakın Arkadaşlar, "yapay zekâ ile üretildi" etiketi, davet / QR / paylaşım bağlantıları

## Adım 9 — Yayın
- [ ] Ayrı canlı Supabase projesi + Pro plan, EAS Build, gerçek uygulama doğrulaması (App Attest / Play Integrity), Face ID işletim sistemi kilidi, Sentry, bağımsız güvenlik testi
- [ ] TestFlight + Google Play iç test → App Store ve Google Play

## Karar bekleyen
- [ ] **İş modeli** (öneri: sponsorlu arenalar — markalar ödül verir, VOPILA gelir elde eder)
