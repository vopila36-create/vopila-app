/**
 * Mesajlarda medya: fotoğraf, video ve sesli mesaj balonları + sesli mesaj kaydedici.
 * Dosyalar gizli 'dm' deposunda; yalnızca sohbetin üyeleri 1 saatlik bağlantıyla açar.
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import { Mic, Pause, Play, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { VideoPlayer } from '@/components/ui/media';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { dmMediaUrl, type Message } from '@/lib/messages-api';

/** Sesli mesaj en çok 2 dakika */
export const MAX_VOICE_MS = 120_000;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Gizli medya bağlantısı (mesaj açılınca alınır). */
function useMediaUrl(path: string | null) {
  const [res, setRes] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    dmMediaUrl(path).then((url) => {
      if (alive) setRes({ path, url });
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return null;
  return res && res.path === path ? res.url : undefined;
}

/** Mesajdaki fotoğraf / video / ses balonu */
export function DmMediaBubble({ message, mine }: { message: Message; mine: boolean }) {
  const url = useMediaUrl(message.mediaPath);
  const [open, setOpen] = useState(false);
  if (url === undefined) {
    return (
      <View style={[styles.media, styles.center]}>
        <ActivityIndicator color={Colors.cyan} />
      </View>
    );
  }
  if (!url) {
    return (
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <VText variant="caption">Medya açılamadı.</VText>
      </View>
    );
  }
  if (message.kind === 'audio') return <VoiceBubble url={url} durationMs={message.durationMs ?? 0} mine={mine} />;
  if (message.kind === 'video') {
    return (
      <View style={styles.media}>
        <VideoPlayer uri={url} loop={false} />
      </View>
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Fotoğrafı büyüt">
        <Image source={{ uri: url }} style={styles.media} contentFit="cover" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(false)}>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Pressable>
      </Modal>
    </>
  );
}

function VoiceBubble({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const player = useAudioPlayer(url, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration * 1000 : durationMs;
  const progress = total ? Math.min(1, (status.currentTime * 1000) / total) : 0;
  const fg = mine ? Colors.onCyan : Colors.text;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Sona geldiyse baştan çal
    if (total && status.currentTime * 1000 >= total - 200) await player.seekTo(0);
    player.play();
  };

  return (
    <View style={[styles.bubble, styles.voice, mine ? styles.mine : styles.theirs]}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? 'Durdur' : 'Sesli mesajı oynat'}>
        {status.playing ? <Pause size={20} color={fg} fill={fg} /> : <Play size={20} color={fg} fill={fg} />}
      </Pressable>
      <View style={[styles.track, { backgroundColor: mine ? 'rgba(0,0,0,0.18)' : Colors.border }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
      </View>
      <VText variant="caption" color={fg} style={{ fontFamily: Fonts.semibold, minWidth: 34 }}>
        {mmss(status.playing || status.currentTime > 0 ? status.currentTime * 1000 : total)}
      </VText>
    </View>
  );
}

/**
 * Sesli mesaj kaydedici: mikrofona dokun → kayıt başlar (süre sayar), Gönder ya da İptal.
 * 2 dakikada kayıt kendiliğinden durur.
 */
export function VoiceRecorder({
  onSend,
  onError,
  onActiveChange,
}: {
  onSend: (uri: string, durationMs: number) => Promise<void>;
  onError: (msg: string) => void;
  /** Kayıt başlayınca / bitince (yazı kutusunu gizlemek için) */
  onActiveChange?: (active: boolean) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const stopping = useRef(false);

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        onError('Sesli mesaj için mikrofon izni gerekli. Telefon ayarlarından VOPILA’ya mikrofon izni ver.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // 2 dakikada kayıt kendiliğinden durur; kullanıcı Gönder'e basar
      recorder.record({ forDuration: MAX_VOICE_MS / 1000 });
      stopping.current = false;
      setActive(true);
      onActiveChange?.(true);
    } catch {
      onError('Kayıt başlatılamadı. Mikrofonun başka bir uygulamada kullanılıyor olabilir.');
    }
  };

  const finish = async (send: boolean) => {
    if (stopping.current) return;
    stopping.current = true;
    const duration = Math.min(state.durationMillis, MAX_VOICE_MS);
    try {
      await recorder.stop();
    } catch {}
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setActive(false);
    onActiveChange?.(false);
    const uri = recorder.uri;
    if (!send || !uri) return;
    if (duration < 700) {
      onError('Sesli mesaj çok kısa. Kayıt sırasında konuş, sonra Gönder’e bas.');
      return;
    }
    setBusy(true);
    await onSend(uri, Math.min(duration, MAX_VOICE_MS));
    setBusy(false);
  };

  if (busy) {
    return (
      <View style={styles.micBtn}>
        <ActivityIndicator size="small" color={Colors.onCyan} />
      </View>
    );
  }

  if (!active) {
    return (
      <Pressable onPress={start} style={styles.micBtn} accessibilityLabel="Sesli mesaj kaydet">
        <Mic size={19} color={Colors.onCyan} />
      </Pressable>
    );
  }

  return (
    <View style={styles.recBar}>
      <Pressable onPress={() => finish(false)} hitSlop={8} accessibilityLabel="Kaydı iptal et">
        <Trash2 size={20} color={Colors.live} />
      </Pressable>
      <View style={styles.recDot} />
      <VText variant="label" style={{ flex: 1 }}>
        Kaydediliyor · {mmss(state.durationMillis)} / {mmss(MAX_VOICE_MS)}
      </VText>
      <Pressable onPress={() => finish(true)} style={styles.micBtn} accessibilityLabel="Sesli mesajı gönder">
        <Send size={18} color={Colors.onCyan} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  media: {
    width: 220,
    height: 260,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: Colors.cyan, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: Colors.surfaceStrong, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 6 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 230 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.live },
});
