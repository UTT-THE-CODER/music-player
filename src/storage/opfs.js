const AUDIO_DIR = 'audio';
const ART_DIR = 'artwork';

export function opfsSupported() {
  return Boolean(window && window.navigator && navigator.storage && typeof navigator.storage.getDirectory === 'function');
}

export async function openOpfsRoots() {
  if (!opfsSupported()) {
    throw new Error('OPFS is unavailable in this browser. Persistent local audio storage is unsupported.');
  }

  const root = await navigator.storage.getDirectory();
  const audioRoot = await root.getDirectoryHandle(AUDIO_DIR, { create: true });
  const artRoot = await root.getDirectoryHandle(ART_DIR, { create: true });

  return { root, audioRoot, artRoot };
}

export async function storeAudioFile(file, trackId, extension) {
  const { audioRoot } = await openOpfsRoots();
  const safeName = `${trackId}${extension || ''}`;
  const fileHandle = await audioRoot.getFileHandle(safeName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return safeName;
}

export async function getAudioBlob(track) {
  const { audioRoot } = await openOpfsRoots();
  const safeName = track.audioPath || `${track.id}${track.ext || ''}`;
  try {
    const handle = await audioRoot.getFileHandle(safeName);
    return await handle.getFile();
  } catch (_e) {
    return null;
  }
}

export async function deleteAudioFile(track) {
  const { audioRoot } = await openOpfsRoots();
  const safeName = track.audioPath || `${track.id}${track.ext || ''}`;
  try {
    await audioRoot.removeEntry(safeName);
  } catch (_e) {
    // Best effort cleanup if the file is already not present.
  }
}

export async function storeArtworkBlob(trackId, blob) {
  const { artRoot } = await openOpfsRoots();
  const safeName = `${trackId}.png`;
  try {
    const handle = await artRoot.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return safeName;
  } catch (e) {
    return '';
  }
}

export async function getArtworkBlob(track) {
  const { artRoot } = await openOpfsRoots();
  const safeName = track.artworkPath || '';
  if (!safeName) return null;
  try {
    const handle = await artRoot.getFileHandle(safeName);
    return await handle.getFile();
  } catch (_e) {
    return null;
  }
}

export async function deleteArtworkFile(track) {
  const { artRoot } = await openOpfsRoots();
  const safeName = track.artworkPath || '';
  if (!safeName) return;
  try {
    await artRoot.removeEntry(safeName);
  } catch (_e) {
    // Ignore missing artwork.
  }
}
