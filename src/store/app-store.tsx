/**
 * Uygulamanın hafızası: beğeniler, takipler, yorumlar, oylar, token cüzdanı, sepet ve siparişler.
 * Şimdilik telefonda saklanır (AsyncStorage). 2. aşamada aynı işlemler Supabase'e taşınacak;
 * ekranlar sadece buradaki fonksiyonları kullandığı için değişmeleri gerekmeyecek.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  arenaByKey,
  arenaEntries as seedEntries,
  initialLedger,
  moments as demoMoments,
  news as demoNews,
  liveUpdates as demoLiveUpdates,
  notifications as demoNotifications,
  ME_ID,
  MIN_VOTES_FOR_RANK,
  MY_LEVEL_XP,
  posts as seedPosts,
  products as demoProducts,
  userById,
  type ArenaEntry,
  type ArenaKey,
  type Comment,
  type AppNotification,
  type Media,
  type Moment,
  type NewsArticle,
  type LiveUpdate,
  type Post,
  type Product,
  type User,
} from '@/data/mock';
import {
  addRemoteComment,
  createRemotePost,
  fetchComments,
  fetchFeed,
  fetchMyFlags,
  fetchPosts,
  hiddenUser,
  setLike,
  setSave,
  type NewPost,
} from '@/lib/posts-api';
import {
  fetchArenaEntries,
  fetchArenaStats,
  fetchLatestWinners,
  fetchMyArenas,
  fetchMyPendingRewards,
  setArenaMember,
  timeLeft,
  voteEntry,
  type ArenaStat,
  type PendingReward,
  type SeasonResult,
} from '@/lib/arena-api';
import { fetchConversations, subscribeToInbox, type Conversation } from '@/lib/messages-api';
import { createMoment as createRemoteMoment, fetchMoments } from '@/lib/moments-api';
import { fetchRelationIds, setRelation } from '@/lib/settings-api';
import {
  fetchAddresses,
  fetchLedger,
  fetchOrders,
  fetchProducts,
  placeOrder as placeRemoteOrder,
  type LedgerRow,
  type RemoteOrder,
  type SavedAddress,
} from '@/lib/shop-api';
import { fetchMyInterests, pushInterests, resetMyInterests } from '@/lib/interests-api';
import { fetchNews } from '@/lib/news-api';
import { fetchNotifications, markNotificationsRead as markRemoteNotificationsRead } from '@/lib/notifications-api';
import { fetchMyFollowing, follow, isRealId, unfollow, type FollowStatus } from '@/lib/social-api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/auth';

// ─── Tipler ─────────────────────────────────────────────────────────────────

export type Profile = { name: string; username: string; bio: string; location: string; avatar: string };

export type LedgerItem = { id: string; amount: number; reason: string; date: string };

export type Address = { fullName: string; phone: string; city: string; district: string; line: string };

export type OrderStatus = 'Hazırlanıyor' | 'Kargoda' | 'Teslim edildi';

export type Order = {
  id: string;
  items: { productId: string; qty: number; price: number }[];
  total: number;
  address: Address;
  status: OrderStatus;
  date: string;
};

export type Settings = { pushNotifications: boolean; arenaReminders: boolean; privateAccount: boolean; autoplayVideos: boolean };

type State = {
  profile: Profile;
  following: string[];
  likedPosts: string[];
  savedPosts: string[];
  myPosts: Post[];
  extraComments: Record<string, Comment[]>;
  votes: Record<string, number>;
  myEntries: ArenaEntry[];
  joinedArenas: ArenaKey[];
  ledger: LedgerItem[];
  cart: Record<string, number>;
  orders: Order[];
  address: Address | null;
  readNotifications: string[];
  settings: Settings;
  /** İlgi puanları: "arena:doga", "news:Spor" gibi konuların ne kadar izlendiği (Reels sıralaması için). */
  interests: Record<string, number>;
  /** Son görülen Reels içerikleri (aynı şey tekrar tekrar başa gelmesin). */
  seenReels: string[];
};

const me = userById(ME_ID);

const initialState: State = {
  profile: { name: me.name, username: me.username, bio: me.bio, location: me.location, avatar: me.avatar },
  following: ['u_soner', 'u_deniz', 'u_ece'],
  likedPosts: [],
  savedPosts: [],
  myPosts: [],
  extraComments: {},
  votes: {},
  myEntries: [],
  joinedArenas: ['doga', 'otomobil', 'yemek', 'kombin', 'evcil', 'sanat'],
  ledger: initialLedger,
  cart: {},
  orders: [],
  address: null,
  readNotifications: [],
  settings: { pushNotifications: true, arenaReminders: true, privateAccount: false, autoplayVideos: true },
  interests: {},
  seenReels: [],
};

const EMPTY_FOLLOWS: Record<string, 'pending' | 'accepted'> = {};
const EMPTY_INBOX: Conversation[] = [];
const EMPTY_SHOP = {
  owner: null as string | null,
  ledger: [] as LedgerRow[],
  orders: [] as RemoteOrder[],
  products: null as Product[] | null,
  addresses: [] as SavedAddress[],
};
const EMPTY_ARENA = {
  owner: null as string | null,
  entries: [] as ArenaEntry[],
  stats: {} as Record<string, ArenaStat>,
  joined: [] as ArenaKey[],
  pending: [] as PendingReward[],
  winners: {} as Record<string, SeasonResult>,
};
const EMPTY_NOTIFS: AppNotification[] = [];
const EMPTY_MOMENTS: Moment[] = [];
const EMPTY_REL = { owner: null as string | null, muted: [] as string[], restricted: [] as string[] };

const MAX_SEEN = 300;
/** Eski ilgiler yavaşça sönümlenir; kullanıcının zevki değişince akış da değişir. */
const INTEREST_DECAY = 0.98;

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'toggleFollow'; userId: string }
  | { type: 'toggleLike'; postId: string }
  | { type: 'toggleSave'; postId: string }
  | { type: 'addComment'; postId: string; comment: Comment }
  | { type: 'addPost'; post: Post; entry?: ArenaEntry }
  | { type: 'addEntry'; entry: ArenaEntry }
  | { type: 'vote'; entryId: string; score: number }
  | { type: 'toggleJoinArena'; key: ArenaKey }
  | { type: 'setCartQty'; productId: string; qty: number }
  | { type: 'clearCart' }
  | { type: 'placeOrder'; order: Order; ledgerItem: LedgerItem }
  | { type: 'setAddress'; address: Address }
  | { type: 'updateProfile'; profile: Partial<Profile> }
  | { type: 'markNotificationsRead'; ids: string[] }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'addInterest'; topic: string; amount: number; seenId?: string }
  | { type: 'mergeInterests'; interests: Record<string, number> }
  | { type: 'resetInterests' }
  | { type: 'reset' };

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'toggleFollow':
      return { ...state, following: toggle(state.following, action.userId) };
    case 'toggleLike':
      return { ...state, likedPosts: toggle(state.likedPosts, action.postId) };
    case 'toggleSave':
      return { ...state, savedPosts: toggle(state.savedPosts, action.postId) };
    case 'addComment':
      return {
        ...state,
        extraComments: {
          ...state.extraComments,
          [action.postId]: [...(state.extraComments[action.postId] ?? []), action.comment],
        },
      };
    case 'addPost':
      return {
        ...state,
        myPosts: [action.post, ...state.myPosts],
        myEntries: action.entry ? [action.entry, ...state.myEntries] : state.myEntries,
      };
    case 'addEntry':
      return { ...state, myEntries: [action.entry, ...state.myEntries] };
    case 'vote':
      return { ...state, votes: { ...state.votes, [action.entryId]: action.score } };
    case 'toggleJoinArena':
      return {
        ...state,
        joinedArenas: state.joinedArenas.includes(action.key)
          ? state.joinedArenas.filter((k) => k !== action.key)
          : [...state.joinedArenas, action.key],
      };
    case 'clearCart':
      return { ...state, cart: {} };
    case 'setCartQty': {
      const cart = { ...state.cart };
      if (action.qty <= 0) delete cart[action.productId];
      else cart[action.productId] = action.qty;
      return { ...state, cart };
    }
    case 'placeOrder':
      return {
        ...state,
        orders: [action.order, ...state.orders],
        ledger: [action.ledgerItem, ...state.ledger],
        cart: {},
        address: action.order.address,
      };
    case 'setAddress':
      return { ...state, address: action.address };
    case 'updateProfile':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'markNotificationsRead':
      return { ...state, readNotifications: Array.from(new Set([...state.readNotifications, ...action.ids])) };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'addInterest': {
      const interests: Record<string, number> = {};
      for (const [k, v] of Object.entries(state.interests)) {
        const decayed = v * INTEREST_DECAY;
        if (decayed > 0.05) interests[k] = decayed;
      }
      interests[action.topic] = (interests[action.topic] ?? 0) + action.amount;
      const seenReels =
        action.seenId && !state.seenReels.includes(action.seenId)
          ? [action.seenId, ...state.seenReels].slice(0, MAX_SEEN)
          : state.seenReels;
      return { ...state, interests, seenReels };
    }
    case 'mergeInterests': {
      // Sunucudaki ilgiler (başka cihazdan gelenler) yereldekiyle birleşir; büyük olan kalır
      const interests = { ...state.interests };
      for (const [k, v] of Object.entries(action.interests)) interests[k] = Math.max(interests[k] ?? 0, v);
      return { ...state, interests };
    }
    case 'resetInterests':
      return { ...state, interests: {}, seenReels: [] };
    case 'reset':
      return initialState;
  }
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vopila-state-v1';

const EMPTY_REMOTE = {
  owner: null as string | null,
  posts: [] as Post[],
  extra: [] as Post[],
  authors: {} as Record<string, User>,
  liked: [] as string[],
  saved: [] as string[],
  comments: {} as Record<string, Comment[]>,
};

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 12400 → "12.4K" */
export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return String(n);
}

export const formatTokens = (n: number) => n.toLocaleString('tr-TR');

export type RankedEntry = ArenaEntry & { average: number; myVote?: number; qualified: boolean; rank: number };

// ─── Context ────────────────────────────────────────────────────────────────

type Store = ReturnType<typeof useBuildStore>;
const StoreContext = createContext<Store | null>(null);

function useBuildStore() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrated = useRef(false);

  // Açılışta kaydedilmiş durumu yükle
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'hydrate', state: { ...initialState, ...JSON.parse(raw) } });
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  // Her değişiklikte kaydet
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const localBalance = useMemo(() => state.ledger.reduce((sum, l) => sum + l.amount, 0), [state.ledger]);

  // ─── Gerçek gönderiler (Supabase) ─────────────────────────────────────────
  // Giriş yapılmışsa gerçek gönderiler akışın en üstünde, örnek gönderiler altında görünür.
  // Yalnızca doğrulanmış kullanıcı (iki adımlı kod gerekiyorsa girilene kadar null)
  const { userId: verifiedUserId, profile: authProfile } = useAuth();
  const myId = isSupabaseConfigured ? verifiedUserId : null;
  type RemoteState = {
    /** Bu verinin ait olduğu kullanıcı: hesap değişince eski kişinin verisi gösterilmez. */
    owner: string | null;
    posts: Post[];
    /** Akışta olmayan ama açılan gönderiler (ör. mesajla gelen, profilden açılan). */
    extra: Post[];
    authors: Record<string, User>;
    liked: string[];
    saved: string[];
    comments: Record<string, Comment[]>;
  };
  const [rawRemote, setRemote] = useState<RemoteState>(EMPTY_REMOTE);
  const remote = rawRemote.owner === myId ? rawRemote : EMPTY_REMOTE;
  const [feedError, setFeedError] = useState<string | null>(null);

  const addAuthors = (list: User[]) => (authors: Record<string, User>) => {
    const next = { ...authors };
    for (const u of list) next[u.id] = u;
    return next;
  };

  const applyFeed = useCallback((owner: string, res: Awaited<ReturnType<typeof fetchFeed>>) => {
    if (!res.ok) {
      setFeedError(res.error);
      return;
    }
    setFeedError(null);
    setRemote((r) => {
      const base = r.owner === owner ? r : { ...EMPTY_REMOTE, owner };
      return {
        ...base,
        posts: res.data.posts,
        authors: addAuthors(res.data.authors)(base.authors),
        liked: res.data.liked,
        saved: res.data.saved,
      };
    });
  }, []);

  const refreshFeed = useCallback(async () => {
    if (!myId) return;
    applyFeed(myId, await fetchFeed(myId));
  }, [myId, applyFeed]);

  // Giriş yapan kişi değişince (giriş / çıkış) gerçek akışı yeniden yükle
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchFeed(myId).then((res) => {
      if (!cancelled) applyFeed(myId, res);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, applyFeed]);

  const remoteIds = useMemo(
    () => new Set([...remote.posts, ...remote.extra].map((p) => p.id)),
    [remote.posts, remote.extra],
  );
  const isRemote = useCallback((id: string) => remoteIds.has(id), [remoteIds]);

  // Giriş yapılmışsa telefonda kalmış eski demo paylaşımları gizlenir (gerçekleri sunucudan gelir)
  const allPosts = useMemo(
    () => (myId ? [...remote.posts, ...seedPosts] : [...state.myPosts, ...seedPosts]),
    [myId, remote.posts, state.myPosts],
  );

  const getPost = useCallback(
    (id: string) => allPosts.find((p) => p.id === id) ?? remote.extra.find((p) => p.id === id),
    [allPosts, remote.extra],
  );

  /** Akışta olmayan gerçek gönderiyi sunucudan getirir (görme yetkisi yoksa bulunamaz). */
  const loadPost = useCallback(
    async (id: string): Promise<boolean> => {
      if (!myId || !isRealId(id)) return false;
      if (remoteIds.has(id)) return true;
      const [res, flags] = await Promise.all([fetchPosts(myId, { ids: [id] }), fetchMyFlags(myId, [id])]);
      if (!res.ok || !res.data.posts.length) return false;
      setRemote((r) => {
        const base = r.owner === myId ? r : { ...EMPTY_REMOTE, owner: myId };
        return {
          ...base,
          extra: [...base.extra.filter((p) => p.id !== id), ...res.data.posts],
          authors: addAuthors(res.data.authors)(base.authors),
          liked: [...base.liked.filter((x) => x !== id), ...flags.liked],
          saved: [...base.saved.filter((x) => x !== id), ...flags.saved],
        };
      });
      return true;
    },
    [myId, remoteIds],
  );

  /** Gönderi / yorum sahibinin bilgisi: gerçek kullanıcıysa sunucudan, değilse örnek veriden. */
  // Gerçek kimlikli ama profili gelmeyen yazar = sunucunun gizlediği 18 yaş altı hesap
  const userOf = useCallback(
    (id: string) => remote.authors[id] ?? (isRealId(id) ? hiddenUser(id) : userById(id)),
    [remote.authors],
  );

  const commentsFor = useCallback(
    (post: Post) =>
      post.remote ? (remote.comments[post.id] ?? []) : [...post.comments, ...(state.extraComments[post.id] ?? [])],
    [state.extraComments, remote.comments],
  );

  const commentCount = useCallback(
    (post: Post) => (post.remote ? (remote.comments[post.id]?.length ?? post.commentCount ?? 0) : commentsFor(post).length),
    [remote.comments, commentsFor],
  );

  const likeCount = useCallback(
    (post: Post) => (post.remote ? post.likes : post.likes + (state.likedPosts.includes(post.id) ? 1 : 0)),
    [state.likedPosts],
  );

  const isLiked = (id: string) => (isRemote(id) ? remote.liked.includes(id) : state.likedPosts.includes(id));
  const isSaved = (id: string) => (isRemote(id) ? remote.saved.includes(id) : state.savedPosts.includes(id));

  const savedPostList = useMemo(
    () =>
      [...remote.saved, ...state.savedPosts]
        .map((id) => allPosts.find((p) => p.id === id))
        .filter(Boolean) as Post[],
    [remote.saved, state.savedPosts, allPosts],
  );

  /** Beğeni: ekranda hemen değişir, sunucu reddederse geri alınır. */
  const toggleLike = useCallback(
    async (postId: string) => {
      if (!myId || !remoteIds.has(postId)) {
        dispatch({ type: 'toggleLike', postId });
        return;
      }
      const bump = (on: boolean) => (p: Post) =>
        p.id === postId ? { ...p, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p;
      const flip = (on: boolean) =>
        setRemote((r) => ({
          ...r,
          liked: on ? [...r.liked, postId] : r.liked.filter((x) => x !== postId),
          posts: r.posts.map(bump(on)),
          extra: r.extra.map(bump(on)),
        }));
      const on = !remote.liked.includes(postId);
      flip(on);
      const res = await setLike(myId, postId, on);
      if (!res.ok) flip(!on);
    },
    [myId, remoteIds, remote.liked],
  );

  const toggleSave = useCallback(
    async (postId: string) => {
      if (!myId || !remoteIds.has(postId)) {
        dispatch({ type: 'toggleSave', postId });
        return;
      }
      const flip = (on: boolean) =>
        setRemote((r) => ({ ...r, saved: on ? [...r.saved, postId] : r.saved.filter((x) => x !== postId) }));
      const on = !remote.saved.includes(postId);
      flip(on);
      const res = await setSave(myId, postId, on);
      if (!res.ok) flip(!on);
    },
    [myId, remoteIds, remote.saved],
  );

  /** Gerçek gönderinin yorumlarını sunucudan yükler (gönderi detayı açılınca). */
  const loadComments = useCallback(
    async (postId: string) => {
      if (!myId || !remoteIds.has(postId)) return;
      const res = await fetchComments(myId, postId);
      if (!res.ok) return;
      setRemote((r) => ({
        ...r,
        authors: addAuthors(res.data.authors)(r.authors),
        comments: { ...r.comments, [postId]: res.data.comments },
      }));
    },
    [myId, remoteIds],
  );

  const addComment = useCallback(
    async (postId: string, text: string, parentId?: string): Promise<{ ok: boolean; error?: string }> => {
      if (!myId || !remoteIds.has(postId)) {
        dispatch({ type: 'addComment', postId, comment: { id: newId('c'), authorId: ME_ID, text, time: 'şimdi', parentId } });
        return { ok: true };
      }
      const res = await addRemoteComment(myId, postId, text, parentId);
      if (!res.ok) return { ok: false, error: res.error };
      setRemote((r) => ({
        ...r,
        comments: { ...r.comments, [postId]: [...(r.comments[postId] ?? []), res.data] },
      }));
      return { ok: true };
    },
    [myId, remoteIds],
  );

  // ─── Gerçek takip ─────────────────────────────────────────────────────────
  const [rawFollows, setFollows] = useState<{ owner: string | null; map: Record<string, FollowStatus> }>({
    owner: null,
    map: {},
  });
  const followMap = rawFollows.owner === myId ? rawFollows.map : EMPTY_FOLLOWS;

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchMyFollowing(myId).then((res) => {
      if (!cancelled && res.ok) setFollows({ owner: myId, map: res.data });
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const setFollowStatus = useCallback(
    (id: string, status: FollowStatus) =>
      setFollows((f) => {
        const map = { ...(f.owner === myId ? f.map : {}) };
        if (status === 'none') delete map[id];
        else map[id] = status;
        return { owner: myId, map };
      }),
    [myId],
  );

  /** Takip durumu: örnek kişiler telefonda, gerçek kişiler sunucuda. */
  const followStatus = useCallback(
    (id: string): FollowStatus =>
      isRealId(id) ? (followMap[id] ?? 'none') : state.following.includes(id) ? 'accepted' : 'none',
    [followMap, state.following],
  );

  /** Takip et / bırak / isteği geri çek. Ekranda hemen değişir, sunucu reddederse geri alınır. */
  const toggleFollow = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!isRealId(id) || !myId) {
        dispatch({ type: 'toggleFollow', userId: id });
        return { ok: true };
      }
      const before = followMap[id] ?? 'none';
      if (before === 'none') {
        setFollowStatus(id, 'accepted');
        const res = await follow(myId, id);
        setFollowStatus(id, res.ok ? res.data : 'none');
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }
      setFollowStatus(id, 'none');
      const res = await unfollow(myId, id);
      if (!res.ok) setFollowStatus(id, before);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [myId, followMap, setFollowStatus],
  );

  // ─── Mesajlar (gelen kutusu) ──────────────────────────────────────────────
  const [rawInbox, setInbox] = useState<{ owner: string | null; list: Conversation[] }>({ owner: null, list: [] });
  const inbox = rawInbox.owner === myId ? rawInbox.list : EMPTY_INBOX;

  const refreshInbox = useCallback(async () => {
    if (!myId) return;
    const res = await fetchConversations(myId);
    if (res.ok) setInbox({ owner: myId, list: res.data });
  }, [myId]);

  // Girişte gelen kutusunu yükle; yeni mesaj gelince tazele (canlı)
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchConversations(myId).then((res) => {
      if (!cancelled && res.ok) setInbox({ owner: myId, list: res.data });
    });
    const stop = subscribeToInbox(() => {
      fetchConversations(myId).then((res) => {
        if (!cancelled && res.ok) setInbox({ owner: myId, list: res.data });
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [myId]);

  const unreadMessages = useMemo(() => inbox.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0), [inbox]);

  // ─── Sessize al ve kısıtla ────────────────────────────────────────────────
  const [rawRel, setRel] = useState<{ owner: string | null; muted: string[]; restricted: string[] }>({
    owner: null,
    muted: [],
    restricted: [],
  });
  const rel = rawRel.owner === myId ? rawRel : EMPTY_REL;

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    Promise.all([fetchRelationIds(myId, 'mutes'), fetchRelationIds(myId, 'restricts')]).then(([muted, restricted]) => {
      if (!cancelled) setRel({ owner: myId, muted, restricted });
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  /** Sessize al / kısıtla aç-kapa (ekranda hemen, sunucu reddederse geri alınır). */
  const toggleRelation = useCallback(
    async (kind: 'mutes' | 'restricts', id: string): Promise<{ ok: boolean; on: boolean; error?: string }> => {
      if (!myId) return { ok: false, on: false, error: 'Önce giriş yapmalısın.' };
      const key = kind === 'mutes' ? 'muted' : 'restricted';
      const on = !rel[key].includes(id);
      const flip = (v: boolean) =>
        setRel((r) => {
          const base = r.owner === myId ? r : { ...EMPTY_REL, owner: myId };
          return { ...base, [key]: v ? [...base[key], id] : base[key].filter((x) => x !== id) };
        });
      flip(on);
      const res = await setRelation(myId, kind, id, on);
      if (!res.ok) {
        flip(!on);
        return { ok: false, on: !on, error: res.error };
      }
      return { ok: true, on };
    },
    [myId, rel],
  );

  // ─── Anlar (24 saat) ──────────────────────────────────────────────────────
  const [rawMoments, setMoments] = useState<{ owner: string | null; list: Moment[] }>({ owner: null, list: [] });
  const realMoments = rawMoments.owner === myId ? rawMoments.list : EMPTY_MOMENTS;

  const applyMoments = useCallback((owner: string, res: Awaited<ReturnType<typeof fetchMoments>>) => {
    if (!res.ok) return;
    setMoments({ owner, list: res.data.moments });
    setRemote((r) => (r.owner === owner ? { ...r, authors: addAuthors(res.data.authors)(r.authors) } : r));
  }, []);

  const refreshMoments = useCallback(async () => {
    if (!myId) return;
    applyMoments(myId, await fetchMoments(myId));
  }, [myId, applyMoments]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchMoments(myId).then((res) => {
      if (!cancelled) applyMoments(myId, res);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, applyMoments]);

  /** Akıştaki Anlar şeridi: önce benim anım, sonra diğer gerçek anlar, en sonda örnekler. */
  const allMoments = useMemo(() => {
    const mine = realMoments.filter((m) => m.authorId === ME_ID);
    const others = realMoments.filter((m) => m.authorId !== ME_ID);
    return [...mine, ...others, ...demoMoments];
  }, [realMoments]);

  const createMoment = useCallback(
    async (media: Media[], title: string): Promise<{ ok: boolean; error?: string }> => {
      if (!myId) return { ok: false, error: 'An paylaşmak için giriş yapmalısın.' };
      const res = await createRemoteMoment(myId, media, title);
      if (!res.ok) return { ok: false, error: res.error };
      await refreshMoments();
      return { ok: true };
    },
    [myId, refreshMoments],
  );

  // ─── Gerçek bildirimler ───────────────────────────────────────────────────
  const [rawNotifs, setNotifs] = useState<{ owner: string | null; list: AppNotification[] }>({ owner: null, list: [] });
  const realNotifications = rawNotifs.owner === myId ? rawNotifs.list : EMPTY_NOTIFS;

  const applyNotifs = useCallback(
    (owner: string, res: Awaited<ReturnType<typeof fetchNotifications>>) => {
      if (!res.ok) return;
      setNotifs({ owner, list: res.data.list });
      setRemote((r) => (r.owner === owner ? { ...r, authors: addAuthors(res.data.actors)(r.authors) } : r));
    },
    [],
  );

  const refreshNotifications = useCallback(async () => {
    if (!myId) return;
    applyNotifs(myId, await fetchNotifications(myId));
  }, [myId, applyNotifs]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchNotifications(myId).then((res) => {
      if (!cancelled) applyNotifs(myId, res);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, applyNotifs]);

  /** Bildirimleri okundu say (gerçekler sunucuda, örnekler telefonda). */
  const markNotificationsRead = useCallback(
    (ids: string[]) => {
      const real = ids.filter((id) => realNotifications.some((n) => n.id === id && !n.read));
      const demo = ids.filter((id) => !realNotifications.some((n) => n.id === id));
      if (demo.length) dispatch({ type: 'markNotificationsRead', ids: demo });
      if (real.length && myId) {
        setNotifs((s) => ({ ...s, list: s.list.map((n) => (real.includes(n.id) ? { ...n, read: true } : n)) }));
        markRemoteNotificationsRead(myId, real);
      }
    },
    [realNotifications, myId],
  );

  const unreadNotifications = useMemo(
    () =>
      realNotifications.filter((n) => !n.read).length +
      demoNotifications.filter((n) => !state.readNotifications.includes(n.id)).length,
    [realNotifications, state.readNotifications],
  );

  /** Takip ettiğim herkes (örnek + gerçek, yalnızca onaylı). */
  const followingIds = useMemo(
    () => [...state.following, ...Object.keys(followMap).filter((id) => followMap[id] === 'accepted')],
    [state.following, followMap],
  );

  // ─── Arenalar (gerçek) ────────────────────────────────────────────────────
  const [rawArena, setArena] = useState<{
    owner: string | null;
    entries: ArenaEntry[];
    stats: Record<string, ArenaStat>;
    joined: ArenaKey[];
    pending: PendingReward[];
    winners: Record<string, SeasonResult>;
  }>(EMPTY_ARENA);
  const arena = rawArena.owner === myId ? rawArena : EMPTY_ARENA;

  const loadArenas = useCallback(async (owner: string) => {
    const stats = await fetchArenaStats();
    const statMap = stats.ok ? stats.data : {};
    const seasonIds = Object.values(statMap)
      .map((s) => s.seasonId)
      .filter((x): x is string => !!x);
    const [entries, joined, pending, winners] = await Promise.all([
      fetchArenaEntries(owner, seasonIds),
      fetchMyArenas(owner),
      fetchMyPendingRewards(owner),
      fetchLatestWinners(),
    ]);
    return { statMap, entries, joined, pending, winners };
  }, []);

  const applyArenas = useCallback((owner: string, r: Awaited<ReturnType<typeof loadArenas>>) => {
    setArena({
      owner,
      stats: r.statMap,
      entries: r.entries.ok ? r.entries.data.entries : [],
      joined: r.joined,
      pending: r.pending,
      winners: r.winners,
    });
    if (r.entries.ok) {
      const authors = r.entries.data.authors;
      setRemote((x) => (x.owner === owner ? { ...x, authors: addAuthors(authors)(x.authors) } : x));
    }
  }, []);

  const refreshArenas = useCallback(async () => {
    if (!myId) return;
    applyArenas(myId, await loadArenas(myId));
  }, [myId, loadArenas, applyArenas]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    loadArenas(myId).then((r) => {
      if (!cancelled) applyArenas(myId, r);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, loadArenas, applyArenas]);

  /** Takip ettiğim arenalar: giriş yapılmışsa sunucuda (arena_members), değilse telefonda. */
  const joinedArenas = myId ? arena.joined : state.joinedArenas;

  /** Arenanın üye sayısı ve sezon bitişine kalan süre (örnek sayılar yayından önce kaldırılır). */
  const arenaMeta = useCallback(
    (key: ArenaKey) => {
      const base = arenaByKey(key);
      const st = arena.stats[key];
      return {
        members: base.members + (st?.members ?? 0),
        endsIn: st?.endsAt ? timeLeft(st.endsAt) : base.endsIn,
      };
    },
    [arena.stats],
  );

  /** Bir arenadaki gönderiler; gerçekler + örnekler birlikte, oylar dahil sıralanmış. */
  const rankedEntries = useCallback(
    (arenaKey: ArenaKey): RankedEntry[] => {
      const real = arena.entries.filter((e) => e.arenaKey === arenaKey);
      const local = myId ? [] : state.myEntries.filter((e) => e.arenaKey === arenaKey);
      const demo = seedEntries.filter((e) => e.arenaKey === arenaKey);
      const scored = [...real, ...local, ...demo].map((e) => {
        // Gerçek girişlerde oy sayısı sunucudan (benim oyum dahil) gelir
        const myVote = e.remote ? e.myVote : state.votes[e.id];
        const votes = e.remote ? e.votes : e.votes + (myVote ? 1 : 0);
        const total = e.remote ? e.totalScore : e.totalScore + (myVote ?? 0);
        const average = votes ? total / votes : 0;
        return { ...e, votes, totalScore: total, average, myVote, qualified: votes >= MIN_VOTES_FOR_RANK, rank: 0 };
      });
      // Yeterli oyu olanlar önce, sonra ortalama puana göre
      scored.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.average - a.average || b.votes - a.votes);
      return scored.map((e, i) => ({ ...e, rank: i + 1 }));
    },
    [arena.entries, myId, state.myEntries, state.votes],
  );

  /** Oy ver: gerçek girişte sunucu kuralları (kendi gönderin, tek oy, 3 günlük hesap, açık sezon). */
  const vote = useCallback(
    async (entry: ArenaEntry, score: number): Promise<{ ok: boolean; error?: string }> => {
      if (entry.authorId === ME_ID) return { ok: false, error: 'Kendi gönderine oy veremezsin.' };
      if (score < 1 || score > 5) return { ok: false, error: 'Puan 1 ile 5 arasında olmalı.' };
      if (!entry.remote) {
        if (state.votes[entry.id]) return { ok: false, error: 'Bu gönderiye zaten oy verdin.' };
        dispatch({ type: 'vote', entryId: entry.id, score });
        return { ok: true };
      }
      if (entry.myVote) return { ok: false, error: 'Bu gönderiye zaten oy verdin.' };
      const res = await voteEntry(entry.id, score);
      if (!res.ok) return { ok: false, error: res.error };
      setArena((a) => ({
        ...a,
        entries: a.entries.map((e) =>
          e.id === entry.id ? { ...e, votes: e.votes + 1, totalScore: e.totalScore + score, myVote: score } : e,
        ),
      }));
      return { ok: true };
    },
    [state.votes],
  );

  /** Arenayı takip et / bırak (Arenalar sekmesinde yalnızca takip edilenler görünür). */
  const toggleJoinArena = useCallback(
    async (key: ArenaKey) => {
      if (!myId) {
        dispatch({ type: 'toggleJoinArena', key });
        return;
      }
      const on = !arena.joined.includes(key);
      const flip = (v: boolean) =>
        setArena((a) => ({ ...a, joined: v ? [...a.joined, key] : a.joined.filter((k) => k !== key) }));
      flip(on);
      const res = await setArenaMember(myId, key, on);
      if (!res.ok) flip(!on);
    },
    [myId, arena.joined],
  );

  // ─── Mağaza ve cüzdan (gerçek) ────────────────────────────────────────────
  const [rawShop, setShop] = useState<{
    owner: string | null;
    ledger: LedgerRow[];
    orders: RemoteOrder[];
    products: Product[] | null;
    addresses: SavedAddress[];
  }>(EMPTY_SHOP);
  const shop = rawShop.owner === myId ? rawShop : EMPTY_SHOP;

  const loadShop = useCallback(async (owner: string) => {
    const [ledger, orders, products, addresses] = await Promise.all([
      fetchLedger(owner),
      fetchOrders(owner),
      fetchProducts(),
      fetchAddresses(owner),
    ]);
    return { owner, ledger, orders, products, addresses };
  }, []);

  const refreshShop = useCallback(async () => {
    if (!myId) return;
    setShop(await loadShop(myId));
  }, [myId, loadShop]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    loadShop(myId).then((r) => {
      if (!cancelled) setShop(r);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, loadShop]);

  /** Token bakiyesi: giriş yapılmışsa sunucudaki gerçek hareketlerin toplamı. */
  const balance = useMemo(
    () => (myId ? shop.ledger.reduce((sum, l) => sum + l.amount, 0) : localBalance),
    [myId, shop.ledger, localBalance],
  );
  const ledger = myId ? shop.ledger : state.ledger;

  /** Ürün kataloğu: giriş yapılmışsa sunucudaki güncel fiyat ve stok. */
  const catalog: Product[] = (myId && shop.products) || demoProducts;
  const productOf = useCallback((id: string) => catalog.find((p) => p.id === id), [catalog]);

  // ─── İlgi alanları sunucuda (her cihazda aynı kişisel sıralama) ──────────
  const pendingInterests = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchMyInterests().then((list) => {
      if (alive && list) dispatch({ type: 'mergeInterests', interests: list });
    });
    // Biriken izleme süreleri 30 sn'de bir ve uygulama arka plana geçince gönderilir
    const flush = () => {
      const d = pendingInterests.current;
      if (!Object.keys(d).length) return;
      pendingInterests.current = {};
      pushInterests(d).catch(() => {});
    };
    const t = setInterval(flush, 30_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') flush();
    });
    return () => {
      alive = false;
      clearInterval(t);
      sub.remove();
      flush();
    };
  }, [myId]);

  // ─── Haberler (gerçek kaynaklar) ──────────────────────────────────────────
  // Herkese açık; giriş beklemeden yüklenir. Gelmezse örnek haberler gösterilir.
  const [realNews, setRealNews] = useState<NewsArticle[] | null>(null);
  const refreshNews = useCallback(async () => {
    const list = await fetchNews();
    if (list) setRealNews(list);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetchNews().then((list) => {
      if (!cancelled && list) setRealNews(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const allNews: NewsArticle[] = realNews && realNews.length ? realNews : demoNews;
  const newsOf = useCallback((id: string) => allNews.find((n) => n.id === id), [allNews]);
  /** Canlı gelişmeler: en yeni 20 gerçek haber (saatiyle); son 30 dakikadakiler "yeni". */
  const liveFeed: LiveUpdate[] = useMemo(() => {
    if (!realNews?.length) return demoLiveUpdates;
    return realNews.slice(0, 20).map((n) => ({
      id: `lu_${n.id}`,
      time: n.publishedAt ? new Date(n.publishedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
      text: n.sourceName ? `${n.title} (${n.sourceName})` : n.title,
      fresh: !!n.fresh,
      articleId: n.id,
    }));
  }, [realNews]);

  const cartItems = useMemo(
    () =>
      Object.entries(state.cart)
        .map(([productId, qty]) => ({ product: productOf(productId)!, qty }))
        .filter((x) => x.product),
    [state.cart, productOf],
  );
  const cartTotal = cartItems.reduce((s, x) => s + x.product.price * x.qty, 0);
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);

  /** Sipariş: kayıtlı adres + KVKK onayı; stok, bakiye ve token düşümü sunucuda tek işlemde. */
  const placeOrder = useCallback(
    async (addressId: string, consent: boolean): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> => {
      if (!myId) return { ok: false, error: 'Sipariş vermek için giriş yapmalısın.' };
      if (!cartItems.length) return { ok: false, error: 'Sepetin boş.' };
      if (cartTotal > balance)
        return { ok: false, error: `Yetersiz bakiye. ${formatTokens(cartTotal - balance)} token daha kazanmalısın.` };
      const res = await placeRemoteOrder(
        cartItems.map((x) => ({ productId: x.product.id, qty: x.qty })),
        addressId,
        consent,
      );
      if (!res.ok) return res;
      dispatch({ type: 'clearCart' });
      await refreshShop();
      return { ok: true, orderId: res.data };
    },
    [myId, cartItems, cartTotal, balance, refreshShop],
  );

  const actions = useMemo(
    () => ({
      /**
       * Gönderi paylaşır. Giriş yapılmışsa dosyalar sunucuya yüklenir ve gönderi herkese görünür;
       * değilse (demo modu) yalnızca bu telefonda saklanır.
       */
      createPost: async (input: NewPost): Promise<{ ok: true; post: Post } | { ok: false; error: string }> => {
        if (myId) {
          const res = await createRemotePost(myId, input);
          if (!res.ok) return res;
          if (input.arenaKey) refreshArenas();
          await refreshFeed();
          const post: Post = {
            id: res.data.id,
            authorId: ME_ID,
            location: input.location ?? '',
            time: 'şimdi',
            media: input.media,
            caption: input.caption,
            sensitive: input.sensitive,
            likes: 0,
            comments: [],
            arenaKey: input.arenaKey,
            remote: true,
          };
          return { ok: true, post };
        }
        const post: Post = {
          id: newId('p'),
          authorId: ME_ID,
          location: input.location || state.profile.location,
          time: 'şimdi',
          media: input.media,
          caption: input.caption,
          likes: 0,
          comments: [],
          arenaKey: input.arenaKey,
        };
        const cover = input.media[0];
        const entry: ArenaEntry | undefined = input.arenaKey
          ? {
              id: newId('e'),
              arenaKey: input.arenaKey,
              authorId: ME_ID,
              image: cover.type === 'video' ? cover.poster ?? cover.uri : cover.uri,
              title: input.title || input.caption.slice(0, 30) || 'Yeni gönderi',
              votes: 0,
              totalScore: 0,
            }
          : undefined;
        dispatch({ type: 'addPost', post, entry });
        return { ok: true, post };
      },
      setCartQty: (productId: string, qty: number) => {
        const p = productOf(productId);
        if (!p) return;
        dispatch({ type: 'setCartQty', productId, qty: Math.min(qty, p.stock) });
      },
      addToCart: (productId: string) => dispatch({ type: 'setCartQty', productId, qty: (state.cart[productId] ?? 0) + 1 }),
      setAddress: (address: Address) => dispatch({ type: 'setAddress', address }),
      updateProfile: (profile: Partial<Profile>) => dispatch({ type: 'updateProfile', profile }),
      updateSettings: (settings: Partial<Settings>) => dispatch({ type: 'updateSettings', settings }),
      /**
       * İlgi kaydı: bir konuya bakılan süre (saniye) ya da etkileşim puanı eklenir.
       * `seenId` verilirse içerik "görüldü" sayılır ve sıralamada geriye düşer.
       */
      addInterest: (topic: string, amount: number, seenId?: string) => {
        dispatch({ type: 'addInterest', topic, amount, seenId });
        // Giriş yapılmışsa sunucuya gönderilmek üzere biriktir
        if (myId) pendingInterests.current[topic] = (pendingInterests.current[topic] ?? 0) + amount;
      },
      /** İlgi alanlarını sıfırla (Ayarlar > İlgi alanların) */
      resetInterests: async () => {
        pendingInterests.current = {};
        dispatch({ type: 'resetInterests' });
        return myId ? resetMyInterests() : true;
      },
      resetDemo: () => dispatch({ type: 'reset' }),
    }),
    [state.profile.location, state.cart, myId, refreshFeed, refreshArenas, productOf],
  );

  return {
    state,
    balance,
    allNews,
    newsOf,
    liveFeed,
    refreshNews,
    /** Gerçek haberler yüklendi mi (Reels sırası bir kez yeniden kurulur) */
    newsReady: !!realNews,
    ledger,
    orders: shop.orders,
    addresses: shop.addresses,
    catalog,
    productOf,
    refreshShop,
    placeOrder,
    allPosts,
    getPost,
    loadPost,
    userOf,
    commentsFor,
    commentCount,
    likeCount,
    rankedEntries,
    vote,
    toggleJoinArena,
    joinedArenas,
    arenaMeta,
    refreshArenas,
    pendingRewards: arena.pending,
    /** Her arenanın geçen ay kazananları */
    latestWinners: arena.winners,
    /** Arena seviye puanı: giriş yapılmışsa sunucudaki gerçek puan */
    myXp: authProfile?.level_xp ?? MY_LEVEL_XP,
    cartItems,
    cartTotal,
    cartCount,
    savedPostList,
    feedError,
    refreshFeed,
    loadComments,
    myId,
    isFollowing: (id: string) => followStatus(id) === 'accepted',
    followStatus,
    toggleFollow,
    followingIds,
    inbox,
    unreadMessages,
    refreshInbox,
    mutedIds: rel.muted,
    restrictedIds: rel.restricted,
    toggleRelation,
    allMoments,
    refreshMoments,
    createMoment,
    realNotifications,
    unreadNotifications,
    refreshNotifications,
    markNotificationsRead,
    isLiked,
    isSaved,
    toggleLike,
    toggleSave,
    addComment,
    ...actions,
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const store = useBuildStore();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore, AppStoreProvider içinde kullanılmalı');
  return s;
}

/** Giriş yapan kullanıcının bilgisi (düzenlenmiş profil dahil). */
export function useMe() {
  const { state } = useStore();
  const { profile } = useAuth();
  const base = { ...userById(ME_ID), ...state.profile };
  // Giriş yapılmışsa ad, kullanıcı adı, biyografi ve fotoğraf Supabase'deki profilden gelir
  if (!profile) return base;
  return {
    ...base,
    name: profile.name,
    username: profile.username,
    bio: profile.bio,
    location: profile.location,
    avatar: profile.avatar_url ?? '',
    verified: profile.verified,
    discoveryPoints: profile.discovery_points,
  };
}
