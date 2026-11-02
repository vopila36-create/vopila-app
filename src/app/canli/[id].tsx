/** Canlı yayın izleme: altyapı bağlanana kadar "Yakında" ekranına yönlendirir. */
import { Redirect, type Href } from 'expo-router';

export default function CanliYayin() {
  return <Redirect href={'/canli' as Href} />;
}
