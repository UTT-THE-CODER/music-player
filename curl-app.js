import { buildLibrary, getTrackDurationLabel, getTrackDurationSeconds } from './library/library.js';
import { buildAudioEngine } from './audio/audioEngine.js';
import { renderLibrary } from './library/renderLibrary.js';
import { initUI } from './ui/ui.js';
import { initializeStorage, saveTrack, restoreTracks, deleteTrackFromStorage, getStorageError, updateTrackInStorage, savePlaylistToStorage, getAllPlaylistsFromStorage, getPlaylistFromStorage, deletePlaylistFromStorage, saveSettingValue, loadSettingValue } from './storage/libraryStorage.js';

const state = {
  tracks: [],
  currentTrackIndex: -1,
  shuffled: false,
  repeatMode: 'off',
  currentQueue: [],
  currentQueuePointer: -1,
  search: '',
  audio: null,
  visible: false,
  activeView: 'all',
  activeArtist: '',
  activeAlbum: '',
  activePlaylistId: '',
  sortMode: 'title',
  playlists: [],
  queue: [],
};

const root = {
  fileInput: document.getElementById('fileInput'),
  addMusicBtn: document.getElementById('addMusicBtn'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  trackList: document.getElementById('trackList'),
  emptyState: document.getElementById('emptyState'),
  trackCount: document.getElementById('trackCount'),
  searchInput: document.getElementById('searchInput'),
  storageStatus: document.getElementById('storageStatus'),
  navRows: Array.from(document.querySelectorAll('[data-view]')),
  createPlaylistNav: document.getElementById('createPlaylistNav'),
  playlistNav: document.getElementById('playlistNav'),
  playAllBtn: document.getElementById('playAllBtn'),
  shuffleAllBtn: document.getElementById('shuffleAllBtn'),
  sortSelect: document.getElementById('sortSelect'),
  libraryTitle: document.getElementById('libraryTitle'),
  queuePanel: document.getElementById('queuePanel'),
  queueList: document.getElementById('queueList'),
  clearQueueBtn: document.getElementById('clearQueueBtn'),
};

const audioElement = document.getElementById('audio');
const audioEngine = buildAudioEngine(audioElement);
state.audio = audioElement;

function refreshTrackCount() {
  root.trackCount.textContent = String(state.tracks.length);
}

function applySort(filtered) {
  const source = [...filtered];
  if (state.sortMode === 'artist') {
    return source.sort((a, b) => (a.artist || 'Unknown Artist').localeCompare(b.artist || 'Unknown Artist') || (a.title || '').localeCompare(b.title || ''));
  }
  if (state.sortMode === 'album') {
    return source.sort((a, b) => (a.album || 'Unknown Album').localeCompare(b.album || 'Unknown Album') || (a.title || '').localeCompare(b.title || ''));
  }
  if (state.sortMode === 'added') {
    return source.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
  }
  if (state.sortMode === 'played') {
    return source.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  }
  if (state.sortMode === 'duration') {
    return source.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }
  return source.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

function refreshLibraryDisplay() {
  let filtered = [];
  const query = state.search.trim().toLowerCase();

  if (state.activeView === 'artists') {
    renderArtists();
    return;
  }

  if (state.activeView === 'albums') {
    renderAlbums();
    return;
  }

  if (state.activeView === 'artist') {
    filtered = state.tracks.filter(track => (track.artist || 'Unknown Artist') === state.activeArtist);
  } else if (state.activeView === 'album') {
    filtered = state.tracks.filter(track => (track.album || 'Unknown Album') === state.activeAlbum);
  } else if (state.activeView === 'favorites') {
    filtered = state.tracks.filter(track => Boolean(track.favorite));
  } else if (state.activeView === 'recent') {
    filtered = state.tracks.filter(track => Number(track.lastPlayedAt) > 0).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)).slice(0, 50);
  } else if (state.activeView === 'playlist') {
    const playlist = state.playlists.find(item => item.id === state.activePlaylistId);
    if (!playlist) {
      filtered = [];
    } else {
      const ids = new Set(playlist.trackIds || []);
      filtered = state.tracks.filter(track => ids.has(track.id));
    }
  } else {
    filtered = [...state.tracks];
  }

  const searchFiltered = filtered.filter(track => {
    if (!query) return true;
    return [track.title, track.artist, track.album]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  });

  const sorted = applySort(searchFiltered);
  renderLibrary(sorted, state.tracks, state.currentTrackIndex, playTrack, deleteTrack, toggleFavorite, addTrackToQueue, openContextPlaylist);
  root.emptyState.style.display = sorted.length === 0 ? 'flex' : 'none';
  root.trackList.style.display = sorted.length === 0 ? 'none' : 'grid';
}

function renderArtists() {
  const groups = new Map();
  for (const track of state.tracks) {
    const artist = track.artist || 'Unknown Artist';
    groups.set(artist, groups.get(artist) || { artist, count: 0 });
    groups.get(artist).count += 1;
  }
  const artists = Array.from(groups.values()).sort((a, b) => a.artist.localeCompare(b.artist));
  if (!artists.length) {
    root.trackList.innerHTML = '';
    root.emptyState.style.display = 'flex';
    root.trackList.style.display = 'none';
    return [];
  }
  root.trackList.innerHTML = artists.map(item => `<article class="group-card artist-card" tabindex="0" data-group-artist="${escapeHtml(item.artist)}">
    <div class="group-card-head"><span class="group-title">${escapeHtml(item.artist)}</span><span class="group-count">${item.count} ${item.count === 1 ? 'track' : 'tracks'}</span></div>
    <button class="group-open">Open artist</button>
  </article>`).join('');
  root.trackList.querySelectorAll('[data-group-artist]').forEach(card => {
    card.addEventListener('click', () => {
      state.activeView = 'artist';
      state.activeArtist = card.dataset.groupArtist;
      root.libraryTitle.textContent = state.activeArtist;
      refreshLibraryDisplay();
    });
  });
  root.trackList.style.display = 'grid';
  root.emptyState.style.display = 'none';
  return artists;
}

function renderAlbums() {
  const groups = new Map();
  for (const track of state.tracks) {
    const album = track.album || 'Unknown Album';
    groups.set(album, groups.get(album) || { album, artist: track.artist || 'Unknown Artist', count: 0 });
    groups.get(album).count += 1;
  }
  const albums = Array.from(groups.values()).sort((a, b) => a.album.localeCompare(b.album));
  if (!albums.length) {
    root.trackList.innerHTML = '';
    root.emptyState.style.display = 'flex';
    root.trackList.style.display = 'none';
    return [];
  }
  root.trackList.innerHTML = albums.map(item => `<article class="group-card album-card" tabindex="0" data-group-album="${escapeHtml(item.album)}">
    <div class="group-card-head"><span class="group-title">${escapeHtml(item.album)}</span><span class="group-count">${item.count} ${item.count === 1 ? 'track' : 'tracks'}</span></div>
    <span class="group-artist">${escapeHtml(item.artist)}</span>
    <button class="group-open">Open album</button>
  </article>`).join('');
  root.trackList.querySelectorAll('[data-group-album]').forEach(card => {
    card.addEventListener('click', () => {
      state.activeView = 'album';
      state.activeAlbum = card.dataset.groupAlbum;
      root.libraryTitle.textContent = state.activeAlbum;
      refreshLibraryDisplay();
    });
  });
  root.trackList.style.display = 'grid';
  root.emptyState.style.display = 'none';
  return albums;
}

async function importFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  let imported = 0;
  let failed = 0;

  for (const file of files) {
    if (!file || !file.name || !/\.(mp3|wav|m4a|aac|ogg|oga|flac)$/i.test(file.name)) {
      failed += 1;
      continue;
    }

    try {
      const track = await saveTrack(file);
      if (!track || !track.id) {
        failed += 1;
        continue;
      }

      track.artwork = '';
      track.album = track.album || 'Unknown Album';
      if (!state.tracks.some(existing => existing.id === track.id)) {
        state.tracks.push(track);
        imported += 1;
      } else {
        failed += 1;
      }
    } catch (e) {
      failed += 1;
    }
  }

  if (state.tracks.length && state.currentTrackIndex === -1) {
    state.currentTrackIndex = 0;
    state.currentQueue = buildQueue();
    state.currentQueuePointer = 0;
    playTrack(0);
  } else {
    state.currentQueue = buildQueue();
    state.currentQueuePointer = state.currentQueue.length ? state.currentQueue.indexOf(state.currentTrackIndex) : -1;
    updatePlayerDetails();
  }

  if (imported > 0 || failed > 0) {
    showStorageStatus(imported > 0 ? `${imported} imported${failed ? `, ${failed} failed` : ''}` : `${failed} import failed`);
  }

  refreshTrackCount();
  refreshLibraryDisplay();
}

async function deleteTrack(trackId) {
  if (!trackId) return;
  const track = state.tracks.find(item => item.id === trackId);
  if (!track) return;

  if (!window.confirm(`Delete "${track.title || 'this track'}" from the local library?`)) {
    return;
  }

  const deleted = await deleteTrackFromStorage(track);
  if (!deleted) {
    showStorageStatus('Delete failed');
    return;
  }

  if (state.currentTrackIndex >= 0 && state.tracks[state.currentTrackIndex]?.id === track.id) {
    audioEngine.pause();
    audioElement.pause();
    audioElement.src = '';
    audioElement.load();
    state.currentTrackIndex = -1;
  }

  state.tracks = state.tracks.filter(item => item.id !== trackId);
  state.queue = state.queue.filter(id => id !== trackId);

  if (state.currentTrackIndex >= 0 && state.currentTrackIndex >= state.tracks.length) {
    state.currentTrackIndex = state.tracks.length ? 0 : -1;
  }

  for (const playlist of state.playlists) {
    playlist.trackIds = (playlist.trackIds || []).filter(id => id !== trackId);
    await savePlaylistToStorage(playlist);
  }

  if (state.tracks.length) {
    state.currentQueue = buildQueue();
    if (state.currentTrackIndex >= 0) {
      state.currentQueuePointer = state.currentQueue.indexOf(state.currentTrackIndex);
    } else {
      state.currentQueuePointer = 0;
    }
    if (state.currentTrackIndex >= 0) {
      playTrack(state.currentTrackIndex);
    }
  } else {
    state.currentQueue = [];
    state.currentQueuePointer = -1;
    state.currentTrackIndex = -1;
    updatePlayerDetails();
  }

  refreshTrackCount();
  renderPlaylists();
  refreshLibraryDisplay();
}

function buildQueue() {
  const indices = state.tracks.map((_, index) => index);
  if (!state.shuffled) return indices;
  return shuffle(indices);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showStorageStatus(message) {
  if (!root.storageStatus) return;
  root.storageStatus.hidden = false;
  root.storageStatus.textContent = message;
}

function clearStorageStatus() {
  if (!root.storageStatus) return;
  root.storageStatus.hidden = true;
  root.storageStatus.textContent = '';
}

function playTrack(index) {
  if (!state.tracks.length) return;
  if (index < 0) index = 0;
  if (index >= state.tracks.length) index = 0;
  const track = state.tracks[index];
  state.currentTrackIndex = index;
  if (state.currentQueue && state.currentQueue.length) {
    state.currentQueuePointer = state.currentQueue.indexOf(index);
  } else {
    state.currentQueuePointer = 0;
  }
  audioEngine.setTrack(track);
  audioEngine.play();
  updatePlayHistory(track.id);
  refreshLibraryDisplay();
  updatePlayerDetails();
}

async function updatePlayHistory(trackId) {
  const track = state.tracks.find(item => item.id === trackId);
  if (!track) return;
  track.lastPlayedAt = Date.now();
  track.playCount = Number(track.playCount || 0) + 1;
  await updateTrackInStorage(track.id, { lastPlayedAt: track.lastPlayedAt, playCount: track.playCount });
}

function updatePlayerDetails() {
  const track = state.tracks[state.currentTrackIndex];
  const title = document.getElementById('playingTitle');
  const artist = document.getElementById('playingArtist');
  const artImage = document.getElementById('artImage');
  const artFrame = document.getElementById('artFrame');
  const artPlaceholder = document.getElementById('artPlaceholder');
  const artInitial = document.getElementById('artInitial');

  if (!track) {
    title.textContent = 'No track selected';
    artist.textContent = 'EchoFree';
    artImage.style.display = 'none';
    artPlaceholder.style.display = 'flex';
    artInitial.textContent = 'E';
    return;
  }

  title.textContent = track.title || 'Untitled Track';
  artist.textContent = track.artist || 'Unknown Artist';

  if (track.artwork) {
    artImage.src = track.artwork;
    artImage.style.display = 'block';
    artPlaceholder.style.display = 'none';
  } else {
    artImage.style.display = 'none';
    artPlaceholder.style.display = 'flex';
    artInitial.textContent = (track.title || 'E').charAt(0).toUpperCase();
  }

  if (artFrame) artFrame.classList.add('active');
}

function handlePlayPause() {
  if (!state.tracks.length) return;

  if (audioEngine.isPlaying()) {
    audioEngine.pause();
  } else {
    if (!audioElement.src) {
      playTrack(state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0);
    } else {
      audioEngine.play();
    }
  }
}

function playPrevious() {
  if (!state.tracks.length) return;
  if (!state.currentQueue.length) return;
  const previousIndex = state.currentQueuePointer > 0 ? state.currentQueuePointer - 1 : state.currentQueue.length - 1;
  if (state.currentQueue.length) {
    const target = state.currentQueue[previousIndex];
    if (Number.isInteger(target)) playTrack(target);
  }
}

function playNext() {
  if (!state.tracks.length) return;

  if (state.repeatMode === 'track') {
    audioElement.currentTime = 0;
    try { audioElement.play(); } catch (e) { }
    return;
  }

  if (!state.currentQueue.length) {
    state.currentQueue = buildQueue();
  }

  const queuePosition = state.currentQueue.indexOf(state.currentTrackIndex);
  if (queuePosition >= 0 && queuePosition < state.currentQueue.length - 1) {
    const target = state.currentQueue[queuePosition + 1];
    playTrack(target);
    return;
  }

  if (queuePosition >= state.currentQueue.length - 1) {
    audioEngine.pause();
    audioElement.currentTime = 0;
    return;
  }

  if (state.currentQueue.length > 0) {
    playTrack(state.currentQueue[0]);
  }
}

function toggleFavorite(trackId) {
  const track = state.tracks.find(item => item.id === trackId);
  if (!track) return;
  track.favorite = !track.favorite;
  updateTrackInStorage(track.id, { favorite: track.favorite });
  refreshLibraryDisplay();
  renderPlaylists();
}

function openContextPlaylist(trackId) {
  const track = state.tracks.find(item => item.id === trackId);
  if (!track) return;
  const chosen = prompt('Playlist name to add this track to (or create a new one)', 'My Playlist');
  if (!chosen) return;
  let playlist = state.playlists.find(item => item.name.toLowerCase() === chosen.toLowerCase());
  if (!playlist) {
    playlist = {
      id: `playlist-${Date.now().toString(36)}`,
      name: chosen,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackIds: []
    };
    state.playlists.push(playlist);
    savePlaylistToStorage(playlist);
  }
  if (!playlist.trackIds.includes(track.id)) {
    playlist.trackIds.push(track.id);
    playlist.updatedAt = Date.now();
    savePlaylistToStorage(playlist);
  }
  renderPlaylists();
  showStorageStatus(`Added to ${playlist.name}`);
}

function addTrackToQueue(trackId) {
  if (!trackId || state.queue.includes(trackId)) return;
  state.queue.push(trackId);
  renderQueue();
}

function renderQueue() {
  if (!root.queueList || !root.queuePanel) return;
  if (!state.queue.length) {
    root.queueList.innerHTML = '<span class="queue-empty">No queued tracks</span>';
    return;
  }
  root.queueList.innerHTML = state.queue.map(id => {
    const track = state.tracks.find(item => item.id === id);
    if (!track) return '';
    return `<div class="queue-row" data-queue-id="${escapeHtml(track.id)}">
      <span class="queue-title">${escapeHtml(track.title || 'Untitled Track')}</span>
      <span class="queue-actions"><button class="queue-play" data-queue-play="${escapeHtml(track.id)}">Play</button><button class="queue-remove" data-queue-remove="${escapeHtml(track.id)}">×</button></span>
    </div>`;
  }).join('');

  root.queueList.querySelectorAll('[data-queue-remove]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const id = button.dataset.queueRemove;
      state.queue = state.queue.filter(item => item !== id);
      renderQueue();
    });
  });

  root.queueList.querySelectorAll('[data-queue-play]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const id = button.dataset.queuePlay;
      const idx = state.tracks.findIndex(item => item.id === id);
      if (idx >= 0) {
        playTrack(idx);
      }
    });
  });
}

function renderPlaylists() {
  if (!root.playlistNav) return;
  if (!state.playlists.length) {
    root.playlistNav.innerHTML = '';
    return;
  }
  root.playlistNav.innerHTML = state.playlists.map(playlist => `<div class="nav-row playlist-nav-row" data-playlist-id="${escapeHtml(playlist.id)}"><span>${escapeHtml(playlist.name)}</span></div>`).join('');
  root.playlistNav.querySelectorAll('[data-playlist-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.playlistId;
      const playlist = state.playlists.find(item => item.id === id);
      if (!playlist) return;
      state.activeView = 'playlist';
      state.activePlaylistId = id;
      root.libraryTitle.textContent = playlist.name;
      refreshLibraryDisplay();
    });
  });
}

function addPlaylist(name) {
  if (!name) return;
  const playlist = {
    id: `playlist-${Date.now().toString(36)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trackIds: []
  };
  state.playlists.push(playlist);
  savePlaylistToStorage(playlist);
  renderPlaylists();
}

function deletePlaylist(id) {
  const playlist = state.playlists.find(item => item.id === id);
  if (!playlist) return;
  if (!window.confirm(`Delete playlist "${playlist.name}"?`)) return;
  deletePlaylistFromStorage(id);
  state.playlists = state.playlists.filter(item => item.id !== id);
  if (state.activeView === 'playlist' && state.activePlaylistId === id) {
    state.activeView = 'all';
    state.activePlaylistId = '';
    root.libraryTitle.textContent = 'All Music';
  }
  renderPlaylists();
  refreshLibraryDisplay();
}

function renamePlaylist(id) {
  const playlist = state.playlists.find(item => item.id === id);
  if (!playlist) return;
  const name = prompt('Rename playlist', playlist.name || 'Untitled Playlist');
  if (!name) return;
  playlist.name = name;
  playlist.updatedAt = Date.now();
  savePlaylistToStorage(playlist);
  renderPlaylists();
  refreshLibraryDisplay();
}

function playCollectionFromCurrentView() {
  const visible = getVisibleTracks();
  if (!visible.length) return;
  const queue = visible.map(track => state.tracks.findIndex(item => item.id === track.id)).filter(index => index >= 0);
  if (!queue.length) return;
  state.currentQueue = queue;
  state.currentQueuePointer = 0;
  playTrack(queue[0]);
}

function shuffleAllFromCurrentView() {
  const visible = getVisibleTracks();
  if (!visible.length) return;
  const queue = visible.map(track => state.tracks.findIndex(item => item.id === track.id)).filter(index => index >= 0);
  if (!queue.length) return;
  state.currentQueue = shuffle(queue);
  state.currentQueuePointer = 0;
  playTrack(state.currentQueue[0]);
}

function getVisibleTracks() {
  if (state.activeView === 'favorites') return state.tracks.filter(track => Boolean(track.favorite));
  if (state.activeView === 'recent') return state.tracks.filter(track => Number(track.lastPlayedAt) > 0).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)).slice(0, 50);
  if (state.activeView === 'artist') return state.tracks.filter(track => (track.artist || 'Unknown Artist') === state.activeArtist);
  if (state.activeView === 'album') return state.tracks.filter(track => (track.album || 'Unknown Album') === state.activeAlbum);
  if (state.activeView === 'playlist') {
    const playlist = state.playlists.find(item => item.id === state.activePlaylistId);
    if (!playlist) return [];
    const ids = new Set(playlist.trackIds || []);
    return state.tracks.filter(track => ids.has(track.id));
  }
  return [...state.tracks];
}

function escapeHtml(value) {
  if (!value) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

root.addMusicBtn.addEventListener('click', () => root.fileInput.click());
root.emptyAddBtn.addEventListener('click', () => root.fileInput.click());
root.fileInput.addEventListener('change', event => importFiles(event.target.files));
root.searchInput.addEventListener('input', event => {
  state.search = event.target.value;
  refreshLibraryDisplay();
});

root.navRows.forEach(row => {
  row.addEventListener('click', () => {
    const view = row.dataset.view;
    if (!view) return;
    state.activeView = view;
    state.activeArtist = '';
    state.activeAlbum = '';
    state.activePlaylistId = '';
    state.search = '';
    root.searchInput.value = '';
    root.navRows.forEach(item => item.classList.toggle('active', item === row));
    if (view === 'all') {
      root.libraryTitle.textContent = 'All Music';
    } else if (view === 'favorites') {
      root.libraryTitle.textContent = 'Favorites';
    } else if (view === 'recent') {
      root.libraryTitle.textContent = 'Recently Played';
    } else if (view === 'artists') {
      root.libraryTitle.textContent = 'Artists';
      renderArtists();
      return;
    } else if (view === 'albums') {
      root.libraryTitle.textContent = 'Albums';
      renderAlbums();
      return;
    }
    refreshLibraryDisplay();
  });
});

root.createPlaylistNav.addEventListener('click', () => {
  const name = prompt('Playlist name', 'My Playlist');
  if (!name) return;
  addPlaylist(name);
});

root.playAllBtn.addEventListener('click', () => {
  playCollectionFromCurrentView();
});

root.shuffleAllBtn.addEventListener('click', () => {
  shuffleAllFromCurrentView();
});

root.sortSelect.addEventListener('change', event => {
  state.sortMode = event.target.value || 'title';
  saveSettingValue('sortMode', state.sortMode);
  refreshLibraryDisplay();
});

root.clearQueueBtn.addEventListener('click', () => {
  state.queue = [];
  renderQueue();
});

async function boot() {
  const ok = await initializeStorage();
  if (!ok) {
    showStorageStatus(getStorageError() || 'Storage unavailable');
  } else {
    clearStorageStatus();
  }

  try {
    state.sortMode = await loadSettingValue('sortMode', 'title');
    root.sortSelect.value = state.sortMode;
    const restored = await restoreTracks();
    state.tracks = restored.map(track => ({ ...track }));
    state.playlists = await getAllPlaylistsFromStorage();
    renderPlaylists();
    if (state.tracks.length) {
      state.currentTrackIndex = 0;
      state.currentQueue = buildQueue();
      state.currentQueuePointer = 0;
      refreshTrackCount();
      refreshLibraryDisplay();
      updatePlayerDetails();
    } else {
      refreshTrackCount();
      refreshLibraryDisplay();
    }
  } catch (e) {
    showStorageStatus('Unable to restore library');
  }
}

const ui = initUI({
  audioEngine,
  audioElement,
  onPlayPause: handlePlayPause,
  onNext: playNext,
  onPrevious: playPrevious,
  onSeek: (percent) => {
    if (!state.tracks.length || state.currentTrackIndex < 0) return;
    if (!audioElement.duration || Number.isNaN(audioElement.duration)) return;
    const seconds = Math.round((percent / 100) * audioElement.duration);
    audioElement.currentTime = Math.min(Math.max(seconds, 0), audioElement.duration || seconds);
  },
  onVolume: (value) => {
    audioEngine.setVolume(Number(value) / 100);
  },
  onMute: () => audioEngine.toggleMute(),
  onShuffle: () => {
    state.shuffled = !state.shuffled;
    state.currentQueue = buildQueue();
    if (state.currentQueue.length && state.currentTrackIndex >= 0) {
      state.currentQueuePointer = state.currentQueue.indexOf(state.currentTrackIndex);
    }
    const shuffleBtn = document.getElementById('shuffleBtn');
    shuffleBtn.classList.toggle('shuffle-active', state.shuffled);
    refreshLibraryDisplay();
  },
  onRepeat: () => {
    state.repeatMode = state.repeatMode === 'off' ? 'track' : 'off';
    audioEngine.setRepeatMode(state.repeatMode);
    const repeatBtn = document.getElementById('repeatBtn');
    repeatBtn.classList.toggle('repeat-active', state.repeatMode === 'track');
    repeatBtn.setAttribute('aria-label', state.repeatMode === 'track' ? 'Repeat current track' : 'Repeat off');
  },
});

renderLibrary([], [], -1, playTrack, deleteTrack, toggleFavorite, addTrackToQueue, openContextPlaylist);
renderQueue();
updatePlayerDetails();
boot();
