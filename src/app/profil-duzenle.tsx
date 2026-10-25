import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Avatar, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useMe, useStore } from '@/store/app-store';
import { useAuth, type PickedImage } from '@/store/auth';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfilDuzenle() {
  const me = useMe();
  const { updateProfile } = useStore();
  const auth = useAuth();
  const [newAvatar, setNewAvatar] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [location, setLocation] = useState(me.location);
  const [avatar, setAvatar] = useState(me.avatar);
  const [errors, setErrors] = useState<{ name?: string; username?: string; avatar?: string }>({});

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrors((e) => ({ ...e, avatar: 'Fotoğraf seçmek için galeri izni gerekli.' }));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setAvatar(a.uri);
        if (a.base64) setNewAvatar({ uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? undefined });
        setErrors((e) => ({ ...e, avatar: undefined }));
      }
    } catch {
      setErrors((e) => ({ ...e, avatar: 'Fotoğraf seçilemedi, tekrar dene.' }));
    }
  };

  const save = async () => {
    if (saving) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Ad soyad boş bırakılamaz.';
    if (!USERNAME_RE.test(username))
      next.username = 'Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam ve _ içerebilir.';
    setErrors(next);
    if (next.name || next.username) return;

    if (auth.session) {
      // Supabase'e kaydet (fotoğraf seçildiyse önce onu yükle)
      setSaving(true);
      setSaveError('');
      const res = await auth.saveProfile(
        { name: name.trim(), username, bio: bio.trim(), location: location.trim() },
        newAvatar,
      );
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
    } else {
      updateProfile({ name: name.trim(), username, bio: bio.trim(), location: location.trim(), avatar });
    }
    if (router.canGoBack()) router.back();
    else router.replace('/profil' as Href);
  };

  return (
    <SubScreen title="Profili Düzenle">
      <View style={styles.pad}>
        <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
          <Avatar uri={avatar} size={110} ring />
          <View style={styles.cam}>
            <Camera size={18} color={Colors.onCyan} />
          </View>
        </Pressable>
        <Pressable onPress={pickAvatar} style={{ alignSelf: 'center', marginTop: 8 }}>
          <VText variant="label" color={Colors.cyan}>
            Fotoğrafı değiştir
          </VText>
        </Pressable>
        {errors.avatar ? (
          <VText variant="caption" color={Colors.live} style={{ textAlign: 'center', marginTop: 4 }}>
            {errors.avatar}
          </VText>
        ) : null}

        <Field label="Ad Soyad" value={name} onChangeText={setName} error={errors.name} maxLength={40} />
        <Field
          label="Kullanıcı Adı"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
          error={errors.username}
          autoCapitalize="none"
          prefix="@"
          maxLength={20}
        />
        <Field label="Hakkında" value={bio} onChangeText={setBio} multiline maxLength={150} hint={`${bio.length}/150`} />
        <Field label="Konum" value={location} onChangeText={setLocation} maxLength={40} />

        {saveError ? (
          <VText variant="caption" color={Colors.live} style={{ textAlign: 'center', marginTop: Spacing.md }}>
            {saveError}
          </VText>
        ) : null}
        <PrimaryButton
          label={saving ? 'Kaydediliyor…' : 'Kaydet'}
          onPress={save}
          style={{ marginTop: Spacing.xl, opacity: saving ? 0.6 : 1 }}
        />
      </View>
    </SubScreen>
  );
}

function Field({
  label,
  error,
  hint,
  prefix,
  multiline,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string; prefix?: string }) {
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <VText variant="label" color={Colors.textSecondary}>
          {label}
        </VText>
        {hint ? <VText variant="caption">{hint}</VText> : null}
      </View>
      <View style={[styles.inputWrap, multiline && { height: 96, alignItems: 'flex-start' }, error && { borderColor: Colors.live }]}>
        {prefix ? (
          <VText variant="body" color={Colors.textMuted} style={{ marginRight: 2 }}>
            {prefix}
          </VText>
        ) : null}
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, multiline && { height: 84, textAlignVertical: 'top', paddingTop: 10 }]}
        />
      </View>
      {error ? (
        <VText variant="caption" color={Colors.live} style={{ marginTop: 4 }}>
          {error}
        </VText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.md },
  avatarWrap: { alignSelf: 'center' },
  cam: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  input: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 15 },
});
