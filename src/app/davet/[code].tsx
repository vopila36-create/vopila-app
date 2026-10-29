/** Davet bağlantısı (beta.vopila.com/davet/<kod>): kayıt ekranını davet koduyla açar. */
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { cleanInviteCode } from '@/lib/invite-api';

export default function Davet() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const davet = cleanInviteCode(String(code ?? ''));
  return <Redirect href={{ pathname: '/giris', params: { davet } } as Href} />;
}
