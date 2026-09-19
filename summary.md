# EchoFree Persistent Offline Library Summary

This workspace contains a static, dependency-free EchoFree offline music player implemented as a mobile-first web app with a Phase 2 persistent offline library layer.

## Implemented

- Static HTML shell with sidebar, library layout, empty state, search box, and fixed bottom music player UI.
- File import flow via an Add Music button and hidden file input supporting common browser-local audio file types.
- Phase 2 persistent metadata and binary storage using IndexedDB for track metadata and OPFS for audio bytes.
- Storage façade in the library storage module that initializes OPFS, saves imported files, restores metadata and object URL-backed audio streams, and deletes track records safely.
- Library rendering for track title, artist fallback, album fallback, duration formatting, delete affordances, and artwork/placeholders.
- Central HTMLAudioElement playback control through a reusable audio engine module with Media Session and UI event wiring preserved.
- Search filtering across title, artist, and album.
- Queue handling and track-end behavior for the current static session.

## Files Created or Updated

- index.html
- package.json
- src/app.js
- src/audio/audioEngine.js
- src/library/library.js
- src/library/renderLibrary.js
- src/ui/ui.js
- src/styles.css
- src/storage/database.js
- src/storage/opfs.js
- src/storage/libraryStorage.js
- summary.md

## Packages Installed

- No packages were installed.

## Storage Architecture

- IndexedDB holds metadata records keyed by track ID in the background database.
- OPFS stores audio bytes under an `audio` directory and artwork bytes under an `artwork` directory, if browser support is available.
- The storage façade maps metadata and binary persistence into a single save/restore/delete lifecycle.

## Audio Persistence

- Imported files are written into the browser’s OPFS audio directory using a generated track ID and filename extension.
- Metadata records in IndexedDB include the OPFS file path and the file metadata needed for the UI.
- During app boot, metadata is restored from IndexedDB and audio bytes are read back from OPFS as a Blob, then turned into an object URL for playback.

## Metadata Persistence

- Each saved track record is written to IndexedDB’s `tracks` object store with fields such as ID, title, artist, album, duration, label, MIME type, file size, file path, extension, and import timestamps.
- The metadata path is intentionally raised above in-memory state so the library can survive page reloads on browsers with OPFS and IndexedDB support.

## Object URL Management

- Imported browser file objects are converted to object URLs for initial playback while the track is in the session.
- On restore, OPFS blobs become new object URLs and are attached directly to the metadata track object that the library renderer expects.
- Delete flows revoke any object URL before the library is re-rendered.

## Browser Compatibility Limitations

- OPFS/IndexedDB persistence requires browser support and is not available in all environments.
- This is a static web app with no backend or remote API.
- If OPFS is unavailable, the app falls back to showing a storage error message rather than a persistent library.
- Artwork persistence remains a path-ready but optional structure; art blobs are stored only when generated data is available.

## Run

Start a local static server:

```sh
python -m http.server 8080
```

Then open:

http://127.0.0.1:8080/index.html

## Phase 4: PWA and Media Session

- Added `manifest.webmanifest` with standalone display, theme/background colors, any-orientation support, and local EchoFree icons.
- Added `service-worker.js` to cache the app shell and serve the cached document when navigation is offline.
- Service-worker caching deliberately excludes audio requests; imported music remains in OPFS and metadata remains in IndexedDB.
- Added optional service-worker registration in `src/pwa.js` with non-blocking update handling that does not force a reload during playback.
- Added `src/audio/mediaSession.js` for feature-detected metadata, playback-state synchronization, play/pause, previous/next, and seek actions.
- Media Session artwork uses only existing local `track.artwork` data and never fetches remote artwork.
- Added local SVG app icons under `icons/` and a `build` script covering all JavaScript entry modules and the service worker.

### Phase 4 Limitations

- PWA installation and Media Session support depend on the browser and platform; unsupported browsers continue as a normal web app.
- Background playback is available only where the browser and operating system allow HTMLAudioElement background media.
- OPFS and IndexedDB still require browser support for persistent local music.
