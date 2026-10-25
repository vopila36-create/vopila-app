# VOPILA — Supabase Arka Ucu

Bu klasör, uygulamanın sunucu tarafını (veritabanı tabloları, güvenlik kuralları, dosya depolama) içerir.
Şimdilik uygulama verileri telefonda tutuyor; bu şema yüklendiğinde herkes aynı verileri görecek.

## Tablolar ne işe yarar?

| Tablo | Ne tutar |
|---|---|
| `profiles` | Kullanıcı profili (ad, kullanıcı adı, biyografi, fotoğraf, gizli hesap, keşif puanı). Google ile ilk girişte otomatik oluşur. |
| `follows` | Kim kimi takip ediyor. Listeler `get_followers` / `get_following` ile gelir; gizli hesapta yalnızca sahibi ve takipçileri görür. |
| `posts`, `post_media` | Gönderiler ve fotoğraf/video dosyaları (en fazla 5 medya). |
| `likes`, `saves`, `comments` | Beğeniler, kaydedilenler (yalnızca sahibine görünür), yorumlar. |
| `moments`, `moment_items` | 24 saat sonra kaybolan "Anlar" (hikâyeler). |
| `arenas`, `arena_members`, `arena_seasons` | Arena kategorileri, katılımcılar ve haftalık sezonlar. |
| `arena_entries`, `arena_votes` | Yarışmaya gönderilen gönderiler ve 1-5 yıldız oylar. Tek tek oylar gizli, toplamlar herkese açık. |
| `arena_rankings` (görünüm) | Sıralama: en az 20 oyu olanlar önde, ortalama puana göre. |
| `badges`, `user_badges` | Rozetler. Kazanılan rozetler herkese açık. |
| `token_ledger`, `my_token_balance` | Her token hareketi (ödül +, harcama −). Bakiye bunların toplamı. Uygulama bu tabloya **yazamaz**. |
| `products`, `orders`, `order_items` | Mağaza ürünleri ve siparişler (adres dahil). Sipariş yalnızca `place_order` ile verilir. |
| `news_articles`, `live_updates` | Haberler ve canlı gelişmeler. |
| `live_streams` | Canlı yayınlar (LiveKit bağlanınca yönetilecek; şimdilik yayın talebi). |
| `notifications` | Bildirimler (takip, beğeni, yorum, token) — sistem otomatik oluşturur. |

**Önemli fonksiyonlar**

- `vote_entry(entry_id, score)` — oy verir. Kurallar sunucuda: kendi gönderine oy yok, her gönderiye tek oy, sezon açık olmalı, hesap en az 3 günlük olmalı.
- `place_order(items, address)` — tek işlemde stok + bakiye kontrolü, sipariş kaydı, token düşümü.
- `private.settle_season(...)` / `private.settle_due_seasons()` — sezon bitince ilk 3'e token ödülü yazar, yeni sezonu açar. **Uygulama çağıramaz**, yalnızca zamanlanmış görev (pg_cron) çalıştırır.
- `my_profile_impact(days)` — Profil Etkisi; herkes yalnızca kendi istatistiğini alır.

## Şemayı yükleme

1. Supabase panelinde projeyi aç → **SQL Editor** → **New query**.
2. `migrations/0001_init.sql` dosyasının tamamını yapıştır → **Run**. Ardından aynı şekilde `migrations/0002_private_media.sql` dosyasını çalıştır (gönderi dosyalarını gizli yapar).
3. (İsteğe bağlı) **Database → Extensions** bölümünden `pg_cron`'u aç ve dosyanın sonundaki
   `cron.schedule(...)` satırını yorumdan çıkarıp çalıştır (sezonlar otomatik kapanır).

Dosya tekrar çalıştırılabilir; ikinci kez çalıştırmak veri silmez.

## Google ile giriş ayarları

**Authentication → URL Configuration → Redirect URLs** bölümüne şunları ekle:

```
exp://192.168.8.127:8082/--/auth-callback
vopila://auth-callback
http://localhost:8082/auth-callback
```

- Birincisi telefonda Expo Go ile deneme içindir (bilgisayarın Wi-Fi adresi değişirse güncellenmeli).
- İkincisi mağazaya çıkan gerçek uygulama içindir.
- Üçüncüsü bilgisayar tarayıcısında deneme içindir.

**Authentication → Sign In / Providers → Google**: Google Cloud'dan alınan *Web* Client ID ve Client Secret buraya girilir.
Google Cloud'daki Web istemcisinin **Authorized redirect URIs** kısmına Supabase'in gösterdiği adres eklenir:
`https://<proje-ref>.supabase.co/auth/v1/callback`

## Uygulamaya bağlama

`vopila-app/.env.example` dosyasını `.env` adıyla kopyala ve doldur:

```
EXPO_PUBLIC_SUPABASE_URL=https://<proje-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`service_role` / secret anahtarı **asla** uygulamaya ya da `.env` dosyasına yazılmaz.


## Gizli hesap ve takip istekleri

- Gizli hesabı takip etmek `follows.status = 'pending'` (istek) olarak kaydedilir; durumu veritabanı tetikleyicisi belirler, uygulama değiştiremez.
- Yalnızca takip edilen kişi isteği onaylayabilir (`pending → accepted`) ya da satırı silerek reddedebilir.
- Listeler, sayılar ve gizli hesabın içeriği yalnızca `accepted` takipleri sayar.
- Hesap gizliden açığa geçince bekleyen istekler otomatik kabul edilir.
- **Yapılacak (ekranlar bağlanırken):** `/takip-istekleri` ekranı (bildirim bu adrese yönlendirir) ve profilde "İstek gönderildi" durumu.
