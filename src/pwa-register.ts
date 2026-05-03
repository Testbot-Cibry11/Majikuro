import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined') {
  registerSW({
    onNeedRefresh() {
      console.log('New content available, please refresh.');
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}
