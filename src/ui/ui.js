export function initUI({ audioEngine, audioElement, onPlayPause, onNext, onPrevious, onSeek, onVolume, onMute, onShuffle, onRepeat }) {
  const elements = {
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    seekbar: document.getElementById('seekbar'),
    volumeControl: document.getElementById('volumeControl'),
    muteBtn: document.getElementById('muteBtn'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    repeatBtn: document.getElementById('repeatBtn'),
  };

  elements.playPauseBtn.addEventListener('click', onPlayPause);
  elements.prevBtn.addEventListener('click', onPrevious);
  elements.nextBtn.addEventListener('click', onNext);

  elements.seekbar.addEventListener('input', event => {
    const percentage = Number(event.target.value);
    onSeek(percentage);
  });

  elements.volumeControl.addEventListener('input', event => {
    const value = Number(event.target.value);
    onVolume(value);
  });

  elements.muteBtn.addEventListener('click', onMute);
  elements.shuffleBtn.addEventListener('click', onShuffle);
  elements.repeatBtn.addEventListener('click', onRepeat);

  audioElement.addEventListener('loadedmetadata', () => {
    const duration = audioElement.duration || 0;
    elements.totalTime.textContent = formatTime(duration);
    elements.seekbar.max = '100';
  });

  audioElement.addEventListener('timeupdate', () => {
    const duration = audioElement.duration || 0;
    const current = audioElement.currentTime || 0;
    elements.currentTime.textContent = formatTime(current);
    elements.totalTime.textContent = formatTime(duration);
    if (duration > 0) {
      elements.seekbar.value = String(Math.round((current / duration) * 100));
    }
  });

  audioElement.addEventListener('play', () => {
    elements.playPauseBtn.classList.add('playing');
    elements.playPauseBtn.setAttribute('aria-label', 'Pause');
    elements.playPauseBtn.innerHTML = `<svg viewBox="0 0 24 24" class="pause-icon"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>`;
  });

  audioElement.addEventListener('pause', () => {
    elements.playPauseBtn.classList.remove('playing');
    elements.playPauseBtn.setAttribute('aria-label', 'Play');
    elements.playPauseBtn.innerHTML = `<svg viewBox="0 0 24 24" class="play-icon"><path d="M7 4v16l14-8z" fill="currentColor" /></svg>`;
  });

  audioElement.addEventListener('ended', () => {
    if (audioEngine.repeatMode === 'track') {
      audioElement.currentTime = 0;
      audioElement.play();
    } else {
      onNext();
    }
  });

  return {
    elements,
  };
}

function formatTime(value) {
  if (!isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
