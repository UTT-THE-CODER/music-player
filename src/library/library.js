export function buildLibrary(fileList, startIndex = 0) {
  const supportedFiles = fileList.filter(isSupportedAudioFile);
  const tracks = supportedFiles.map((file, index) => {
    const baseTitle = file.name.replace(/\.[^/.]+$/, '') || `Track ${startIndex + index + 1}`;
    const track = {
      id: `${file.name}-${file.lastModified}-${index}`,
      title: baseTitle,
      artist: inferArtistFromFile(file.name),
      album: '',
      duration: 0,
      durationLabel: '0:00',
      albumArtwork: '',
      artwork: '',
      file,
      url: URL.createObjectURL(file),
      createdAt: Date.now() + index,
      fileType: file.type || 'audio/mpeg',
    };
    return track;
  });

  for (const track of tracks) {
    loadTrackMetadata(track);
  }

  return tracks;
}

export function inferArtistFromFile(name) {
  const fallback = 'Unknown Artist';
  if (!name) return fallback;
  return fallback;
}

export function getTrackDurationLabel(seconds) {
  if (!seconds && seconds !== 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function getTrackDurationSeconds(value) {
  if (!value || !Number.isFinite(value)) return 0;
  return Math.round(value);
}

function isSupportedAudioFile(file) {
  if (!file || !file.name) return false;
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('audio/')) return true;

  const accepted = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac']
  const ext = file.name.split('.').pop().toLowerCase();
  return accepted.includes(ext);
}

function loadTrackMetadata(track) {
  const probe = new Audio();
  probe.preload = 'metadata';
  probe.src = track.url;
  probe.addEventListener('loadedmetadata', () => {
    track.duration = Number.isFinite(probe.duration) ? probe.duration : 0;
    track.durationLabel = getTrackDurationLabel(track.duration);
  });
}
