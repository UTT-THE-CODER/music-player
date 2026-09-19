export function buildAudioEngine(audioElement) {
  const engine = {
    track: null,
    isMuted: false,
    volume: 0.7,
    repeatMode: 'off',
    shuffleMode: false,
    previousVolume: 0.7,
    play() {
      if (!engine.track) return;
      if (audioElement.src !== engine.track.url) {
        audioElement.src = engine.track.url;
      }
      audioElement.volume = engine.volume;
      try {
        audioElement.play();
      } catch (e) {
        return;
      }
    },
    pause() {
      audioElement.pause();
    },
    isPlaying() {
      return !audioElement.paused;
    },
    setTrack(track) {
      engine.track = track;
      if (track) {
        audioElement.src = track.url;
        audioElement.load();
      }
    },
    seek(value) {
      if (!audioElement.duration) return;
      audioElement.currentTime = Math.min(Math.max(value, 0), audioElement.duration);
    },
    setVolume(value) {
      engine.volume = Math.min(1, Math.max(0, value));
      audioElement.volume = engine.volume;
      engine.isMuted = engine.volume === 0;
    },
    toggleMute() {
      if (audioElement.volume > 0) {
        engine.previousVolume = audioElement.volume;
        audioElement.volume = 0;
        engine.isMuted = true;
      } else {
        audioElement.volume = engine.previousVolume || 0.7;
        engine.isMuted = false;
      }
    },
    toggleShuffle() {
      engine.shuffleMode = !engine.shuffleMode;
    },
    setRepeatMode(mode) {
      engine.repeatMode = mode;
    },
    next() {
      if (!engine.track) return false;
      return true;
    },
    previous() {
      if (!engine.track) return false;
      return true;
    },
  };

  audioElement.volume = engine.volume;
  return engine;
}
