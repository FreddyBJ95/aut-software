import {t} from './i18n.mjs?v=45';

// Share the installed app's public entry point, including from local previews.
export const APP_URL = 'https://freddybj95.github.io/aut-software/Pipe-bend/';

export function initAppSharing() {
  const byId = id => document.getElementById(id);
  const dialog = byId('share-dialog'), address = byId('share-url');
  const status = byId('share-status'), nativeShare = byId('share-native');
  const menu = byId('app-menu'), menuTrigger = menu.querySelector('summary');
  address.value = APP_URL;
  byId('share-visit').href = APP_URL;

  byId('share-open').onclick = () => {
    menu.open = false;
    status.textContent = '';
    byId('share-qr').alt = t('QR-kode til Pipe-bend');
    nativeShare.hidden = typeof navigator.share !== 'function';
    dialog.showModal();
  };
  dialog.addEventListener('close', () => menuTrigger.focus());
  byId('share-copy').onclick = async () => {
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(APP_URL);
      status.textContent = t('Linket er kopieret.');
    } catch {
      address.focus();
      address.select();
      address.setSelectionRange(0, address.value.length);
      status.textContent = t('Adressen er markeret. Kopiér den manuelt.');
    }
  };
  nativeShare.onclick = async () => {
    status.textContent = '';
    try {
      await navigator.share({title: 'Pipe-bend', url: APP_URL});
    } catch (error) {
      if (error?.name !== 'AbortError') {
        status.textContent = t('Kunne ikke åbne deling. Du kan kopiere linket i stedet.');
      }
    }
  };
}
