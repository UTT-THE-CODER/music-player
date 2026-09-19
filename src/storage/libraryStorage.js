import { saveTrack as saveMetadata, getAllTracks as getAllMetadata, getTrack as getMetadata, deleteTrack as deleteMetadata, clearLibrary as clearMetadata, savePlaylist, getAllPlaylists, getPlaylist, deletePlaylist as deletePlaylistMetadata, saveSetting, loadSetting, updateTrack } from './database.js';
import { openOpfsRoots, storeAudioFile, getAudioBlob, deleteAudioFile, storeArtworkBlob, getArtworkBlob, deleteArtworkFile, opfsSupported } from './opfs.js';
import { inferArtistFromFile, getTrackDurationLabel, getTrackDurationSeconds } from '../library/library.js';

export const storage = {
  ready: false,
  supported: false,
  roots: null,
  error: '',
};

function normalizeExtension(fileName) {
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match ? `.${match[1]}` : '';
}

function stableTrackId(file) {
  const base = `${file.name}-${file.lastModified || 0}-${Math.round(file.size || 0)}`;
  const simple = Array.from(base).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return `track-${Math.abs(simple).toString(36)}-${Date.now().toString(36)}`;
}

export async function initializeStorage() {
  storage.supported = opfsSupported();
  if (!storage.supported) {
    storage.ready = false;
    storage.error = 'OPFS is unavailable in this browser. Persistent local audio storage is unsupported.';
    return false;
  }

  try {
    storage.roots = await openOpfsRoots();
    storage.ready = true;
    storage.error = '';
    return true;
  } catch (e) {
    storage.ready = false;
    storage.supported = false;
    storage.error = e && e.message ? e.message : 'Persistent storage is unavailable in this browser.';
    return false;
  }
}

export async function saveTrack(file) {
  if (!storage.ready || !storage.supported) {
    throw new Error(storage.error || 'Storage is unavailable.');
  }

  if (!file || !file.name) {
    throw new Error('The selected file is invalid.');
  }

  const normalized = file.name.toLowerCase();
  const accepted = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac'];
  const ext = normalized.split('.').pop();
  if (!accepted.includes(ext)) {
    throw new Error('Unsupported audio file.');
  }

  const trackId = stableTrackId(file);
  const extension = normalizeExtension(file.name);
  const audioPath = await storeAudioFile(file, trackId, extension);

  const baseTitle = file.name.replace(/\.[^/.]+$/, '') || `Track ${Date.now().toString(36)}`;
  const created = {
    id: trackId,
    title: baseTitle,
    artist: inferArtistFromFile(file.name),
    album: '',
    duration: 0,
    durationLabel: '0:00',
    albumArtwork: '',
    artwork: '',
    artworkPath: '',
    mimeType: file.type || 'audio/mpeg',
    fileSize: file.size || 0,
    importedAt: Date.now(),
    lastPlayedAt: 0,
    playCount: 0,
    favorite: false,
    audioPath,
    ext: extension,
    fileType: file.type || 'audio/mpeg',
  };

  const probe = new Audio();
  probe.preload = 'metadata';
  const url = URL.createObjectURL(file);
  probe.src = url;

  const duration = await new Promise(resolve => {
    probe.addEventListener('loadedmetadata', () => {
      const proberDuration = Number.isFinite(probe.duration) ? probe.duration : 0;
      resolve(proberDuration);
    }, { once: true });
    probe.addEventListener('error', () => {
      resolve(0);
    }, { once: true });
  });

  created.duration = duration;
  created.durationLabel = getTrackDurationLabel(duration);
  created.url = url;

  await saveMetadata(created);

  return created;
}

export async function restoreTracks() {
  if (!storage.ready || !storage.supported) {
    return [];
  }

  const saved = await getAllMetadata();
  const restored = [];

  for (const track of saved) {
    try {
      const blob = await getAudioBlob(track);
      if (!blob) {
        await deleteMetadata(track.id);
        continue;
      }
      const url = URL.createObjectURL(blob);
      const trackCopy = { ...track, url };
      restored.push(trackCopy);
    } catch (_e) {
      try {
        await deleteMetadata(track.id);
      } catch (_ignored) { }
    }
  }

  return restored;
}

export async function deleteTrackFromStorage(track) {
  if (!track || !track.id) return false;
  try {
    await deleteAudioFile(track);
    await deleteArtworkFile(track);
    await deleteMetadata(track.id);
    const playlists = await getAllPlaylists();
    for (const playlist of playlists) {
      const trackIds = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
      if (trackIds.includes(track.id)) {
        playlist.trackIds = trackIds.filter(id => id !== track.id);
        playlist.updatedAt = Date.now();
        await savePlaylist(playlist);
      }
    }
    if (track.url) {
      try { URL.revokeObjectURL(track.url); } catch (_e) { }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearStorageLibrary() {
  try {
    await clearMetadata();
  } catch (_e) {
    return false;
  }

  return true;
}

export async function getTrackById(id) {
  return await getMetadata(id);
}

export async function updateTrackInStorage(trackId, patch) {
  return await updateTrack(trackId, patch);
}

export async function savePlaylistToStorage(playlist) {
  return await savePlaylist(playlist);
}

export async function getAllPlaylistsFromStorage() {
  return await getAllPlaylists();
}

export async function getPlaylistFromStorage(id) {
  return await getPlaylist(id);
}

export async function deletePlaylistFromStorage(id) {
  return await deletePlaylistMetadata(id);
}

export async function saveSettingValue(key, value) {
  return await saveSetting(key, value);
}

export async function loadSettingValue(key, fallback = null) {
  return await loadSetting(key, fallback);
}

export function getStorageError() {
  return storage.error || '';
}
