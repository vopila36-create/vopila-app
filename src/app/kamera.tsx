/**
 * Uygulama içi kamera (Instagram tarzı):
 * - Deklanşöre dokun → fotoğraf, basılı tut → video (en fazla 60 sn, bırakınca durur)
 * - Ön/arka kamera, flaş (kapalı/açık/otomatik), zamanlayıcı (kapalı/3/10 sn)
 * - Çekimden sonra önizleme → "Tekrar Çek" ya da "Kullan" (paylaşım ekranına geçer)
 */
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  Camera as CameraIcon,
  Check,
  RefreshCcw,
  RotateCcw,
  Timer,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { VideoPlayer } from '@/components/ui/media';
import { PrimaryButton } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Media } from '@/data/mock';
import { setPendingMedia } from '@/store/capture-bridge';

const MAX_SECONDS = 60;
const LONG_PRESS_MS = 280;
const IS_WEB = Platform.OS === 'web';

type Flash = 'off' | 'on' | 'auto';
type TimerSec = 0 | 3 | 10;
type Mode = 'picture' | 'video';

const tap = () => {
  if (!IS_WEB) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Kamera() {
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<Flash>('off');
  const [timer, setTimer] = useState<TimerSec>(0);
  const [mode, setMode] = useState<Mode>(params.mode === 'video' ? 'video' : 'picture');
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  /** Video modunda flaş = sürekli ışık */
  const [torch, setTorch] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  /** Kayıt deklanşöre basılı tutularak mı yapılıyor (ipucu yazısı için) */
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<Media | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Çekim bitti → önizleme. Kamera kapanıp tekrar açılacağı için "hazır" bilgisini sıfırla. */
  const showPreview = (m: Media) => {
    readyRef.current = false;
    setReady(false);
    setCaptured(m);
  };

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Fotoğraf modunda basılı tutarak başlayan kayıt; bitince fotoğraf moduna dön. */
  const autoVideo = useRef(false);
  const longPressActive = useRef(false);
  const suppressNextPress = useRef(false);
  const stopRequested = useRef(false);

  // Kayıt süresi sayacı
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.min(MAX_SECONDS, (Date.now() - started) / 1000)), 100);
    return () => clearInterval(id);
  }, [recording]);

  // Bilgilendirme yazısı birkaç saniye sonra kaybolsun
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/akis' as Href));

  // ─── Çekim işlemleri ─────────────────────────────────────────────────────

  const runCountdown = async () => {
    if (!timer) return;
    for (let s = timer; s > 0; s--) {
      setCountdown(s);
      await sleep(1000);
    }
    setCountdown(null);
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !ready) return;
    await runCountdown();
    try {
      tap();
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (pic?.uri) showPreview({ type: 'image', uri: pic.uri });
    } catch {
      setNotice('Fotoğraf çekilemedi. Tekrar dene.');
    }
  };

  const ensureMic = async () => {
    if (micPerm?.granted) return true;
    const res = await requestMic();
    if (!res.granted) setNotice('Videoda ses için mikrofon izni gerekli; sessiz kaydediliyor.');
    return res.granted;
  };

  const startRecording = async () => {
    if (IS_WEB) {
      setNotice('Video kaydı tarayıcıda desteklenmiyor. Telefonda dene ya da fotoğraf çek.');
      return;
    }
    if (!cameraRef.current) return;
    await ensureMic();
    if (mode !== 'video') {
      autoVideo.current = true;
      // Fotoğraf modundan basılı tutunca videoya geç; kameranın yeniden hazırlanmasını bekle
      readyRef.current = false;
      setReady(false);
      setMode('video');
      // Kamera video moduna geçip hazır olana kadar bekle (en fazla ~1.5 sn)
      for (let i = 0; i < 30 && !readyRef.current; i++) await sleep(50);
      await sleep(150);
    }
    if (stopRequested.current) {
      // Parmak kayıt başlamadan kalktı: fotoğraf moduna geri dön
      stopRequested.current = false;
      if (autoVideo.current) {
        autoVideo.current = false;
        readyRef.current = false;
        setReady(false);
        setMode('picture');
      }
      return;
    }
    try {
      tap();
      setElapsed(0);
      setRecording(true);
      if (flash === 'on') setTorch(true);
      const res = await cameraRef.current?.recordAsync({ maxDuration: MAX_SECONDS });
      if (res?.uri) showPreview({ type: 'video', uri: res.uri });
    } catch {
      setNotice('Video kaydedilemedi. Tekrar dene.');
    } finally {
      setRecording(false);
      setTorch(false);
      if (autoVideo.current) {
        autoVideo.current = false;
        setMode('picture');
      }
    }
  };

  const stopRecording = () => {
    if (recording) {
      tap();
      cameraRef.current?.stopRecording();
    } else {
      // Kayıt henüz başlamadıysa başlar başlamaz dursun
      stopRequested.current = true;
    }
  };

  // ─── Deklanşör hareketleri ──────────────────────────────────────────────

  const onPressIn = () => {
    if (captured || countdown) return;
    stopRequested.current = false;
    longPressActive.current = false;
    if (mode === 'video') return; // video modunda dokun-başlat / dokun-durdur
    pressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      setHolding(true);
      startRecording();
    }, LONG_PRESS_MS);
  };

  const onPressOut = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (longPressActive.current) {
      longPressActive.current = false;
      // Bırakma sonrası gelen "dokunma" olayı fotoğraf çekmesin
      suppressNextPress.current = true;
      setHolding(false);
      stopRecording();
    }
  };

  const onPress = async () => {
    if (suppressNextPress.current) {
      suppressNextPress.current = false;
      return;
    }
    if (captured || countdown) return;
    if (mode === 'picture') {
      await takePhoto();
      return;
    }
    // Video modu: dokun başlat, tekrar dokun durdur
    if (recording) stopRecording();
    else {
      await runCountdown();
      startRecording();
    }
  };

  // ─── Diğer kontroller ──────────────────────────────────────────────────

  const flip = () => {
    if (recording) return;
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const cycleFlash = () => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  const cycleTimer = () => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0));

  const openGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.85,
        videoMaxDuration: MAX_SECONDS,
      });
      if (res.canceled) return;
      finish(res.assets.map((a) => ({ type: a.type === 'video' ? 'video' : 'image', uri: a.uri })));
    } catch {
      setNotice('Galeri açılamadı.');
    }
  };

  /** Medyayı paylaşım ekranına gönder. */
  const finish = (media: Media[]) => {
    setPendingMedia(media);
    if ((params.from === 'olustur' || params.from === 'an') && router.canGoBack()) router.back();
    else router.replace('/olustur' as Href);
  };

  // ─── İzin ekranı ───────────────────────────────────────────────────────

  if (!camPerm) return <View style={styles.root} />;

  if (!camPerm.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: 28 }]}>
        <Pressable onPress={close} style={[styles.iconBtn, styles.closeAbs, { top: insets.top + 10 }]} hitSlop={10}>
          <X size={24} color="#fff" />
        </Pressable>
        <CameraIcon size={56} color={Colors.cyan} />
        <VText variant="heading" style={{ marginTop: 16, textAlign: 'center' }}>
          Kamera izni gerekli
        </VText>
        <VText style={{ textAlign: 'center', marginTop: 8 }}>
          Anlık fotoğraf ve video çekip paylaşabilmen için VOPILA&apos;nın kameranı kullanmasına izin ver.
        </VText>
        <PrimaryButton
          label={camPerm.canAskAgain ? 'İzin Ver' : 'Ayarlardan izin ver'}
          onPress={() => requestCam()}
          style={{ marginTop: 20, alignSelf: 'stretch' }}
        />
        <Pressable onPress={openGallery} style={{ marginTop: 16 }}>
          <VText variant="label" color={Colors.cyan}>
            Bunun yerine galeriden seç
          </VText>
        </Pressable>
      </View>
    );
  }

  // ─── Önizleme ekranı ───────────────────────────────────────────────────

  if (captured) {
    return (
      <View style={styles.root}>
        {captured.type === 'image' ? (
          <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <VideoPlayer uri={captured.uri} autoPlay loop controls={false} />
        )}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable onPress={() => setCaptured(null)} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Vazgeç">
            <X size={24} color="#fff" />
          </Pressable>
        </View>
        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable onPress={() => setCaptured(null)} style={styles.retake}>
            <RotateCcw size={20} color="#fff" />
            <VText variant="label" color="#fff">
              Tekrar Çek
            </VText>
          </Pressable>
          <PrimaryButton
            label="Kullan"
            icon={<Check size={18} color={Colors.onCyan} />}
            onPress={() => finish([captured])}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  // ─── Kamera ekranı ─────────────────────────────────────────────────────

  const cameraFlash = facing === 'front' && flash === 'on' ? 'screen' : flash;
  const progress = elapsed / MAX_SECONDS;
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode}
        flash={mode === 'picture' ? cameraFlash : 'off'}
        enableTorch={torch}
        mirror={facing === 'front'}
        videoQuality="720p"
        onCameraReady={() => {
          readyRef.current = true;
          setReady(true);
        }}
      />

      {/* Üst bar: kapat, flaş, zamanlayıcı */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={close} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Kapat" disabled={recording}>
          <X size={24} color="#fff" />
        </Pressable>
        {recording ? (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <VText style={styles.recText}>
              {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
            </VText>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={cycleFlash} style={styles.iconBtn} accessibilityLabel="Flaş">
              {flash === 'off' ? <ZapOff size={22} color="#fff" /> : <Zap size={22} color={Colors.gold} fill={Colors.gold} />}
              {flash === 'auto' ? <VText style={styles.badgeMini}>A</VText> : null}
            </Pressable>
            <Pressable onPress={cycleTimer} style={styles.iconBtn} accessibilityLabel="Zamanlayıcı">
              <Timer size={22} color={timer ? Colors.cyan : '#fff'} />
              {timer ? <VText style={[styles.badgeMini, { color: Colors.cyan }]}>{timer}</VText> : null}
            </Pressable>
          </View>
        )}
      </View>

      {/* Geri sayım */}
      {countdown ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <VText style={styles.countdown}>{countdown}</VText>
        </View>
      ) : null}

      {/* Bilgilendirme */}
      {notice ? (
        <View style={[styles.notice, { top: insets.top + 70 }]}>
          <VText variant="label" color="#fff" style={{ textAlign: 'center' }}>
            {notice}
          </VText>
        </View>
      ) : null}

      {/* Alt kontroller */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <VText style={styles.hint}>
          {recording
            ? holding
              ? 'Bırakınca kayıt durur'
              : 'Durdurmak için dokun'
            : mode === 'picture'
              ? 'Fotoğraf için dokun, video için basılı tut'
              : 'Kaydı başlatmak için dokun'}
        </VText>

        <View style={styles.controls}>
          <Pressable onPress={openGallery} style={styles.sideBtn} disabled={recording} accessibilityLabel="Galeri">
            <View style={styles.galleryThumb}>
              <VText style={{ fontFamily: Fonts.bold, fontSize: 10, color: '#fff' }}>GALERİ</VText>
            </View>
          </Pressable>

          <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityLabel={mode === 'picture' ? 'Fotoğraf çek' : 'Video kaydet'}
            style={styles.shutterWrap}>
            <Svg width={100} height={100} style={StyleSheet.absoluteFill}>
              <Circle cx={50} cy={50} r={R} stroke="rgba(255,255,255,0.85)" strokeWidth={5} fill="none" />
              {recording ? (
                <Circle
                  cx={50}
                  cy={50}
                  r={R}
                  stroke={Colors.live}
                  strokeWidth={6}
                  fill="none"
                  strokeDasharray={`${C}`}
                  strokeDashoffset={C * (1 - progress)}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              ) : null}
            </Svg>
            <View
              style={[
                styles.shutterInner,
                mode === 'video' && { backgroundColor: Colors.live },
                recording && styles.shutterRecording,
              ]}
            />
          </Pressable>

          <Pressable onPress={flip} style={styles.sideBtn} disabled={recording} accessibilityLabel="Kamerayı çevir">
            <RefreshCcw size={26} color="#fff" />
          </Pressable>
        </View>

        {/* Mod seçici */}
        {!recording ? (
          <View style={styles.modes}>
            {(
              [
                ['picture', 'FOTOĞRAF'],
                ['video', 'VİDEO'],
              ] as const
            ).map(([m, label]) => (
              <Pressable
                key={m}
                onPress={() => {
                  if (m === 'video' && IS_WEB) {
                    setNotice('Video kaydı tarayıcıda desteklenmiyor. Telefonda dene.');
                    return;
                  }
                  if (m !== mode) {
                    readyRef.current = false;
                    setReady(false);
                    setMode(m);
                  }
                }}
                hitSlop={8}>
                <VText style={[styles.modeText, mode === m && styles.modeActive]}>{label}</VText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  closeAbs: { position: 'absolute', left: 16 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMini: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    fontFamily: Fonts.extrabold,
    fontSize: 10,
    color: Colors.gold,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.live },
  recText: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  countdown: {
    fontFamily: Fonts.extrabold,
    fontSize: 120,
    lineHeight: 130,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 20,
  },
  notice: {
    position: 'absolute',
    left: 24,
    right: 24,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(4,10,23,0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  hint: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: '#fff',
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 34,
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff' },
  shutterRecording: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.live },
  modes: { flexDirection: 'row', gap: 28, marginTop: 16 },
  modeText: { fontFamily: Fonts.bold, fontSize: 13, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)' },
  modeActive: { color: Colors.cyan },
  previewActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
