/**
 * Örnek (demo) veriler. 2. aşamada Supabase veritabanından gelen gerçek verilerle değiştirilecek.
 * Ekranlar bu dosyadaki tiplere göre yazıldı; veritabanı da aynı alanları taşıyacak.
 */

const u = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

export const img = {
  mountain: u('1506905925346-21bda4d32df4'),
  mountain2: u('1464822759023-fed622ff2c3b'),
  lake: u('1501785888041-af3ef285b470'),
  forest: u('1441974231531-c6227db76b6e'),
  diver: u('1544551763-46a013bb70d5'),
  aurora: u('1531366936337-7c912a4589a7'),
  balloon: u('1507608616759-54f48f0af0ee'),
  earth: u('1446776811953-b23d57bd21aa', 1200),
  galaxy: u('1462331940025-496dfbfc7564'),
  car: u('1503376780353-7e6692767b70'),
  car2: u('1492144534655-ae79c964c9d7'),
  food: u('1504674900247-0877df9cc836'),
  food2: u('1546069901-ba9599a7e63c'),
  dog: u('1587300003388-59208cc962cb'),
  sofa: u('1555041469-a586c61ea9bc'),
  jacket: u('1551028719-00167b16eac5'),
  art: u('1541961017774-22349e4a1262'),
  ocean: u('1518837695005-2083093ee35b', 1200),
  stocks: u('1611974789855-9c2a0a7236a3'),
  tech: u('1451187580459-43490279c0fa'),
  football: u('1574629810360-7efbbe195018'),
  satellite: u('1446776653964-20c1d3a81b06'),
  nature: u('1469474968028-56623f02e42e'),
  sail: u('1540979388789-6cee28a1cdc9'),
  whale: u('1559827260-dc66d52bef19', 1200),
  house: u('1568605114967-8130f3a36994'),
  sport: u('1517649763962-0c623066013b'),
  surf: u('1502680390469-be75c86b636f'),
};

/** Örnek kısa videolar (gerçek videolar kullanıcı yüklemelerinden gelecek). */
export const videos = {
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  jellyfish: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  sample10: 'https://download.samplelib.com/mp4/sample-10s.mp4',
  sample15: 'https://download.samplelib.com/mp4/sample-15s.mp4',
};

const face = (id: string) => u(id, 200);

// ─── Kullanıcılar ──────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  verified: boolean;
  bio: string;
  location: string;
  cover: string;
  followers: number;
  following: number;
  discoveryPoints: number;
};

/** Giriş yapmış kullanıcının kimliği. */
export const ME_ID = 'me';

export const users: User[] = [
  {
    id: ME_ID,
    name: 'Kerem Taş',
    username: 'keremtas',
    avatar: face('1500648767791-00dcc994a43e'),
    verified: true,
    bio: 'Doğayı, yeni yerleri ve ilham veren insanları keşfetmek için buradayım.',
    location: 'İstanbul, Türkiye',
    cover: img.mountain2,
    followers: 3100,
    following: 420,
    discoveryPoints: 12400,
  },
  {
    id: 'u_soner',
    name: 'Kerem Soner',
    username: 'keremsoner',
    avatar: face('1472099645785-5658abf4ff4e'),
    verified: true,
    bio: 'Kuzey ışıklarının peşinde bir fotoğrafçı.',
    location: 'Oslo, Norveç',
    cover: img.mountain,
    followers: 48200,
    following: 312,
    discoveryPoints: 31800,
  },
  {
    id: 'u_deniz',
    name: 'Deniz Aktaş',
    username: 'denizaktas',
    avatar: face('1507003211169-0a1dd7228f2d'),
    verified: true,
    bio: 'Serbest dalış eğitmeni. Okyanus benim evim.',
    location: 'Bodrum, Türkiye',
    cover: img.ocean,
    followers: 27400,
    following: 198,
    discoveryPoints: 21000,
  },
  {
    id: 'u_ayse',
    name: 'Ayşe Demir',
    username: 'aysedemir',
    avatar: face('1494790108377-be9c29b29330'),
    verified: false,
    bio: 'Otomobil tutkunu, pist günlerinin müdavimi.',
    location: 'İzmir, Türkiye',
    cover: img.car2,
    followers: 9800,
    following: 540,
    discoveryPoints: 18900,
  },
  {
    id: 'u_ece',
    name: 'Ece Yıldız',
    username: 'eceyildiz',
    avatar: face('1438761681033-6461ffad8d80'),
    verified: false,
    bio: 'Gökyüzünü seven bir gezgin. Kapadokya aşığı.',
    location: 'Nevşehir, Türkiye',
    cover: img.balloon,
    followers: 6400,
    following: 610,
    discoveryPoints: 9600,
  },
  {
    id: 'u_can',
    name: 'Can Polat',
    username: 'canpolat',
    avatar: face('1535713875002-d1d0cf377fde'),
    verified: false,
    bio: 'Mutfakta deneyler, sokakta lezzet avı.',
    location: 'Ankara, Türkiye',
    cover: img.food,
    followers: 5200,
    following: 380,
    discoveryPoints: 11200,
  },
  {
    id: 'u_selin',
    name: 'Selin Kaya',
    username: 'selinkaya',
    avatar: face('1544005313-94ddf0286df2'),
    verified: true,
    bio: 'İç mimar. Sade ve sıcak mekânlar.',
    location: 'İstanbul, Türkiye',
    cover: img.sofa,
    followers: 15300,
    following: 260,
    discoveryPoints: 14100,
  },
  {
    id: 'u_emre',
    name: 'Emre Arslan',
    username: 'emrearslan',
    avatar: face('1568602471122-7832951cc4c5'),
    verified: false,
    bio: 'Patili dostlar ve uzun yürüyüşler.',
    location: 'Eskişehir, Türkiye',
    cover: img.dog,
    followers: 3900,
    following: 450,
    discoveryPoints: 7800,
  },
];

export const userById = (id: string) => users.find((x) => x.id === id) ?? users[0];

/** Giriş yapan kullanıcıyı takip eden kişiler (2. aşamada veritabanından gelecek). */
export const myFollowerIds = ['u_soner', 'u_ayse', 'u_selin', 'u_emre', 'u_can'];

/** Gizli hesaplar: takipçi/takip listelerini yalnızca kendisi ve takipçileri görebilir. */
export const privateUserIds = ['u_emre'];

const otherIds = (id: string) => users.filter((u) => u.id !== id && u.id !== ME_ID).map((u) => u.id);
const indexOf = (id: string) => users.findIndex((u) => u.id === id);

/** Bir kullanıcının takipçileri (ben hariç — beni ekran, takip durumuma göre ekler). Demo veri. */
export const followerIdsOf = (id: string) =>
  id === ME_ID ? myFollowerIds : otherIds(id).filter((o) => (indexOf(o) + indexOf(id)) % 2 === 0);

/** Bir kullanıcının takip ettikleri (ben dahil, eğer beni takip ediyorsa). Demo veri. */
export const followingIdsOf = (id: string) => [
  ...otherIds(id).filter((o) => (indexOf(o) + indexOf(id)) % 3 !== 1),
  ...(myFollowerIds.includes(id) ? [ME_ID] : []),
];

// ─── Gönderiler ────────────────────────────────────────────────────────────

export type Media = { type: 'image' | 'video'; uri: string; poster?: string };

export type Comment = { id: string; authorId: string; text: string; time: string };

export type Post = {
  id: string;
  authorId: string;
  location: string;
  time: string;
  media: Media[];
  caption: string;
  likes: number;
  comments: Comment[];
  arenaKey?: ArenaKey;
};

export const posts: Post[] = [
  {
    id: 'p1',
    authorId: 'u_soner',
    location: 'Lofoten, Norveç',
    time: '3 saat önce',
    media: [
      { type: 'image', uri: img.mountain },
      { type: 'image', uri: img.aurora },
      { type: 'image', uri: img.lake },
      { type: 'image', uri: img.forest },
      { type: 'image', uri: img.nature },
    ],
    caption:
      'Kuzeyin büyüsü her zaman insanı başka bir yere götürüyor. Doğa, insana kendini yeniden hatırlatıyor.',
    likes: 2400,
    comments: [
      { id: 'c1', authorId: 'u_ece', text: 'Bu manzara inanılmaz 😍', time: '2 sa' },
      { id: 'c2', authorId: 'u_deniz', text: 'Lofoten listemde bir numara!', time: '1 sa' },
    ],
    arenaKey: 'doga',
  },
  {
    id: 'p2',
    authorId: 'u_deniz',
    location: 'Baja California, Meksika',
    time: '1 gün önce',
    media: [{ type: 'video', uri: videos.jellyfish, poster: img.whale }],
    caption: 'Okyanusun devleriyle aynı suda yüzmek… Kelimelerle anlatılamaz.',
    likes: 5100,
    comments: [{ id: 'c3', authorId: 'u_soner', text: 'Efsane kareler 🌊', time: '20 sa' }],
  },
  {
    id: 'p3',
    authorId: 'u_ece',
    location: 'Kapadokya, Türkiye',
    time: '2 gün önce',
    media: [{ type: 'image', uri: img.balloon }],
    caption: 'Gün doğarken yüzlerce balon ve tek bir sessizlik.',
    likes: 3800,
    comments: [],
  },
  {
    id: 'p4',
    authorId: 'u_ayse',
    location: 'İstanbul Park, Türkiye',
    time: '3 gün önce',
    media: [{ type: 'image', uri: img.car2 }],
    caption: 'Pist günü! Sabahın ilk turu her zaman en güzeli.',
    likes: 1900,
    comments: [],
    arenaKey: 'otomobil',
  },
  {
    id: 'p5',
    authorId: 'u_can',
    location: 'Ankara, Türkiye',
    time: '4 gün önce',
    media: [{ type: 'image', uri: img.food2 }],
    caption: 'Hafta sonu kahvaltısına renkli bir dokunuş.',
    likes: 1200,
    comments: [],
    arenaKey: 'yemek',
  },
  // Giriş yapan kullanıcının (Kerem Taş) eski paylaşımları
  { id: 'm1', authorId: ME_ID, location: 'Kaçkar, Türkiye', time: '1 hafta önce', media: [{ type: 'image', uri: img.mountain }], caption: 'Zirveye giden yol.', likes: 12400, comments: [] },
  { id: 'm2', authorId: ME_ID, location: 'Kaş, Türkiye', time: '2 hafta önce', media: [{ type: 'video', uri: videos.flower, poster: img.diver }], caption: 'Mavi derinlikler.', likes: 8100, comments: [] },
  { id: 'm3', authorId: ME_ID, location: 'İstanbul, Türkiye', time: '3 hafta önce', media: [{ type: 'image', uri: img.car }], caption: 'Gece sürüşü.', likes: 15200, comments: [], arenaKey: 'otomobil' },
  { id: 'm4', authorId: ME_ID, location: 'Abisko, İsveç', time: '1 ay önce', media: [{ type: 'image', uri: img.aurora }], caption: 'Gökyüzü dans ederken.', likes: 9700, comments: [] },
  { id: 'm5', authorId: ME_ID, location: 'Gaziantep, Türkiye', time: '1 ay önce', media: [{ type: 'image', uri: img.food }], caption: 'Lezzet durağı.', likes: 6800, comments: [], arenaKey: 'yemek' },
  { id: 'm6', authorId: ME_ID, location: 'Sapanca, Türkiye', time: '2 ay önce', media: [{ type: 'image', uri: img.dog }], caption: 'Patili yol arkadaşım.', likes: 11300, comments: [] },
];

// ─── Anlar (hikâyeler) ──────────────────────────────────────────────────────

export type Moment = { id: string; authorId: string; title: string; items: string[] };

export const moments: Moment[] = [
  { id: 's1', authorId: 'u_soner', title: 'Zirve Yolculuğu', items: [img.mountain2, img.mountain, img.lake, img.forest] },
  { id: 's2', authorId: 'u_deniz', title: 'Sualtı Dünyası', items: [img.diver, img.ocean] },
  { id: 's3', authorId: 'u_can', title: 'Kuzeyin Işıkları', items: [img.aurora, img.galaxy, img.nature] },
  { id: 's4', authorId: 'u_ece', title: 'Gökyüzü Rotaları', items: [img.balloon, img.sail, img.surf] },
  { id: 's5', authorId: 'u_emre', title: 'Keşif Rotaları', items: [img.nature, img.dog, img.forest] },
];

// ─── Arenalar ───────────────────────────────────────────────────────────────

export type ArenaKey = 'yemek' | 'dekorasyon' | 'otomobil' | 'kombin' | 'doga' | 'evcil' | 'sanat';

export type Arena = {
  key: ArenaKey;
  name: string;
  image: string;
  tagline: string;
  description: string;
  members: number;
  /** Sezonun bitmesine kalan süre (demo için metin). */
  endsIn: string;
  /** 1., 2. ve 3. olana verilecek token ödülleri. */
  prizes: [number, number, number];
};

export const arenas: Arena[] = [
  { key: 'yemek', name: 'Yemek', image: img.food2, tagline: 'Lezzet avcılarının sahnesi.', description: 'En iştah açıcı tabağını paylaş, topluluk puanlasın.', members: 12300, endsIn: '3 gün 4 saat', prizes: [500, 300, 150] },
  { key: 'dekorasyon', name: 'Dekorasyon', image: img.sofa, tagline: 'Yaşam alanlarına ilham.', description: 'Evinin en güzel köşesini göster.', members: 6100, endsIn: '5 gün', prizes: [400, 250, 100] },
  { key: 'otomobil', name: 'Otomobil', image: img.car, tagline: 'Motor tutkunlarının buluşma noktası.', description: 'Aracının en iyi karesini paylaş.', members: 8400, endsIn: '2 gün 11 saat', prizes: [600, 350, 200] },
  { key: 'kombin', name: 'Kombin', image: img.jacket, tagline: 'Tarzını konuştur.', description: 'Günün kombinini paylaş, stil puanını topla.', members: 9700, endsIn: '4 gün', prizes: [450, 250, 120] },
  { key: 'doga', name: 'Doğa', image: img.lake, tagline: 'Doğayı seven, keşfeden, paylaşan bir topluluk.', description: 'En etkileyici doğa kareni yarıştır.', members: 15800, endsIn: '6 gün', prizes: [500, 300, 150] },
  { key: 'evcil', name: 'Evcil Hayvan', image: img.dog, tagline: 'Patili dostların arenası.', description: 'Dostunun en tatlı anını paylaş.', members: 11200, endsIn: '1 gün 8 saat', prizes: [400, 200, 100] },
  { key: 'sanat', name: 'Sanat', image: img.art, tagline: 'Yaratıcılığın sınırı yok.', description: 'Eserini sergile, topluluk değerlendirsin.', members: 4300, endsIn: '6 gün 2 saat', prizes: [450, 250, 120] },
];

export const arenaByKey = (key: string) => arenas.find((a) => a.key === key) ?? arenas[2];

export type ArenaEntry = {
  id: string;
  arenaKey: ArenaKey;
  authorId: string;
  image: string;
  title: string;
  /** Diğer kullanıcılardan gelen oy sayısı ve toplam puan (1-5 yıldız). */
  votes: number;
  totalScore: number;
};

export const arenaEntries: ArenaEntry[] = [
  { id: 'e1', arenaKey: 'otomobil', authorId: 'u_ayse', image: img.car2, title: 'Pistte sabah', votes: 512, totalScore: 2380 },
  { id: 'e2', arenaKey: 'otomobil', authorId: 'u_soner', image: img.car, title: 'Gece mavisi', votes: 470, totalScore: 2120 },
  { id: 'e3', arenaKey: 'otomobil', authorId: ME_ID, image: img.car, title: 'Gece sürüşü', votes: 402, totalScore: 1790 },
  { id: 'e4', arenaKey: 'otomobil', authorId: 'u_can', image: img.sport, title: 'Hız tutkusu', votes: 330, totalScore: 1380 },
  { id: 'e5', arenaKey: 'otomobil', authorId: 'u_ece', image: img.house, title: 'Garaj hikâyesi', votes: 290, totalScore: 1190 },
  { id: 'e6', arenaKey: 'doga', authorId: 'u_soner', image: img.mountain, title: 'Lofoten', votes: 820, totalScore: 3900 },
  { id: 'e7', arenaKey: 'doga', authorId: 'u_ece', image: img.lake, title: 'Ayna göl', votes: 610, totalScore: 2810 },
  { id: 'e8', arenaKey: 'doga', authorId: 'u_emre', image: img.forest, title: 'Orman yolu', votes: 380, totalScore: 1620 },
  { id: 'e9', arenaKey: 'yemek', authorId: 'u_can', image: img.food2, title: 'Renkli kase', votes: 440, totalScore: 1980 },
  { id: 'e10', arenaKey: 'yemek', authorId: ME_ID, image: img.food, title: 'Lezzet durağı', votes: 300, totalScore: 1290 },
  { id: 'e11', arenaKey: 'evcil', authorId: 'u_emre', image: img.dog, title: 'Sahil keyfi', votes: 690, totalScore: 3270 },
  { id: 'e12', arenaKey: 'dekorasyon', authorId: 'u_selin', image: img.sofa, title: 'Yeşil köşe', votes: 260, totalScore: 1150 },
  { id: 'e13', arenaKey: 'kombin', authorId: 'u_ayse', image: img.jacket, title: 'Siyah deri', votes: 350, totalScore: 1530 },
  { id: 'e14', arenaKey: 'sanat', authorId: 'u_selin', image: img.art, title: 'Renk patlaması', votes: 210, totalScore: 960 },
];

/** Bir arenada puanın geçerli sayılması için gereken en az oy (az oyla 1. olmayı engeller). */
export const MIN_VOTES_FOR_RANK = 20;

// ─── Rozetler ve seviye ─────────────────────────────────────────────────────

export type Badge = { id: string; name: string; image: string; description: string; earned: boolean };

export const badges: Badge[] = [
  { id: 'b1', name: 'Doğa Kaşifi', image: img.mountain2, description: 'Doğa Arenası\'nda ilk 10\'a gir.', earned: true },
  { id: 'b2', name: 'Yol Hikayeleri', image: img.nature, description: '10 farklı şehirden paylaşım yap.', earned: true },
  { id: 'b3', name: 'Gurme Ruh', image: img.food, description: 'Yemek Arenası\'nda 100 oy topla.', earned: true },
  { id: 'b4', name: 'Otomobil Tutkunu', image: img.car2, description: 'Otomobil Arenası\'nda ilk 3\'e gir.', earned: true },
  { id: 'b5', name: 'Kreatif Zihin', image: img.art, description: 'Sanat Arenası\'na 5 eser gönder.', earned: true },
  { id: 'b6', name: 'Okyanus Ruhu', image: img.ocean, description: '5 sualtı videosu paylaş.', earned: false },
  { id: 'b7', name: 'Patili Dost', image: img.dog, description: 'Evcil Hayvan Arenası\'na katıl.', earned: false },
];

/** Diğer kullanıcıların kazandığı rozetler (demo veri; 2. aşamada veritabanından gelecek). */
const otherUserBadges: Record<string, string[]> = {
  u_soner: ['b1', 'b2', 'b6'],
  u_deniz: ['b6', 'b2'],
  u_ayse: ['b4', 'b5'],
  u_ece: ['b1', 'b2'],
  u_can: ['b3'],
  u_selin: ['b5'],
  u_emre: ['b7', 'b1'],
};

/** Bir kullanıcının kazandığı rozetler. Kilitli rozetler yalnızca hesap sahibine gösterilir. */
export const earnedBadgesOf = (userId: string) =>
  userId === ME_ID
    ? badges.filter((b) => b.earned)
    : badges.filter((b) => (otherUserBadges[userId] ?? []).includes(b.id));

export const levels = [
  { number: 1, name: 'Çaylak', points: 0 },
  { number: 2, name: 'Gezgin', points: 100 },
  { number: 3, name: 'Kâşif Adayı', points: 250 },
  { number: 4, name: 'Keşifçi', points: 500 },
  { number: 5, name: 'Usta Kâşif', points: 1000 },
];

/** Giriş yapan kullanıcının arena seviye puanı (2. aşamada veritabanından gelecek). */
export const MY_LEVEL_XP = 700;

/** Seviye puanından: mevcut seviye, sonraki seviye, seviye içi ilerleme. */
export function levelInfo(xp: number) {
  let idx = 0;
  levels.forEach((l, i) => {
    if (xp >= l.points) idx = i;
  });
  const current = levels[idx];
  const next = levels[idx + 1];
  const inLevel = xp - current.points;
  const span = next ? next.points - current.points : 1;
  return {
    current,
    next,
    inLevel,
    span,
    progress: next ? inLevel / span : 1,
    toNext: next ? next.points - xp : 0,
  };
}

// ─── Mağaza ─────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  name: string;
  category: 'Elektronik' | 'Kozmetik' | 'Ev & Yaşam' | 'Moda' | 'Spor';
  price: number;
  image: string;
  description: string;
  stock: number;
};

export const products: Product[] = [
  { id: 'pr1', name: '55" 4K Akıllı Televizyon', category: 'Elektronik', price: 9500, image: u('1593359677879-a4bb92f829d1'), description: 'HDR destekli, ince çerçeveli 55 inç 4K akıllı televizyon.', stock: 5 },
  { id: 'pr2', name: 'Profesyonel Makyaj Seti', category: 'Kozmetik', price: 1800, image: u('1512496015851-a90fb38ba796'), description: 'Far paleti, fırça seti ve bakım ürünlerinden oluşan tam set.', stock: 20 },
  { id: 'pr3', name: 'Kablosuz Kulaklık', category: 'Elektronik', price: 2200, image: u('1505740420928-5e560c06d30e'), description: 'Aktif gürültü engelleme, 30 saat pil ömrü.', stock: 12 },
  { id: 'pr4', name: 'Akıllı Saat', category: 'Elektronik', price: 3400, image: u('1523275335684-37898b6baf30'), description: 'Nabız, uyku ve antrenman takibi.', stock: 8 },
  { id: 'pr5', name: 'Parfüm Seti', category: 'Kozmetik', price: 1200, image: u('1541643600914-78b084683601'), description: 'Üç farklı notadan oluşan özel koleksiyon.', stock: 25 },
  { id: 'pr6', name: 'Kahve Makinesi', category: 'Ev & Yaşam', price: 2600, image: u('1495474472287-4d71bcdd2085'), description: 'Espresso ve süt köpürtücülü ev tipi makine.', stock: 10 },
  { id: 'pr7', name: 'Spor Ayakkabı', category: 'Spor', price: 1500, image: u('1542291026-7eec264c27ff'), description: 'Hafif, nefes alan koşu ayakkabısı.', stock: 30 },
  { id: 'pr8', name: 'Deri Ceket', category: 'Moda', price: 2900, image: img.jacket, description: 'Hakiki deri, klasik kesim ceket.', stock: 6 },
];

export const productById = (id: string) => products.find((p) => p.id === id);

/** Başlangıç token hareketleri (kazanılan ödüller). */
export const initialLedger = [
  { id: 'l1', amount: 600, reason: 'Otomobil Arenası — 1. sezon 1.lik ödülü', date: '12 Eki 2026' },
  { id: 'l2', amount: 300, reason: 'Doğa Arenası — 2. sezon 2.lik ödülü', date: '28 Eyl 2026' },
  { id: 'l3', amount: 150, reason: 'Yemek Arenası — 3.lük ödülü', date: '14 Eyl 2026' },
  { id: 'l4', amount: 200, reason: 'Hoş geldin ödülü', date: '1 Eyl 2026' },
];

// ─── Haberler ───────────────────────────────────────────────────────────────

export const newsCategories = ['Gündem', 'Teknoloji', 'Finans', 'Spor', 'Dünya', 'Bilim'] as const;
export type NewsCategory = (typeof newsCategories)[number];

export type NewsArticle = {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  body: string[];
  aiSummary: string[];
  image: string;
  readTime: string;
  time: string;
  live?: boolean;
  special?: boolean;
  video?: string;
};

export const news: NewsArticle[] = [
  {
    id: 'n1',
    category: 'Gündem',
    title: 'Dünya, Yeni Bir Uzay Çağına Giriyor',
    summary: "Uluslararası uzay ittifakı, Ay'da kalıcı yaşam için ilk ortak üssün 2028'de kurulacağını duyurdu.",
    body: [
      "Uluslararası uzay ittifakı bugün yaptığı açıklamada, Ay'ın güney kutbunda kurulacak ilk ortak yaşam üssünün 2028 yılında faaliyete geçeceğini duyurdu.",
      'Projeye 14 ülkenin uzay ajansı katılıyor. Üs, başlangıçta dört kişilik bir ekibin altı ay boyunca yaşayabileceği şekilde tasarlandı.',
      'Uzmanlar, bu adımın Mars yolculukları için kritik bir deneme alanı olacağını vurguluyor.',
    ],
    aiSummary: ["Ay'da ilk ortak üs 2028'de açılacak.", '14 ülke projede yer alıyor.', 'Üs, Mars görevleri için test alanı olacak.'],
    image: img.earth,
    readTime: '3 dk okuma',
    time: '35 dk önce',
    live: true,
    video: videos.bunny,
  },
  {
    id: 'n2',
    category: 'Teknoloji',
    title: 'Yeni nesil uydu ile internet her yere ulaşacak',
    summary: 'Alçak yörünge uyduları, kırsal bölgelere fiber hızında bağlantı getiriyor.',
    body: [
      'Yeni fırlatılan uydu ağı, dünyanın en ücra köşelerine bile yüksek hızlı internet sağlamayı hedefliyor.',
      'Şirket, hizmetin önümüzdeki yıl Türkiye dahil 40 ülkede kullanıma açılacağını açıkladı.',
    ],
    aiSummary: ['Alçak yörünge uyduları kırsala hızlı internet getiriyor.', 'Hizmet gelecek yıl 40 ülkede başlıyor.'],
    image: img.satellite,
    readTime: '4 dk',
    time: '1 saat önce',
  },
  {
    id: 'n3',
    category: 'Finans',
    title: 'Dünya borsaları yeni haftaya yükselişle başladı',
    summary: 'Enflasyon verilerinin beklentilerin altında gelmesi piyasalara moral verdi.',
    body: [
      'Küresel piyasalar haftaya pozitif başladı. Teknoloji hisseleri yükselişe öncülük etti.',
      'Analistler, merkez bankalarının faiz kararlarının önümüzdeki haftalarda belirleyici olacağını belirtiyor.',
    ],
    aiSummary: ['Borsalar haftaya yükselişle başladı.', 'Teknoloji hisseleri öne çıktı.'],
    image: img.stocks,
    readTime: '3 dk',
    time: '2 saat önce',
  },
  {
    id: 'n4',
    category: 'Dünya',
    title: 'İklim zirvesinde tarihi anlaşma imzalandı',
    summary: '190 ülke, 2035 için yeni emisyon hedeflerinde uzlaştı.',
    body: [
      'Uzun süren müzakerelerin ardından iklim zirvesinde tarihi bir anlaşmaya varıldı.',
      'Anlaşma, yenilenebilir enerjiye geçişi hızlandırmak için yeni bir fon da içeriyor.',
    ],
    aiSummary: ['190 ülke yeni emisyon hedefinde anlaştı.', 'Yenilenebilir enerji için fon kuruldu.'],
    image: img.mountain2,
    readTime: '5 dk',
    time: '3 saat önce',
  },
  {
    id: 'n5',
    category: 'Spor',
    title: 'Milli takım Euro yolunda güçlü adım attı',
    summary: 'Deplasmanda alınan galibiyet, gruptaki liderliği getirdi.',
    body: ['Milli takım, zorlu deplasmandan üç puanla döndü ve grubunda liderliğe yükseldi.', 'Teknik direktör, takımın oyununu "olgun" olarak nitelendirdi.'],
    aiSummary: ['Deplasmanda galibiyet alındı.', 'Takım grubunda lider.'],
    image: img.football,
    readTime: '2 dk',
    time: '4 saat önce',
  },
  {
    id: 'n6',
    category: 'Bilim',
    title: 'Okyanusların Gizli Zekâsı',
    summary: 'Balinaların iletişim dili, sandığımızdan çok daha gelişmiş olabilir.',
    body: [
      'Yapay zekâ destekli yeni bir araştırma, balinaların seslerinde dil benzeri yapılar tespit etti.',
      'Bilim insanları, bu bulguların hayvan iletişimine bakışımızı değiştirebileceğini söylüyor.',
    ],
    aiSummary: ['Balina seslerinde dil benzeri yapılar bulundu.', 'Araştırmada yapay zekâ kullanıldı.'],
    image: img.whale,
    readTime: '4 dk okuma',
    time: '5 saat önce',
    special: true,
    video: videos.jellyfish,
  },
  {
    id: 'n7',
    category: 'Teknoloji',
    title: 'Yapay zekâ düzenlemesi için küresel toplantı başladı',
    summary: 'Ülkeler ortak güvenlik standartlarını görüşüyor.',
    body: ['Cenevre\'de başlayan toplantıda yapay zekâ için ortak güvenlik ilkeleri ele alınıyor.'],
    aiSummary: ['Yapay zekâ için ortak kurallar görüşülüyor.'],
    image: img.tech,
    readTime: '3 dk',
    time: '6 saat önce',
  },
];

export const newsById = (id: string) => news.find((n) => n.id === id);

export type LiveUpdate = { id: string; time: string; text: string; fresh?: boolean; articleId?: string };

export const liveUpdates: LiveUpdate[] = [
  { id: 'lu1', time: '14:32', text: "Avrupa'da yeni enerji anlaşması resmen imzalandı.", fresh: true, articleId: 'n4' },
  { id: 'lu2', time: '14:17', text: 'Yapay zekâ düzenlemesi için küresel toplantı başladı.', articleId: 'n7' },
  { id: 'lu3', time: '13:58', text: "Akdeniz'de 5.1 büyüklüğünde deprem meydana geldi." },
  { id: 'lu4', time: '13:40', text: 'Yeni nesil batarya teknolojisi tanıtıldı.', articleId: 'n2' },
  { id: 'lu5', time: '13:12', text: 'Borsa İstanbul güne yükselişle başladı.', articleId: 'n3' },
  { id: 'lu6', time: '12:45', text: 'Milli takımın aday kadrosu açıklandı.', articleId: 'n5' },
];

// ─── Canlı yayınlar ─────────────────────────────────────────────────────────

export type LiveStream = {
  id: string;
  hostId: string;
  title: string;
  viewers: number;
  image: string;
  video: string;
  arenaKey?: ArenaKey;
};

export const liveStreams: LiveStream[] = [
  { id: 'ls1', hostId: 'u_deniz', title: 'Kaş\'ta serbest dalış — canlı', viewers: 1240, image: img.diver, video: videos.jellyfish },
  { id: 'ls2', hostId: 'u_can', title: 'Canlı mutfak: 15 dakikada kahvaltı', viewers: 860, image: img.food2, video: videos.sample10, arenaKey: 'yemek' },
  { id: 'ls3', hostId: 'u_ayse', title: 'Pist günü canlı yayını', viewers: 2310, image: img.car2, video: videos.sample15, arenaKey: 'otomobil' },
  { id: 'ls4', hostId: 'u_ece', title: 'Kapadokya gün doğumu', viewers: 540, image: img.balloon, video: videos.flower },
];

export const liveChat = [
  { authorId: 'u_ece', text: 'Harika görüntü! 😍' },
  { authorId: 'u_can', text: 'Selamlar herkese 👋' },
  { authorId: 'u_selin', text: 'Ses çok net geliyor.' },
  { authorId: 'u_emre', text: 'Bir dahaki yayın ne zaman?' },
];

// ─── Ana sahne ──────────────────────────────────────────────────────────────

export type Interest = { key: string; title: string; text: string; image: string; color: string; arenaKey: ArenaKey };

export const interests: Interest[] = [
  { key: 'doga-kesif', title: 'Doğa ve Keşif', text: 'Doğayı seven, keşfeden, paylaşan bir topluluk.', image: img.lake, color: '#34D399', arenaKey: 'doga' },
  { key: 'uzay-bilim', title: 'Uzay ve Bilim', text: 'Evreni merak eden zihinler burada buluşuyor.', image: img.galaxy, color: '#A78BFA', arenaKey: 'sanat' },
  { key: 'lezzet', title: 'Lezzet Durakları', text: 'Tabağındaki hikâyeyi paylaş.', image: img.food, color: '#F5B642', arenaKey: 'yemek' },
  { key: 'motor', title: 'Motor Tutkusu', text: 'Hız ve tasarım sevenler burada.', image: img.car, color: '#22D3EE', arenaKey: 'otomobil' },
];

// ─── Bildirimler ────────────────────────────────────────────────────────────

export type AppNotification = {
  id: string;
  kind: 'like' | 'comment' | 'follow' | 'arena' | 'token' | 'order';
  actorId?: string;
  text: string;
  time: string;
  href: string;
};

export const notifications: AppNotification[] = [
  { id: 'nt1', kind: 'arena', text: 'Otomobil Arenası\'nda 3. sıraya yükseldin!', time: '10 dk', href: '/arena/otomobil' },
  { id: 'nt2', kind: 'like', actorId: 'u_ayse', text: 'Ayşe Demir gönderini beğendi.', time: '25 dk', href: '/gonderi/m3' },
  { id: 'nt3', kind: 'follow', actorId: 'u_selin', text: 'Selin Kaya seni takip etmeye başladı.', time: '1 sa', href: '/kullanici/u_selin' },
  { id: 'nt4', kind: 'comment', actorId: 'u_deniz', text: 'Deniz Aktaş yorum yaptı: "Harika kare!"', time: '3 sa', href: '/gonderi/m1' },
  { id: 'nt5', kind: 'token', text: '600 token kazandın! Mağazada harcayabilirsin.', time: '2 gün', href: '/cuzdan' },
];
