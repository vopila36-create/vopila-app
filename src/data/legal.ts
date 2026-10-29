/**
 * Yasal metinler — TASLAK. Yayından önce hukukçu tarafından gözden geçirilmeli.
 * [KÖŞELİ PARANTEZ] içindeki bilgiler şirket kurulunca doldurulacak.
 */

export type LegalDoc = {
  key: string;
  title: string;
  updated: string;
  intro?: string;
  sections: { h: string; p: string[] }[];
};

/** true iken metinlerin üstünde "taslak" uyarısı görünür. Hukukçu onayından sonra false yapılır. */
export const LEGAL_DRAFT = true;

const CONTROLLER = '[ŞİRKET ÜNVANI], [ADRES], MERSİS No: [MERSİS], KEP: [KEP ADRESİ]';
// Not: bu adres için gelen kutusu henüz yok (yayından önce açılmalı)
const CONTACT = 'destek@vopila.com';

export const LEGAL_DOCS: LegalDoc[] = [
  {
    key: 'aydinlatma',
    title: 'Aydınlatma Metni ve Gizlilik Politikası',
    updated: '28 Ekim 2026',
    intro:
      '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) md. 10 uyarınca, VOPILA uygulamasını kullanırken kişisel verilerinin nasıl işlendiğini açıklarız.',
    sections: [
      { h: '1. Veri sorumlusu', p: [`Veri sorumlusu: ${CONTROLLER}. İletişim: ${CONTACT}.`] },
      {
        h: '2. İşlediğimiz veriler',
        p: [
          'Kimlik ve hesap: ad soyad, kullanıcı adı, profil fotoğrafı, biyografi, yazdığın konum bilgisi.',
          'İletişim: e-posta adresi; sipariş verirsen telefon numarası ve teslimat adresi.',
          'Yaş grubu: doğum tarihin SAKLANMAZ. Yalnızca yaş grubun (15–18 / 18+) ve yaş grubunun değişeceği ay tutulur. e-Devlet doğrulamasında yalnızca 15 ve 18 yaşından büyük olup olmadığın bildirilir; adın, T.C. kimlik numaran ve doğum tarihin bize iletilmez.',
          'İçerik: paylaştığın fotoğraf, video, yorum, an, mesaj, arena katılımı ve oyların.',
          'Etkileşim: beğeni, kaydetme, takip, ilgi alanların (hangi konulara ne kadar baktığın — öneriler için).',
          'İşlem güvenliği: oturum kayıtları, iki adımlı doğrulama bilgisi, hile ve kötüye kullanım tespiti kayıtları.',
          'Cüzdan ve siparişler: token hareketleri, sipariş ve kargo bilgileri.',
          'Kullanım süresi bilgisi yalnızca kendi telefonunda tutulur, sunucuya gönderilmez.',
        ],
      },
      {
        h: '3. Amaçlar ve hukuki sebepler',
        p: [
          'Hesabını açmak, hizmeti sunmak, arena yarışmalarını yürütmek, ödülleri ve siparişleri teslim etmek — sözleşmenin kurulması ve ifası (KVKK md. 5/2-c).',
          'Yaş doğrulama, 15 yaş altına hizmet vermeme ve 15–18 yaş korumaları, yetkili mercilerin taleplerinin karşılanması, fatura ve kayıt saklama — hukuki yükümlülük (KVKK md. 5/2-ç; 5651 sayılı Kanun, Sosyal Ağ Sağlayıcılarda Yaş Doğrulama Yönetmeliği, vergi mevzuatı).',
          'Güvenlik, hile tespiti, öneri ve sıralama algoritmaları — meşru menfaat (KVKK md. 5/2-f). 18 yaş altı kullanıcılara profil çıkarımına dayalı reklam gösterilmez.',
          'Hukuken açık rıza gereken bir işlem olursa ayrıca onayın istenir.',
        ],
      },
      {
        h: '4. Aktarım',
        p: [
          'Verilerin satılmaz. Yalnızca hizmet için gerekli olduğu kadar şu taraflarla paylaşılır: altyapı sağlayıcımız (veritabanı ve dosya barındırma: Supabase — sunucu konumu: [ÜLKE]), e-posta gönderim hizmeti (Resend), anlaşmalı kargo firması (yalnızca sipariş teslimi için ad, telefon, adres), kanunen yetkili kamu kurumları.',
          'Yurt dışındaki hizmet sağlayıcılara aktarım KVKK md. 9 kapsamında [standart sözleşme / ilgili güvence] ile yapılır.',
        ],
      },
      {
        h: '5. Saklama süreleri',
        p: [
          'Hesap verileri hesabın açık olduğu sürece saklanır. Hesabını sildiğinde profilin, içeriklerin ve mesajların silinir.',
          'Sipariş ve fatura kayıtları vergi mevzuatı gereği yasal süre boyunca kimliksizleştirilerek saklanır.',
          'Otomatik haberler 7 gün sonra silinir. Yaş itirazı süren hesapların verileri itiraz sonuçlanana kadar silinmez.',
          '5651 sayılı Kanun kapsamındaki trafik bilgileri mevzuatta belirtilen süre boyunca saklanır.',
        ],
      },
      {
        h: '6. Hakların (KVKK md. 11)',
        p: [
          'Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı kişileri bilme, düzeltilmesini, silinmesini ya da yok edilmesini isteme, itiraz etme ve zararın giderilmesini talep etme hakların vardır.',
          'Verilerinin kopyasını Ayarlar > Verilerimi indir, hesabını Ayarlar > Hesabı sil ile kendin alabilir / silebilirsin.',
          `Diğer talepler için ${CONTACT} adresine ya da ${CONTROLLER} adresine yazılı başvurabilirsin. Başvurular en geç 30 gün içinde ücretsiz yanıtlanır.`,
        ],
      },
    ],
  },
  {
    key: 'kosullar',
    title: 'Kullanım Koşulları',
    updated: '28 Ekim 2026',
    intro: `Bu koşullar VOPILA uygulamasını kullanman için ${CONTROLLER} ile arandaki sözleşmedir.`,
    sections: [
      {
        h: '1. Kimler kullanabilir',
        p: [
          '15 yaşını doldurmamış kişiler VOPILA’yı kullanamaz (5651 sayılı Kanun ek md. 4). 15–18 yaş arasındaki kullanıcılar için ek korumalar uygulanır; ayrıntılar “Çocukları Koruma Önlemleri” sayfasındadır.',
          'Doğum tarihini doğru beyan etmelisin. Yanlış beyan tespit edilirse hesabın askıya alınabilir veya kapatılabilir; itiraz hakkın saklıdır.',
        ],
      },
      {
        h: '2. Hesabın',
        p: [
          'Hesabının güvenliğinden sen sorumlusun. İki adımlı doğrulamayı açmanı öneririz.',
          'Başkası adına hesap açamaz, hesabını devredemez ya da satamazsın. Bir telefon numarası yalnızca bir hesapta arena ve sipariş doğrulaması için kullanılabilir.',
        ],
      },
      {
        h: '3. İçeriklerin',
        p: [
          'Paylaştığın içeriklerin hakları sende kalır. VOPILA’ya, içeriği uygulamada göstermek, arenalarda yarıştırmak ve tanıtmak için dünya çapında, ücretsiz, devredilemez bir kullanım izni verirsin; içeriği sildiğinde izin sona erer.',
          'Telif hakkı sana ait olmayan, başkasının kişilik haklarını ihlal eden, nefret söylemi, taciz, şiddet, müstehcenlik veya yasa dışı içerik paylaşamazsın. Bu içerikler kaldırılır; tekrarında hesap askıya alınır ya da kapatılır.',
          'Yapay zekâ ile üretilmiş içerikleri bu şekilde belirtmelisin.',
        ],
      },
      {
        h: '4. Arenalar, token ve ödüller',
        p: [
          'Arena sezonları her ayın 1’inde başlar, ayın son günü saat 24:00’te (Türkiye saati) biter; ilk üç sıra ilan edilir ve ödüller verilir.',
          'Token yalnızca arena yarışmalarında kazanılır; para ile satın alınamaz, nakde çevrilemez, devredilemez. Tokenlar yalnızca VOPILA Mağazası’ndaki ürünler için kullanılabilir.',
          'Sahte hesap, oy alışverişi, otomatik araç kullanımı gibi hileler tespit edilirse oylar, tokenlar ve ödüller iptal edilir. Şüpheli ödüller yönetici incelemesine alınır.',
          '[Ödül ve promosyon mevzuatı (vergi, çekiliş izni) hukukçu ve muhasebeci görüşüne göre tamamlanacak.]',
        ],
      },
      {
        h: '5. Mağaza ve teslimat',
        p: [
          'Ürünler stokla sınırlıdır. Siparişin “Hazırlanıyor” aşamasındayken iptal edilirse tokenların iade edilir.',
          'Teslimat anlaşmalı kargo firmasıyla yapılır. Hatalı ya da eksik adres nedeniyle teslim edilemeyen siparişlerden VOPILA sorumlu değildir.',
        ],
      },
      {
        h: '6. Haberler',
        p: [
          'Haberler sekmesindeki otomatik haberler, kaynakların herkese açık haber akışlarından alınan başlık ve kısa özetlerden oluşur; haberin tamamı kaynağın sitesinde okunur ve tüm hakları kaynağa aittir.',
        ],
      },
      {
        h: '7. Hizmetin değişmesi ve sona ermesi',
        p: [
          'Koşulları değiştirebiliriz; önemli değişiklikleri uygulama içinden önceden duyururuz.',
          'Bu koşulları ihlal eden hesapları askıya alabilir veya kapatabiliriz. Hesabını dilediğin zaman Ayarlar > Hesabı sil ile kapatabilirsin.',
        ],
      },
      {
        h: '8. Uygulanacak hukuk',
        p: ['Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Uyuşmazlıklarda [İL] mahkemeleri ve icra daireleri yetkilidir; tüketici hakların saklıdır.'],
      },
    ],
  },
  {
    key: 'cocuk-koruma',
    title: 'Çocukları Koruma Önlemleri',
    updated: '28 Ekim 2026',
    intro:
      'Sosyal Ağ Sağlayıcılarda Yaş Doğrulama Yönetmeliği (yürürlük: 1 Kasım 2026) md. 8/6 uyarınca 15–18 yaş kullanıcılar için aldığımız önlemler.',
    sections: [
      {
        h: '15 yaş sınırı',
        p: [
          '15 yaşını doldurmamış kişilere hesap açılmaz. Bu yaşta olduğu anlaşılan hesaplar, kullanıcı bilgilendirilerek kapatılır.',
          'Yaş grubuna itiraz ücretsizdir, Türkçe yapılır ve bir kişi tarafından incelenir (Ayarlar > Yardım > Yaş itirazı). İtiraz sonuçlanana kadar veriler silinmez.',
          'Mevcut hesapların yaşı en geç 31 Mart 2027’ye kadar e-Devlet yaş belirteciyle doğrulanır.',
        ],
      },
      {
        h: '15–18 yaş korumaları',
        p: [
          'Hesap gizli açılır; herkese açık yapmak yalnızca bir seçenektir.',
          'Takipçi ve takip listesi yalnızca kullanıcının kendisine görünür.',
          'Yalnızca kullanıcının takip ettiği hesaplar ona mesaj gönderebilir; mesajlarda “görüldü” bilgisi gösterilmez.',
          'Hesap başkalarına önerilmez ve aramada yalnızca takip ilişkisi olanlara görünür.',
          'Fotoğraf, video ve anlarında başkalarının ekran görüntüsü alması teknik olarak engellenir.',
          'Videolar kendiliğinden oynamaz; dikey akışlarda sonsuz kaydırma yoktur.',
          'Canlı yayın açılamaz, profil çıkarımına dayalı kişisel reklam gösterilmez, rehber eşleştirmesi yapılmaz.',
        ],
      },
      {
        h: 'Ebeveyn denetimi',
        p: [
          'Ebeveyn, çocuğunun ürettiği tek kullanımlık kodla hesabı bağlar; günlük süre sınırı koyabilir, hesabın gizli kalmasını ve yalnızca takip edilenlerin yorum yapmasını sağlayabilir.',
          'Çocuk, denetimi ebeveyninin onayı olmadan kaldıramaz. 18 yaş dolduğunda denetim kendiliğinden sona erer.',
        ],
      },
      {
        h: 'İtiraz istatistikleri',
        p: ['Yaş itirazlarına ilişkin yıllık istatistikler her yıl bu sayfada yayımlanır. [İlk yayın: 2027]'],
      },
    ],
  },
  {
    key: 'telif',
    title: 'Telif ve İçerik Bildirimi',
    updated: '28 Ekim 2026',
    sections: [
      {
        h: 'Hakkını ihlal eden bir içerik mi gördün?',
        p: [
          'İçerikteki “…” menüsünden “Şikayet et”i seçebilir ya da Ayarlar > Yardım üzerinden bize yazabilirsin.',
          `Telif hakkı veya kişilik hakkı ihlali bildirimlerini ${CONTACT} adresine; hak sahibi olduğunu gösteren bilgi, içeriğin bağlantısı ve iletişim bilgilerinle gönder. 5651 sayılı Kanun kapsamındaki bildirimler en geç 24 saat içinde değerlendirilir.`,
        ],
      },
      {
        h: 'Haber kaynakları',
        p: [
          'Haberler sekmesinde TRT Haber, BBC Türkçe, DW Türkçe, CNN Türk, Habertürk ve Sözcü’nün herkese açık haber akışlarından yalnızca başlık, kısa özet ve görsel gösterilir; haberin tamamı kaynağın sitesinde açılır. Kaynak kuruluşlar içeriklerinin kaldırılmasını istediğinde hemen kaldırılır.',
        ],
      },
    ],
  },
];

export const legalDoc = (key: string) => LEGAL_DOCS.find((d) => d.key === key);
