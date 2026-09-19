export function bindMediaSession({ audioElement, getTrack, onPlay, onPause, onPrevious, onNext, onSeek }) {
  if (!('mediaSession' in navigator)) {
    return {
      supported: false,
      syncMetadata() {},
      syncPlaybackState() {},
    };
  }

  const mediaSession = navigator.mediaSession;
  const safeHandler = (action, handler) => {
    if (typeof mediaSession.setActionHandler !== 'function') return;
    try {
      mediaSession.setActionHandler(action, handler);
    } catch (_error) {
      // Some browsers expose Media Session but reject individual actions.
    }
  };

  safeHandler('play', () => onPlay());
  safeHandler('pause', () => onPause());
  safeHandler('previoustrack', () => onPrevious());
  safeHandler('nexttrack', () => onNext());
  safeHandler('seekbackward', details => {
    const offset = Number(details.seekOffset) || 10;
    onSeek(Math.max(0, audioElement.currentTime - offset));
  });
  safeHandler('seekforward', details => {
    const offset = Number(details.seekOffset) || 10;
    onSeek(Math.min(audioElement.duration || Infinity, audioElement.currentTime + offset));
  });
  safeHandler('seekto', details => {
    const requested = Number(details.seekTime);
    if (!Number.isFinite(requested)) return;
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : requested;
    const target = Math.min(Math.max(requested, 0), duration);
    if (details.fastSeek && typeof audioElement.fastSeek === 'function') {
      audioElement.fastSeek(target);
    } else {
      onSeek(target);
    }
  });

  const syncMetadata = () => {
    const track = getTrack();
    if (!track || typeof MediaMetadata !== 'function') {
      mediaSession.metadata = null;
      return;
    }

    const artwork = track.artwork ? [{
      src: track.artwork,
      sizes: '512x512',
      type: track.artworkType || 'image/png',
    }] : [];

    try {
      mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled Track',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        artwork,
      });
    } catch (_error) {
      mediaSession.metadata = null;
    }
  };

  const syncPlaybackState = state => {
    try {
      mediaSession.playbackState = state;
    } catch (_error) {
      // Playback state is optional and must never block audio playback.
    }
  };

  audioElement.addEventListener('play', () => syncPlaybackState('playing'));
  audioElement.addEventListener('pause', () => syncPlaybackState('paused'));
  audioElement.addEventListener('ended', () => syncPlaybackState('none'));

  return { supported: true, syncMetadata, syncPlaybackState };
}
