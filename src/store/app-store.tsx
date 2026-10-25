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
  type ReactNode,
} from 'react';

import {
  arenaEntries as seedEntries,
  initialLedger,
  ME_ID,
  MIN_VOTES_FOR_RANK,
  posts as seedPosts,
  productById,
  userById,
  type ArenaEntry,
  type ArenaKey,
  type Comment,
  type Media,
  type Post,
} from '@/data/mock';
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
};

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'toggleFollow'; userId: string }
  | { type: 'toggleLike'; postId: string }
  | { type: 'toggleSave'; postId: string }
  | { type: 'addComment'; postId: string; comment: Comment }
  | { type: 'addPost'; post: Post; entry?: ArenaEntry }
  | { type: 'vote'; entryId: string; score: number }
  | { type: 'toggleJoinArena'; key: ArenaKey }
  | { type: 'setCartQty'; productId: string; qty: number }
  | { type: 'placeOrder'; order: Order; ledgerItem: LedgerItem }
  | { type: 'setAddress'; address: Address }
  | { type: 'updateProfile'; profile: Partial<Profile> }
  | { type: 'markNotificationsRead'; ids: string[] }
  | { type: 'updateSettings'; settings: Partial<Settings> }
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
    case 'vote':
      return { ...state, votes: { ...state.votes, [action.entryId]: action.score } };
    case 'toggleJoinArena':
      return {
        ...state,
        joinedArenas: state.joinedArenas.includes(action.key)
          ? state.joinedArenas.filter((k) => k !== action.key)
          : [...state.joinedArenas, action.key],
      };
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
    case 'reset':
      return initialState;
  }
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vopila-state-v1';

const today = () =>
  new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

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

  const balance = useMemo(() => state.ledger.reduce((sum, l) => sum + l.amount, 0), [state.ledger]);

  const allPosts = useMemo(() => [...state.myPosts, ...seedPosts], [state.myPosts]);

  const getPost = useCallback((id: string) => allPosts.find((p) => p.id === id), [allPosts]);

  const commentsFor = useCallback(
    (post: Post) => [...post.comments, ...(state.extraComments[post.id] ?? [])],
    [state.extraComments],
  );

  const likeCount = useCallback(
    (post: Post) => post.likes + (state.likedPosts.includes(post.id) ? 1 : 0),
    [state.likedPosts],
  );

  /** Bir arenadaki gönderiler; benim oyum dahil edilerek sıralanmış. */
  const rankedEntries = useCallback(
    (arenaKey: ArenaKey): RankedEntry[] => {
      const list = [...state.myEntries, ...seedEntries].filter((e) => e.arenaKey === arenaKey);
      const scored = list.map((e) => {
        const myVote = state.votes[e.id];
        const votes = e.votes + (myVote ? 1 : 0);
        const total = e.totalScore + (myVote ?? 0);
        const average = votes ? total / votes : 0;
        return { ...e, votes, totalScore: total, average, myVote, qualified: votes >= MIN_VOTES_FOR_RANK, rank: 0 };
      });
      // Yeterli oyu olanlar önce, sonra ortalama puana göre
      scored.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.average - a.average || b.votes - a.votes);
      return scored.map((e, i) => ({ ...e, rank: i + 1 }));
    },
    [state.myEntries, state.votes],
  );

  const cartItems = useMemo(
    () =>
      Object.entries(state.cart)
        .map(([productId, qty]) => ({ product: productById(productId)!, qty }))
        .filter((x) => x.product),
    [state.cart],
  );
  const cartTotal = cartItems.reduce((s, x) => s + x.product.price * x.qty, 0);
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);

  const actions = useMemo(
    () => ({
      toggleFollow: (userId: string) => dispatch({ type: 'toggleFollow', userId }),
      toggleLike: (postId: string) => dispatch({ type: 'toggleLike', postId }),
      toggleSave: (postId: string) => dispatch({ type: 'toggleSave', postId }),
      addComment: (postId: string, text: string) =>
        dispatch({ type: 'addComment', postId, comment: { id: newId('c'), authorId: ME_ID, text, time: 'şimdi' } }),
      createPost: (input: { media: Media[]; caption: string; location?: string; arenaKey?: ArenaKey; title?: string }) => {
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
        return post;
      },
      /** Oy verme kuralları: kendi gönderine oy yok, her gönderiye tek oy, 1-5 arası. */
      vote: (entry: ArenaEntry, score: number): { ok: boolean; error?: string } => {
        if (entry.authorId === ME_ID) return { ok: false, error: 'Kendi gönderine oy veremezsin.' };
        if (state.votes[entry.id]) return { ok: false, error: 'Bu gönderiye zaten oy verdin.' };
        if (score < 1 || score > 5) return { ok: false, error: 'Puan 1 ile 5 arasında olmalı.' };
        dispatch({ type: 'vote', entryId: entry.id, score });
        return { ok: true };
      },
      toggleJoinArena: (key: ArenaKey) => dispatch({ type: 'toggleJoinArena', key }),
      setCartQty: (productId: string, qty: number) => {
        const p = productById(productId);
        if (!p) return;
        dispatch({ type: 'setCartQty', productId, qty: Math.min(qty, p.stock) });
      },
      addToCart: (productId: string) => dispatch({ type: 'setCartQty', productId, qty: (state.cart[productId] ?? 0) + 1 }),
      /** Bakiye kontrolü → token düşümü → sipariş: tek adımda. */
      placeOrder: (address: Address): { ok: boolean; error?: string; order?: Order } => {
        if (!cartItems.length) return { ok: false, error: 'Sepetin boş.' };
        if (cartTotal > balance)
          return { ok: false, error: `Yetersiz bakiye. ${formatTokens(cartTotal - balance)} token daha kazanmalısın.` };
        const order: Order = {
          id: newId('SP').toUpperCase(),
          items: cartItems.map((x) => ({ productId: x.product.id, qty: x.qty, price: x.product.price })),
          total: cartTotal,
          address,
          status: 'Hazırlanıyor',
          date: today(),
        };
        dispatch({
          type: 'placeOrder',
          order,
          ledgerItem: { id: newId('l'), amount: -cartTotal, reason: `Mağaza siparişi #${order.id}`, date: order.date },
        });
        return { ok: true, order };
      },
      setAddress: (address: Address) => dispatch({ type: 'setAddress', address }),
      updateProfile: (profile: Partial<Profile>) => dispatch({ type: 'updateProfile', profile }),
      markNotificationsRead: (ids: string[]) => dispatch({ type: 'markNotificationsRead', ids }),
      updateSettings: (settings: Partial<Settings>) => dispatch({ type: 'updateSettings', settings }),
      resetDemo: () => dispatch({ type: 'reset' }),
    }),
    [state.profile.location, state.votes, state.cart, cartItems, cartTotal, balance],
  );

  return {
    state,
    balance,
    allPosts,
    getPost,
    commentsFor,
    likeCount,
    rankedEntries,
    cartItems,
    cartTotal,
    cartCount,
    isFollowing: (id: string) => state.following.includes(id),
    isLiked: (id: string) => state.likedPosts.includes(id),
    isSaved: (id: string) => state.savedPosts.includes(id),
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
  };
}
