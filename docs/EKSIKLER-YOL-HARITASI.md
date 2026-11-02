# VOPILA — Eksikler ve Tamamlama Yol Haritası

_2 Kasım 2026 · Uygulamanın tamamı (ayarlar, ana ekranlar, sunucu, yayın hazırlığı) tarandı._

## Özet

- **Gerçekten çalışanlar:** giriş/kayıt (e-posta kodu, davet), mesajlar (fotoğraf, video, sesli), gönderi
  paylaşma, kamera, haberler, arena oylama ve sezon ödülleri, cüzdan, mağaza (token ile), siparişler,
  adresler, gizlilik ve engelleme ayarları, iki adımlı doğrulama, ebeveyn denetimi, destek, hesap silme,
  yönetim paneli.
- **En büyük sorun:** uygulama, giriş yapmış gerçek kullanıcıya da **örnek (sahte) veriyi** karıştırıyor.
  Her yeni testçi profilinde yapmadığı 6 gönderi, takip etmediği 3 kişi, 5 sahte bildirim ve arena
  sıralamasında sahte yarışmacılar görüyor. Beta'dan önce mutlaka temizlenmeli.
- **Hiç olmayanlar:** anlık bildirim (push), canlı yayın, SMS doğrulama, hata takibi (Sentry), testler.

---

## Faz 1 — Beta temizliği ✅ TAMAMLANDI (2 Kasım 2026)

Oturum açmış kullanıcıya artık hiç örnek veri gösterilmiyor (örnekler yalnızca giriş yapılmamış önizlemede).
Profil (takipçi/takip, beğeni, katılım tarihi, kapak, Profil Etkisi), rozetler ve istatistikler sunucudan;
arena ekranlarında gerçek yarışmacı adı ve sunucudaki ödüller; canlı yayın "Yakında"; ayarlarda demo sıfırlama
ve çalışmayan bildirim düğmeleri kaldırıldı, "Videoları otomatik oynat" çalışıyor; Anlar beğenisi sunucuda (0030);
bildirimler anlık (0031); çökme ekranı eklendi.

_Aşağıdaki tablo yapılanların kaydıdır:_

Testçiler davetle gelmeden önce yapılmalı.

| # | İş | Şu an | Dosya |
|---|---|---|---|
| 1.1 | Örnek veriyi gerçek kullanıcıdan tamamen ayır (gönderi, takip, anlar, bildirim, arena girişleri, ürün, haber yedekleri) | Hepsi karışık | `src/store/app-store.tsx` (138, 416, 712, 772, 848, 860, 961, 1007) |
| 1.2 | Arena/liderlik/ilgi ekranlarında gerçek yarışmacının adı yerine "Kerem Taş" görünmesi hatası | Hata | `arena/[key].tsx`, `liderlik.tsx`, `arena-merkezi.tsx`, `ilgi/[key].tsx` |
| 1.3 | Kendi profilim gerçek olsun: takipçi/takip sayısı, beğeni toplamı (+600 sabiti), "1+ Yıl", kapak fotoğrafı, Profil Etkisi | Çoğu sahte | `(tabs)/profil.tsx`, `useMe()` |
| 1.4 | Rozetler sunucudan (`user_badges` tablosu zaten var) ya da gizle | Tamamen sahte | `rozetler.tsx` |
| 1.5 | İstatistikler gerçek (`my_profile_impact` hazır) ya da gizle | Sahte grafik | `istatistikler.tsx` |
| 1.6 | Canlı yayını gizle ("Yakında") — LiveKit bağlanana kadar | Sahte yayınlar, sahte "başvuru alındı" | `canli/*`, ana sayfa kısayolu |
| 1.7 | Ana Sahne: örnek kapak, `/haber/n6` bağlantısı, örnek ilgi kartları | Sahte | `(tabs)/index.tsx` |
| 1.8 | Arama, etiket, @bahsetme, takip listelerine örnek kişi/gönderi eklenmesin; sahte kullanıcı profili yolu kapansın | Karışık | `arama.tsx`, `etiket/[tag].tsx`, `rich-text.tsx`, `takip.tsx`, `kullanici/[id].tsx` |
| 1.9 | Ayarlar: "Demo verilerini sıfırla" kalksın; "Tüm bildirimler" ve "Arena hatırlatmaları" (çalışmıyor) push gelene kadar kalksın; "Videoları otomatik oynat" gerçekten çalışsın | Ölü düğmeler | `ayarlar.tsx`, `bildirim-ayarlari.tsx` |
| 1.10 | "Yorumlar, bahsetmeler…" satır adı düzeltilsin (yorum izni kaldırılmıştı) | Yanlış etiket | `ayarlar.tsx` |
| 1.11 | Anlar'da beğeni gerçekten kaydedilsin | Sadece telefonda | `an/[id].tsx` |
| 1.12 | Bildirimler ekranı anlık güncellensin (realtime) | Ekran açılınca yenileniyor | `bildirimler.tsx` |
| 1.13 | Uygulama sürümü derlemeden okunsun; "Arkadaşlarını davet et" beta.vopila.com'u paylaşsın | Sabit "1.0.0" | `ayarlar.tsx` |
| 1.14 | Uygulama çökünce beyaz ekran yerine "Bir şeyler ters gitti — tekrar dene" ekranı | Yok | `_layout.tsx` |

## Faz 2 — Medya sağlamlığı ✅ TAMAMLANDI (2 Kasım 2026)

Fotoğraflar yüklemeden önce 1600 px'e küçültülüyor, kamera 720p kaydediyor, sınırı aşan dosyada yükleme başlamadan
uyarı veriliyor (gönderi 95 MB, mesaj 48 MB). Dosyalar telefonda belleğe alınmadan doğrudan diskten yükleniyor
(`src/lib/upload.ts`) ve gönderi, an ve mesajda yükleme yüzdesi gösteriliyor.

Testçiler video yükleyince sorun çıkmasın.

- 2.1 Videoyu yüklemeden önce küçült (720p) ve boyutunu kontrol et (sunucu sınırı 100 MB; 60 sn 1080p video aşabilir).
- 2.2 Dosyayı belleğe tamamen almadan yükle (büyük videoda uygulama çökmesin), yükleme yüzdesi göster.
- 2.3 Fotoğrafları makul boyuta indir (ör. en uzun kenar 1600 px).

## Faz 3 — Ayarları tamamlama (3.1–3.4 ✅ 2 Kasım 2026)

- ✅ 3.1 **E-posta değiştir** (mevcut şifre + yeni adrese 6 haneli kod). _Siz: Supabase > Emails > "Change email address" şablonuna {{ .Token }} ekleyin._
- ✅ 3.2 **Şifre değiştir**: mevcut şifre sunucuda kontrol (15 dk'da 5 deneme), yeni şifre en az 8 karakter. _Siz: Supabase > Sign In / Providers > Email > Minimum password length = 8._
- ✅ 3.3 **Günlük süre sınırı** hesapta; girişte telefona alınır.
- ✅ 3.4 **Verilerimi indir**: JSON dosyası (telefonda paylaşım menüsü, web'de indirme).
- ✅ 3.5 Beğeni sayılarını gizle, yazı boyutu (telefon ayarı), ayarlarda arama.
- 3.6 Dil seçimi (İngilizce) — yayından sonra da olabilir.

## Faz 4 — Android dağıtımı (4.2 ✅; 4.1 derleniyor)

- 4.1 APK derlemesini tamamla (son deneme internet kesintisinde yarıda kaldı).
- ✅ 4.2 Uygulamaya **özel imza anahtarı** (şu an Android'in herkese açık test anahtarı kullanılıyor; Play Store
  bunu kabul etmez ve testçilerin ileride güncelleme alabilmesi için anahtar baştan sabit olmalı).
  Anahtar dosyası depoya girmez; yedeğini siz saklarsınız.
- 4.3 Siz: APK'yı Google Drive'a yükleyip bağlantıyı davet mesajına eklersiniz.
- ✅ 4.4 Uygulama bağlantıları: beta.vopila.com/davet ve /u bağlantıları Android'de doğrudan uygulamada açılır (assetlinks yayında).
- Not: Windows'un uzun dosya yolu sınırı yüzünden APK, proje `C:\vb\vopila-app` klasörüne kopyalanarak derlenir: `scripts\build-apk.ps1` (çıktı: `beta\VOPILA-beta-<sürüm>.apk`).

## Instagram / Trendyol modeli (2 Kasım 2026) ✅
- **Ayarlar** Instagram düzeninde: arama, Hesap Merkezi (şifre, e-posta, 2FA, Face ID, cihazlar, veriler, hesap silme),
  Hesap gizliliği, Ne göreceğin, Uygulaman ve medya, Aile merkezi, Alışveriş, Hakkında.
- **İçerik koruması**: arena girişleri hesap gizliliğine uyar (0033); web'de sağ tık/sürükle/video indir kapalı;
  imzalı dosya adresleri 30 dk; avatar dosya adları tahmin edilemez. Telefonda indirme yolu yok (Instagram gibi).
- **Mağaza** (0034): arama, sıralama, "bakiyeme uygun"/"stokta" filtreleri, favoriler, çoklu görsel galerisi,
  doğrulanmış alıcı yorumları (şikâyet edilebilir), stok rozetleri, son baktıkların, benzer ürünler, sipariş detayı
  (tarihli zaman çizelgesi, kargo takip bağlantısı, tahmini teslim), müşteri iptali (hazırlanırken), iade talebi
  (14 gün; yönetici onayıyla token iadesi), yönetimde iade ekranı ve çoklu ürün görseli.
- Bilerek eklenmeyenler: kupon, taksit, ödeme yöntemi, satıcı pazaryeri (token mağazasına uymaz).

## Instagram eksikleri — 2. tur ✅ (2 Kasım 2026)
- **Gönderi**: sonradan düzenleme (açıklama, konum, etiketler; "düzenlendi" yazar), profilde sabitleme (en fazla 3),
  yorumları kapatma, kalıcı silme (dosyalar da silinir) — 0035.
- **Yorum beğenme** (+ bildirim, günde bir kez) — 0035.
- **Kişi etiketleme**: paylaşırken ve düzenlerken; bahsetme iznine uyar, engelli etiketlenemez, en fazla 20;
  etiketlenen kişi kendini kaldırabilir ve yeniden etiketlenemez; profilde "Etiketlenenler" sekmesi — 0035/0035b-d.
- **Anlar**: kimler gördü listesi (yalnız sahibi), beğenenler işaretli; başkasının anına mesajla yanıt;
  görülen anların halkası soluk, görülmeyenler önde — 0035.
- **Arama geçmişi** (son aramalar; tek tek ya da tümden silme; telefonda, hesaba özel).
- **Mesajlar**: "yazıyor…" (gizli kanal, yalnız üyeler, engellide kapalı — 0036), çift dokunuşla kalp,
  uzun basınca "Gönderimi geri al" (dosya da silinir) — 0037.
- **Yazı boyutu** telefonun ayarını izler (en fazla 1,4 kat). → 3.5 tamamlandı.
- Yeni tablolar askı/hız sınırı korumalı, tarihler sunucuda yazılır (güvenlik incelemesi düzeltmeleri).

## Faz 5 — Hesap açmanız gerekenler (sizin kararınız)

| Hizmet | Ne sağlar | Maliyet | Not |
|---|---|---|---|
| **Expo hesabı** | Anlık bildirim (push), uygulamayı kurmadan güncelleme gönderme, bulutta derleme | Ücretsiz | Push için pratikte şart |
| **Apple Geliştirici** | iPhone uygulaması, TestFlight | 99 $/yıl | Google girişi varsa "Apple ile giriş" de zorunlu |
| **Google Play Geliştirici** | Play Store, kapalı test kanalı | 25 $ tek sefer | APK yerine Play üzerinden beta |
| **destek@vopila.com** | Yasal metinlerdeki iletişim adresi | Ücretsiz (Zoho Mail / yönlendirme) | Natro'ya MX kaydı |
| **Sentry** | Çökme ve hata takibi | Ücretsiz katman | Beta için çok faydalı |
| **SMS (Netgsm / İleti Merkezi)** | İlk oy ve ilk siparişte telefon doğrulama | Mesaj başı ücret | Hile önleme |
| **Claude API** | Haber özetleri | Kullanıma göre | İsteğe bağlı |
| **LiveKit** | Canlı yayın | Ücretsiz katman var | Büyük iş; yayından sonra olabilir |

Faz 5'ten sonra ben yaparım: push bildirimleri (cihaz anahtarı tablosu + sunucu tetikleyicisi + bildirim
ayarları gerçek olur), Sentry, Apple ile giriş, OTA güncelleme.

## Faz 6 — Yasal (avukat / muhasebeci)

- Yasal metinlerdeki boşluklar: şirket ünvanı, adres, MERSİS, KEP, sunucu ülkesi, yurt dışı aktarım güvencesi, yetkili mahkeme.
- Avukat onayı → "TASLAK" etiketi kalkar.
- VERBİS kaydı gerekiyor mu, 5651 temsilcisi ve trafik kayıtları.
- Ödül/çekiliş mevzuatı, ödüllerin vergisi, e-arşiv fatura (muhasebeci).
- Haber kaynaklarından yazılı izin.
- **e-Devlet ile yaş doğrulama — son tarih 31 Mart 2027.**
- Çocuk koruma sayfası ve güvenlik önlemlerinin web sitesinde yayınlanması.
- Otomatik görsel denetimi (AWS) — ertelendi; şimdilik şikayet + yönetici incelemesi.

## Faz 7 — Mağazaya çıkış

- Ayrı canlı Supabase projesi (Pro plan), test verisinden temiz.
- vopila.com'da web sitesi + uygulama bağlantıları (davet/profil linkleri doğrudan uygulamada açılsın).
- Sürüm numaraları, Play Integrity / App Attest, bağımsız güvenlik testi.
- Temel otomatik testler ve her değişiklikte kontrol (CI).
- Play Store ve App Store başvurusu.

---

## Önerilen sıra

1. **Faz 1 + Faz 2** (ben, hesap gerekmez) → testçiler temiz ve sağlam bir uygulama görür.
2. **Faz 4** (APK) → Android testçilere dağıtım.
3. **Expo hesabı** açılır → push bildirimleri (beta'da en çok eksikliği hissedilecek özellik).
4. **Faz 3** ayar tamamlamaları.
5. Paralelde siz: Apple/Google hesapları, destek@ e-postası, avukat görüşmesi.
