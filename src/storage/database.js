const DB_NAME = 'echofree-offline-library';
const DB_VERSION = 2;
const STORE_NAME = 'tracks';
const PLAYLIST_STORE_NAME = 'playlists';
const SETTINGS_STORE_NAME = 'settings';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB.'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('album', 'album', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
        store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(PLAYLIST_STORE_NAME)) {
        const playlistStore = db.createObjectStore(PLAYLIST_STORE_NAME, { keyPath: 'id' });
        playlistStore.createIndex('name', 'name', { unique: false });
        playlistStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function saveTrack(track) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(track);
    request.onerror = () => reject(request.error || new Error('Unable to save track metadata.'));
    request.onsuccess = () => resolve(track);
  });
}

export async function getAllTracks() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error('Unable to load tracks.'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getTrack(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error || new Error('Unable to load track.'));
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteTrack(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error || new Error('Unable to delete track metadata.'));
    request.onsuccess = () => resolve(true);
  });
}

export async function clearLibrary() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error || new Error('Unable to clear track metadata.'));
    request.onsuccess = () => resolve(true);
  });
}

export async function updateTrack(id, patch) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error || new Error('Unable to load track.'));
    request.onsuccess = () => {
      const existing = request.result || {};
      const updated = { ...existing, ...patch, id };
      const putRequest = store.put(updated);
      putRequest.onerror = () => reject(putRequest.error || new Error('Unable to update track metadata.'));
      putRequest.onsuccess = () => resolve(updated);
    };
  });
}

export async function savePlaylist(playlist) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    const request = store.put(playlist);
    request.onerror = () => reject(request.error || new Error('Unable to save playlist.'));
    request.onsuccess = () => resolve(playlist);
  });
}

export async function getAllPlaylists() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error('Unable to list playlists.'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getPlaylist(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error || new Error('Unable to load playlist.'));
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deletePlaylist(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error || new Error('Unable to delete playlist.'));
    request.onsuccess = () => resolve(true);
  });
}

export async function loadSetting(key, fallback = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.get(key);
    request.onerror = () => reject(request.error || new Error('Unable to load setting.'));
    request.onsuccess = () => resolve(request.result?.value ?? fallback);
  });
}

export async function saveSetting(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.put({ key, value });
    request.onerror = () => reject(request.error || new Error('Unable to save setting.'));
    request.onsuccess = () => resolve(value);
  });
}
