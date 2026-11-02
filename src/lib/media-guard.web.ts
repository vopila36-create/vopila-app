/**
 * Web'de içerik indirme koruması (Instagram gibi): fotoğraf ve videolarda sağ tık menüsü ("Resmi kaydet"),
 * sürükleyip bırakma ve videodaki "İndir" düğmesi kapatılır. Telefonda zaten indirme yolu yoktur
 * (media-guard.ts boş). Not: hiçbir web koruması %100 değildir; asıl koruma görme yetkisi ve kısa
 * süreli imzalı dosya adresleridir.
 */
let installed = false;

const MEDIA = 'img, video, picture, canvas';

function hardenVideo(v: HTMLVideoElement) {
  v.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
  v.setAttribute('disablePictureInPicture', '');
  v.setAttribute('disableRemotePlayback', '');
}

export function installMediaGuard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const style = document.createElement('style');
  style.textContent = `${MEDIA}{-webkit-user-drag:none;user-drag:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}`;
  document.head.appendChild(style);

  const onMedia = (t: EventTarget | null) => t instanceof Element && !!t.closest(MEDIA);
  // Görsel/video üzerinde sağ tık ve sürükleme engellenir (diğer yerlerde normal çalışır)
  document.addEventListener('contextmenu', (e) => {
    if (onMedia(e.target)) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (onMedia(e.target)) e.preventDefault();
  });

  document.querySelectorAll('video').forEach(hardenVideo);
  new MutationObserver((list) => {
    for (const m of list)
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLVideoElement) hardenVideo(n);
        else if (n instanceof Element) n.querySelectorAll('video').forEach(hardenVideo);
      });
  }).observe(document.body, { childList: true, subtree: true });
}
