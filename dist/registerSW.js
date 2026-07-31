if('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
      navigator.serviceWorker.register('./sw.js?v=12d').then(() => {
        console.log('Service Worker v1.12d registered');
      });
    });
  });
}