# VOPILA — İçerik Denetimi Yol Haritası

> 28 Ekim 2026. Referans: TikTok ve Instagram'ın katmanlı denetim modeli. Bu dosyada anahtar / şifre yok.

## Bugün çalışanlar (bitti)
- [x] **Metin filtresi:** yorum, açıklama, mesaj, profil adı ve biyografide küfür / hakaret / cinsel ifade / tehdit içeren yazı gönderilemez. Hileli yazımlar ("s1kt1r", "SİİİKTİR") yakalanır; "seksen", "sıkıntı", "analiz" gibi masum kelimeler engellenmez. Liste veritabanında (`private.banned_terms`), genişletilebilir.
- [x] **Hassas içerik** (Instagram modeli): paylaşan işaretler veya yönetici işaretler → yetişkinlere örtülü, 18 altına hiç gösterilmez.
- [x] **Şikâyet eşiği:** 2 farklı kişinin şikâyet ettiği gönderi, inceleme bitene kadar 18 altına gösterilmez.
- [x] **İhlal basamakları** (Meta modeli, 1 yıl sayılır): uyarı → 1 gün → 3 gün → 7 gün → 30 gün → hesap kapatma. Ağır ihlal (çocuk güvenliği, terör) → doğrudan kapatma. Hesap durumu ekranı, itiraz Destek'ten.
- [x] Gönderi sahibi kendi gönderisindeki her yorumu silebilir ya da şikâyet edebilir (yorum izni ayarı kaldırıldı).

## TikTok nasıl yapıyor (özet)
1. **Yüklerken otomatik tarama:** içerik yayılmadan önce görüntü ve ses yapay zekâ ile taranır. Çıplaklık, şiddet, reşit olmayan güvenliği gibi ihlaller kesinse otomatik kaldırılır; kullanıcı insana itiraz edebilir.
2. **Belirsizse insan incelemesi:** otomatik sistemin emin olmadığı içerik ve belli sayıda şikâyet alan içerik moderatör kuyruğuna düşer.
3. **Yayılma kontrolü:** yeni video önce küçük bir kitleye gösterilir; şikâyet/sinyal yoksa genişler.
4. **Canlı yayın:** yayın sırasında görüntü kareleri ve ses sürekli örneklenir; ağır ihlalde yayın anında kesilir. Yaş sınırı ve geçmiş ihlali olan hesaplar yayın açamaz.

## VOPILA için plan

### Aşama A — Fotoğraf: pornografi yüklenemesin (öncelik 1)
- Fotoğraf yüklenince sunucuda (Supabase Edge Function) bir **görüntü denetim servisine** gönderilir.
- Sonuç: çıplaklık/pornografi **kesin** → yükleme reddedilir ("Bu görsel yüklenemez"). **Şüpheli** → gönderi yayımlanır ama 18 altına kapalı ve yönetici kuyruğuna düşer. Kan/yara → otomatik "hassas".
- Servis seçenekleri (hepsi kullanım başına ücretli, aylık sabit ücret yok):
  - **AWS Rekognition Content Moderation:** görsel başına yaklaşık 0,001 $, video dakikası yaklaşık 0,10 $. Çıplaklık, şiddet, kan, nefret sembolleri.
  - **Google Cloud Vision SafeSearch:** görsel başına yaklaşık 0,0015 $ (ayda ilk 1.000 ücretsiz). Video için ayrı servis.
  - **Sightengine / Hive:** sosyal ağlara özel; görsel + video + canlı yayın + metin tek yerde; fiyat paket bazlı.
- Öneri: başlangıçta **AWS Rekognition** (ucuz, video ve canlı yayınla aynı servis). Hesap açılması ve anahtar gerekir.

### Aşama B — Video
- Yüklenen video sunucuda saniyede 1 kare örneklenir → aynı servisle taranır; ses metne çevrilip (konuşma tanıma) metin filtresinden geçirilir.
- Tarama bitene kadar video "işleniyor" görünür (TikTok gibi), sonra yayımlanır ya da reddedilir.

### Aşama C — Canlı yayın (LiveKit ile)
- Yayın açma şartı: 18+, e-Devlet ile doğrulanmış, son 90 günde ihlali olmayan hesap.
- Yayın sırasında birkaç saniyede bir kare + canlı konuşma tanıma → ağır ihlalde **yayın otomatik kesilir**, hesaba ihlal yazılır; şüphelide yöneticiye anlık uyarı.
- Canlı yorumlara metin filtresi zaten uygulanır.

### Aşama D — Ölçek
- **Çocuk istismarı görüntüsü eşleştirme** (bilinen görüntü özetleriyle karşılaştırma, ör. Microsoft PhotoDNA / Thorn Safer): yayından önce başvuru.
- Moderatör paneli: otomatik sistemin işaretlediği içerikler, öncelik sırası, tek tıkla karar.
- Şeffaflık raporu: yılda bir, kaldırılan içerik ve itiraz sayıları (Yönetmelik md. 10 ile birlikte).

## Karar bekleyen
- [ ] Görüntü denetim servisi seçimi (öneri: AWS Rekognition) ve hesabın açılması
- [ ] Moderatör ekibi: ilk aşamada yönetici, büyüyünce yarı zamanlı moderatör
