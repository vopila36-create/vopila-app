/**
 * 18 yaş altı hesapların fotoğraf ve videolarına başkaları bakarken ekran görüntüsü / kaydı engellenir
 * (Yaş Doğrulama Yönetmeliği md. 8). Android'de tamamen engellenir; iOS 13+ ekran görüntüsünü engeller.
 */
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useId } from 'react';
import { Platform } from 'react-native';

export function useScreenshotGuard(active: boolean) {
  const key = useId();
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
    };
  }, [active, key]);
}
