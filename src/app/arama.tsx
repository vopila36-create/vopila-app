import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Hash,
  Search,
  SearchX,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { PostGrid } from "@/components/post-grid";
import { Avatar, Chip, GlassCard } from "@/components/ui/primitives";
import { EmptyState, SubScreen } from "@/components/ui/sub-screen";
import { VText } from "@/components/ui/text";
import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import { arenas, ME_ID, users, type User } from "@/data/mock";
import { loadDiscover, type Discover, type Person } from "@/lib/discover-api";
import {
  addHistory,
  clearHistory,
  loadHistory,
  removeHistory,
  type HistoryItem,
} from "@/lib/search-history";
import { isRealId, searchProfiles } from "@/lib/social-api";
import { formatCount, useStore } from "@/store/app-store";

type Tab = "people" | "posts" | "arenas" | "news";
const TABS: [Tab, string][] = [
  ["people", "Kişiler"],
  ["posts", "Gönderiler"],
  ["arenas", "Arenalar"],
  ["news", "Haberler"],
];
const SUGGESTIONS = [
  "Lofoten",
  "Kapadokya",
  "Otomobil",
  "Doğa",
  "Uzay",
  "Deniz",
];

const personToUser = (p: Person): User => ({
  id: p.id,
  name: p.name,
  username: p.username,
  avatar: p.avatar,
  verified: p.verified,
  bio: "",
  location: "",
  cover: "",
  followers: p.followers,
  following: 0,
  discoveryPoints: 0,
});

/** Türkçe karakterleri dikkate alan küçük harf karşılaştırması. */
const norm = (s: string) => s.toLocaleLowerCase("tr-TR");

export default function Arama() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("people");
  const query = norm(q.trim());

  // Gerçek kullanıcılar sunucudan aranır (yazmayı bırakınca, 300 ms sonra)
  const [realPeople, setRealPeople] = useState<{ q: string; list: User[] }>({
    q: "",
    list: [],
  });
  const myId = store.myId;
  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (!myId || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchProfiles(myId, term).then((res) => {
        if (!cancelled && res.ok) setRealPeople({ q: term, list: res.data });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, myId]);

  const results = useMemo(() => {
    const has = (s: string) => norm(s).includes(query.replace(/^[@#]/, ""));
    const real =
      realPeople.q && query.includes(norm(realPeople.q)) ? realPeople.list : [];
    return {
      // Örnek kişiler yalnızca oturumsuz önizlemede
      people: [
        ...real,
        ...(myId
          ? []
          : users.filter(
              (u) =>
                u.id !== ME_ID &&
                (has(u.name) || has(u.username) || has(u.location)),
            )),
      ],
      posts: store.allPosts.filter((p) => has(p.caption) || has(p.location)),
      arenas: arenas.filter((a) => has(a.name) || has(a.tagline)),
      news: store.allNews.filter(
        (n) => has(n.title) || has(n.category) || has(n.sourceName ?? ""),
      ),
    };
  }, [query, store.allPosts, store.allNews, realPeople, myId]);

  // Keşfet verisi (arama kutusu boşken)
  const [discoverState, setDiscoverState] = useState<{
    uid: string;
    d: Discover;
  } | null>(null);
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    loadDiscover(myId, { posts: 30, tags: 12, people: 8 }).then((d) => {
      if (alive) setDiscoverState({ uid: myId, d });
    });
    return () => {
      alive = false;
    };
  }, [myId]);
  const discover =
    discoverState && discoverState.uid === myId ? discoverState.d : null;

  // Son aramalar (telefonda, hesaba özel)
  const [historyState, setHistoryState] = useState<{
    uid: string;
    list: HistoryItem[];
  } | null>(null);
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    loadHistory(myId).then((list) => {
      if (alive) setHistoryState({ uid: myId, list });
    });
    return () => {
      alive = false;
    };
  }, [myId]);
  const history =
    historyState && historyState.uid === myId ? historyState.list : [];
  const remember = async (item: HistoryItem) => {
    if (myId)
      setHistoryState({ uid: myId, list: await addHistory(myId, item) });
  };
  const forget = async (item: HistoryItem) => {
    if (myId)
      setHistoryState({ uid: myId, list: await removeHistory(myId, item) });
  };
  const forgetAll = async () => {
    if (!myId) return;
    await clearHistory(myId);
    setHistoryState({ uid: myId, list: [] });
  };
  const openPerson = (u: User) => {
    if (isRealId(u.id))
      remember({
        kind: "user",
        id: u.id,
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        verified: u.verified,
      });
    router.push(`/kullanici/${u.id}` as Href);
  };

  const tag = q.trim().startsWith("#")
    ? q
        .trim()
        .slice(1)
        .replace(/[^\p{L}\p{N}_]/gu, "")
    : "";

  const count = {
    people: results.people.length,
    posts: results.posts.length,
    arenas: results.arenas.length,
    news: results.news.length,
  };

  return (
    <SubScreen title="Ara">
      <View style={styles.pad}>
        <View style={styles.searchBox}>
          <Search size={20} color={Colors.cyan} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Kişi, gönderi, arena veya haber ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() =>
              q.trim().length >= 2 &&
              remember({ kind: "query", text: q.trim() })
            }
          />
          {q ? (
            <Pressable
              onPress={() => setQ("")}
              hitSlop={8}
              accessibilityLabel="Temizle"
            >
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!query ? (
        <View style={styles.pad}>
          {history.length ? (
            <>
              <View style={styles.historyHead}>
                <VText variant="heading" style={{ flex: 1 }}>
                  Son aramalar
                </VText>
                <Pressable onPress={forgetAll} hitSlop={8}>
                  <VText variant="label" color={Colors.cyan}>
                    Tümünü temizle
                  </VText>
                </Pressable>
              </View>
              <View style={{ gap: 4 }}>
                {history.map((h) => (
                  <View
                    key={h.kind === "user" ? `u-${h.id}` : `q-${h.text}`}
                    style={styles.historyRow}
                  >
                    <Pressable
                      style={styles.rowMain}
                      onPress={() =>
                        h.kind === "user"
                          ? router.push(`/kullanici/${h.id}` as Href)
                          : setQ(h.text)
                      }
                    >
                      {h.kind === "user" ? (
                        <Avatar uri={h.avatar} size={40} />
                      ) : (
                        <View style={styles.historyIcon}>
                          <Clock size={18} color={Colors.textSecondary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <VText variant="label" numberOfLines={1}>
                          {h.kind === "user" ? h.name : h.text}
                        </VText>
                        {h.kind === "user" ? (
                          <VText variant="caption" numberOfLines={1}>
                            @{h.username}
                          </VText>
                        ) : null}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => forget(h)}
                      hitSlop={10}
                      accessibilityLabel="Geçmişten kaldır"
                    >
                      <X size={18} color={Colors.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          {/* Keşfet: gündemdeki etiketler, takip önerileri, en ilgi gören gönderiler (gerçek veri) */}
          <VText
            variant="heading"
            style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
          >
            {discover?.tags.length
              ? "Gündemdeki etiketler"
              : "Popüler aramalar"}
          </VText>
          <View style={styles.wrap}>
            {discover?.tags.length
              ? discover.tags.map((t) => (
                  <Chip
                    key={t.tag}
                    label={`#${t.tag}`}
                    onPress={() =>
                      router.push(
                        `/etiket/${encodeURIComponent(t.tag)}` as Href,
                      )
                    }
                  />
                ))
              : SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} onPress={() => setQ(s)} />
                ))}
          </View>
          <VText
            variant="heading"
            style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
          >
            Önerilen kişiler
          </VText>
          <View style={{ gap: 8 }}>
            {(discover?.people.length
              ? discover.people.slice(0, 5).map(personToUser)
              : myId
                ? []
                : users.filter((u) => u.id !== ME_ID).slice(0, 4)
            ).map((u) => (
              <PersonRow key={u.id} user={u} />
            ))}
          </View>
          {discover?.posts.length ? (
            <>
              <VText
                variant="heading"
                style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
              >
                Keşfet
              </VText>
              <PostGrid posts={discover.posts} />
            </>
          ) : null}
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {TABS.map(([key, label]) => (
              <Chip
                key={key}
                label={`${label} (${count[key]})`}
                active={tab === key}
                onPress={() => setTab(key)}
              />
            ))}
          </ScrollView>
          <View style={[styles.pad, { gap: 8 }]}>
            {tag ? (
              <Pressable
                onPress={() =>
                  router.push(`/etiket/${encodeURIComponent(tag)}` as Href)
                }
              >
                <GlassCard style={styles.row}>
                  <Hash size={22} color={Colors.cyan} />
                  <VText variant="bodyBold" style={{ flex: 1 }}>
                    #{tag} etiketli gönderileri gör
                  </VText>
                  <ChevronRight size={18} color={Colors.textSecondary} />
                </GlassCard>
              </Pressable>
            ) : null}
            {tab === "people" &&
              results.people.map((u) => (
                <PersonRow key={u.id} user={u} onOpen={openPerson} />
              ))}
            {tab === "posts" &&
              results.posts.map((p) => {
                const cover = p.media[0];
                return (
                  <ResultRow
                    key={p.id}
                    image={
                      cover.type === "video"
                        ? (cover.poster ?? cover.uri)
                        : cover.uri
                    }
                    title={p.caption}
                    sub={p.location}
                    onPress={() => router.push(`/gonderi/${p.id}` as Href)}
                  />
                );
              })}
            {tab === "arenas" &&
              results.arenas.map((a) => (
                <ResultRow
                  key={a.key}
                  image={a.image}
                  title={`${a.name} Arenası`}
                  sub={`${formatCount(a.members)} üye · ${a.tagline}`}
                  onPress={() => router.push(`/arena/${a.key}` as Href)}
                />
              ))}
            {tab === "news" &&
              results.news.map((n) => (
                <ResultRow
                  key={n.id}
                  image={n.image}
                  title={n.title}
                  sub={`${n.category} · ${n.time}`}
                  onPress={() => router.push(`/haber/${n.id}` as Href)}
                />
              ))}
            {count[tab] === 0 ? (
              <EmptyState
                icon={<SearchX size={40} color={Colors.textMuted} />}
                title="Sonuç bulunamadı"
                text={`"${q.trim()}" için bu sekmede sonuç yok. Diğer sekmelere göz at.`}
              />
            ) : null}
          </View>
        </>
      )}
    </SubScreen>
  );
}

function PersonRow({
  user: u,
  onOpen,
}: {
  user: User;
  onOpen?: (u: User) => void;
}) {
  const store = useStore();
  const status = store.followStatus(u.id);
  const following = status !== "none";
  const real = isRealId(u.id);
  return (
    <GlassCard style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={() =>
          onOpen ? onOpen(u) : router.push(`/kullanici/${u.id}` as Href)
        }
      >
        <Avatar uri={u.avatar} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <VText variant="bodyBold">{u.name}</VText>
            {u.verified ? (
              <BadgeCheck size={14} color="#fff" fill={Colors.cyan} />
            ) : null}
          </View>
          <VText variant="caption">
            @{u.username}
            {real ? "" : ` · ${formatCount(u.followers)} takipçi`}
          </VText>
        </View>
      </Pressable>
      <Pressable
        onPress={() => store.toggleFollow(u.id)}
        style={[styles.followBtn, following && styles.followingBtn]}
      >
        <VText
          variant="label"
          color={following ? Colors.text : Colors.onCyan}
          style={{ fontSize: 12 }}
        >
          {status === "pending" ? "İstek" : following ? "Takipte" : "Takip Et"}
        </VText>
      </Pressable>
    </GlassCard>
  );
}

function ResultRow({
  image,
  title,
  sub,
  onPress,
}: {
  image: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.row}>
        <Image
          source={{ uri: image }}
          style={styles.thumb}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <VText variant="label" numberOfLines={2}>
            {title}
          </VText>
          <VText variant="caption" numberOfLines={1}>
            {sub}
          </VText>
        </View>
        <ChevronRight size={18} color={Colors.textSecondary} />
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    marginTop: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabs: {
    paddingHorizontal: Spacing.screen,
    gap: 8,
    paddingVertical: Spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
});
