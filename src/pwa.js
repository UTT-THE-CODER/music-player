export async function registerServiceWorker({ audioElement } = {}) {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    let waitingWorker = registration.waiting;
    let reloadPending = false;
    let reloading = false;

    const playbackIsActive = () => Boolean(audioElement && !audioElement.paused && !audioElement.ended);

    const applyUpdateWhenSafe = () => {
      if (playbackIsActive()) return;
      if (waitingWorker) {
        const worker = waitingWorker;
        waitingWorker = null;
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
      if (reloadPending && !reloading) {
        reloading = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadPending = true;
      applyUpdateWhenSafe();
    });

    if (audioElement) {
      audioElement.addEventListener('pause', applyUpdateWhenSafe);
      audioElement.addEventListener('ended', applyUpdateWhenSafe);
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          applyUpdateWhenSafe();
        }
      });
    });

    applyUpdateWhenSafe();
    return registration;
  } catch (error) {
    console.warn('EchoFree service worker registration failed.', error);
    return null;
  }
}

export async function getServiceWorkerStatus() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, controlled: false, scope: '' };
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return {
    supported: true,
    controlled: Boolean(navigator.serviceWorker.controller),
    scope: registration?.scope || '',
    state: registration?.active?.state || registration?.installing?.state || registration?.waiting?.state || 'none',
  };
}
