export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          console.info('EchoFree app update is ready for the next reload.');
        }
      });
    });
    return registration;
  } catch (error) {
    console.warn('EchoFree service worker registration failed.', error);
    return null;
  }
}
