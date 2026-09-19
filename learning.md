# EchoFree Learning Guide

This guide explains the new features added in Phase 4 of EchoFree: PWA support, offline app-shell loading, service-worker behavior, install metadata, and Media Session integration.

Phase 4 was implemented without changing the existing UI design, storage architecture, queue logic, or audio playback pipeline.

## 1. What Phase 4 Adds

Phase 4 gives EchoFree two platform integrations:

1. **PWA support**: the browser can treat EchoFree like an installable application and can load its app shell while offline.
2. **Media Session support**: supported browsers and operating systems can show the current track and expose play, pause, next, previous, and seek controls outside the page.

The browser APIs are optional. If a browser does not support them, EchoFree continues working as a normal web app.

## 2. Web App Manifest

File: `manifest.webmanifest`

A web app manifest is a JSON file that describes how a web application should behave when installed.

Important fields:

```json
{
  "name": "EchoFree",
  "short_name": "EchoFree",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#07110f",
  "background_color": "#07110f"
}
```

### What the fields mean

- `name`: the full application name used by install surfaces.
- `short_name`: the shorter name used where space is limited.
- `start_url`: the page opened when the installed app starts.
- `scope`: limits the URLs controlled by the PWA.
- `display: standalone`: removes normal browser chrome when launched as an installed app.
- `orientation: any`: allows portrait or landscape use.
- `theme_color`: colors browser or operating-system UI around the app.
- `background_color`: the background shown while the app is starting.
- `icons`: tells the platform where to find install icons.

The manifest is connected in `index.html` with:

```html
<link rel="manifest" href="manifest.webmanifest" />
```

The manifest does not create an installation button. Supported browsers provide their own install prompt or menu command.

## 3. EchoFree App Icons

Files:

- `icons/icon-192.svg`
- `icons/icon-512.svg`

These are local SVG icons based on EchoFree's existing dark green and mint visual identity. They are referenced by the manifest and also used by the document as a favicon and Apple touch icon.

An icon is not just decoration for a PWA. Operating systems use it in:

- installed application shortcuts
- launcher menus
- browser install prompts
- home-screen entries
- task switchers

The important design rule is that icons must be local. EchoFree does not download branding assets from a remote server.

## 4. Service Worker

File: `service-worker.js`

A service worker is a background browser script that can intercept network requests for the site. EchoFree uses it only for the static application shell.

The cached shell includes:

- `index.html`
- `src/styles.css`
- JavaScript modules
- `manifest.webmanifest`
- local icon files

The cache has a version name:

```js
const CACHE_NAME = 'echofree-app-shell-v1';
```

Changing the version is a simple way to make a future worker create a fresh cache and remove older caches during activation.

### Install phase

During installation, the service worker opens the named cache and stores the application shell:

```js
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});
```

`event.waitUntil` tells the browser that installation is not complete until the caching promise finishes.

### Activate phase

During activation, old cache versions are removed and the new worker claims available pages:

```js
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
```

This keeps stale app-shell versions from accumulating.

### Navigation fallback

For page navigations, the service worker tries the network first. If the network is unavailable, it returns the cached application entry point:

```js
fetch(request).catch(() => caches.match('./index.html'))
```

This means a previously loaded EchoFree shell can open without showing a generic network error page.

### Static resource caching

For same-origin static resources, the worker first checks Cache Storage and otherwise fetches the resource. Successful responses can be added to the app-shell cache for later use.

Only `GET` requests are handled. Other request methods are left alone.

## 5. Why Music Is Not Cached by the Service Worker

EchoFree already stores imported music in OPFS. Copying the same audio into Cache Storage would waste disk space and create two competing persistence systems.

The service worker explicitly bypasses audio requests:

```js
if (request.destination === 'audio') {
  event.respondWith(fetch(request));
  return;
}
```

The actual restored music files are loaded from OPFS by `libraryStorage.js`, converted into browser object URLs, and played by the existing HTML audio element.

The service worker handles the app shell. OPFS handles user music. IndexedDB handles music metadata.

## 6. Service Worker Registration

File: `src/pwa.js`

The browser only uses a service worker after the page registers it:

```js
navigator.serviceWorker.register('./service-worker.js', { scope: './' });
```

EchoFree checks for support first:

```js
if (!('serviceWorker' in navigator)) return null;
```

Registration is intentionally non-blocking. If registration fails, the application still starts as a normal web app.

### Update handling

The registration watches for a newly installing worker. When an update is ready, EchoFree logs that it will be available on the next reload.

It does not force an immediate page reload. This matters because an unexpected reload could interrupt active playback.

## 7. Media Session API

File: `src/audio/mediaSession.js`

The Media Session API lets a web page communicate playback information to the operating system and browser.

Supported platforms may show:

- track title
- artist
- album
- artwork
- lock-screen controls
- headset controls
- notification controls
- browser media controls

Media Session is feature-detected:

```js
if (!('mediaSession' in navigator)) {
  return { supported: false };
}
```

This keeps the API optional.

## 8. Media Session Metadata

When the current track changes, EchoFree calls `syncMetadata()`.

The bridge reads the current track from the existing application state and creates a `MediaMetadata` object:

```js
navigator.mediaSession.metadata = new MediaMetadata({
  title: track.title || 'Untitled Track',
  artist: track.artist || 'Unknown Artist',
  album: track.album || 'Unknown Album',
  artwork
});
```

Artwork is included only when the track already has local artwork. No artwork is downloaded from the internet.

The metadata is refreshed in `playTrack()` and `updatePlayerDetails()`, so it follows normal EchoFree track changes.

## 9. Media Session Actions

The bridge registers supported actions with `setActionHandler`:

- `play`
- `pause`
- `previoustrack`
- `nexttrack`
- `seekbackward`
- `seekforward`
- `seekto`

The handlers do not create a second playback system. They call the same controller and audio-engine paths used by the visible EchoFree buttons.

For example:

```js
safeHandler('nexttrack', () => onNext());
safeHandler('pause', () => onPause());
```

This keeps the existing queue, shuffle, repeat, and track-selection behavior as the source of truth.

## 10. Media Session Seeking

The seek handlers use the existing audio element duration and current time.

Backward and forward seeking use a default ten-second offset when the browser does not provide one:

```js
const offset = Number(details.seekOffset) || 10;
```

The target is clamped so it cannot go below zero or beyond the known media duration.

For `seekto`, EchoFree uses `fastSeek` when the browser exposes it. Otherwise it calls the existing audio-engine seek method.

## 11. Playback State Synchronization

The bridge listens to the existing HTML audio element:

```js
audioElement.addEventListener('play', () => syncPlaybackState('playing'));
audioElement.addEventListener('pause', () => syncPlaybackState('paused'));
audioElement.addEventListener('ended', () => syncPlaybackState('none'));
```

This means the platform state follows real audio events rather than guessed UI state.

The states mean:

- `playing`: the audio element is playing.
- `paused`: a track exists but playback is paused.
- `none`: there is no active playback.

## 12. Existing Audio Architecture Was Preserved

The existing architecture remains:

```text
Media Session or EchoFree UI
          |
          v
Existing app controller
          |
          v
Existing audio engine
          |
          v
Single HTMLAudioElement
```

No second audio element, Web Audio pipeline, streaming layer, or duplicate queue was introduced.

The old partial Media Session code was removed from `audioEngine.js` so Media Session setup has one owner: `src/audio/mediaSession.js`.

## 13. Build Script

File: `package.json`

Phase 4 added a `build` command:

```json
"build": "node --check src/app.js && node --check src/audio/audioEngine.js && node --check src/audio/mediaSession.js && node --check src/pwa.js && node --check service-worker.js"
```

`node --check` parses JavaScript without running it. This is useful for this dependency-free static project because it catches syntax errors in the application modules and service worker.

The build does not bundle or transform the app. The browser still loads the native ES modules directly.

## 14. How to Test Phase 4 Manually

1. Start the server:

   ```sh
   npm start
   ```

2. Open `http://127.0.0.1:8080/index.html` in a supported browser.
3. Open DevTools and check the Application panel.
4. Confirm the manifest is detected.
5. Confirm the service worker is installed and controlling the page after reload.
6. Import and play a local track.
7. Check the browser or operating-system media controls for metadata and playback actions.
8. Reload once so the app shell is cached.
9. Disable network access in DevTools.
10. Reload EchoFree and confirm the shell still opens.
11. Confirm the previously stored local library remains available through IndexedDB and OPFS.
12. Restore network access after testing.

## 15. Browser and Platform Limitations

- Service workers require a secure context. `localhost` and `127.0.0.1` are normally treated as secure development origins.
- PWA installation depends on browser and operating-system support.
- Media Session support differs between browsers and platforms.
- Background playback depends on the browser, operating system, power settings, and screen-lock behavior.
- OPFS and IndexedDB support varies across browsers.
- Imported audio remains local and is not copied into the service-worker cache.
- If Media Session is unavailable, visible EchoFree controls continue to work normally.

## 16. Phase 4 Files at a Glance

| File | Purpose |
| --- | --- |
| `manifest.webmanifest` | PWA identity and installation metadata |
| `service-worker.js` | App-shell caching and offline navigation fallback |
| `src/pwa.js` | Safe service-worker registration and update notice |
| `src/audio/mediaSession.js` | Optional OS/browser playback integration |
| `icons/icon-192.svg` | Local 192px app icon |
| `icons/icon-512.svg` | Local 512px app icon |
| `index.html` | Manifest, theme, favicon, and platform metadata links |
| `src/app.js` | Connects PWA and Media Session features to existing app state |
| `src/audio/audioEngine.js` | Keeps playback logic focused on the audio element |
| `package.json` | Adds the Phase 4 syntax-check build command |

## 17. Main Lessons

1. A PWA is a normal web app plus install metadata and a service worker.
2. The service worker should cache the app shell, not large user-owned media files.
3. Media Session should call existing playback code instead of duplicating it.
4. Feature detection keeps optional browser APIs from becoming hard dependencies.
5. Offline reliability depends on separating static app resources, metadata, and binary media storage.
6. Safe updates should not unexpectedly reload an active music player.

## 18. High-Contrast Color System

File: `src/styles.css`

EchoFree's visual palette was updated toward a luxury direction without changing layout or behavior. The stylesheet already used semantic CSS variables, so the color system could be migrated centrally instead of editing every component individually.

The new direction uses:

- obsidian-black surfaces for stronger contrast
- antique gold for primary actions and active states
- restrained burgundy for atmosphere and secondary emphasis
- warm ivory text for an editorial, premium hierarchy
- muted coral for destructive actions and warnings

The main palette is defined in `:root`:

```css
--bg: #080708;
--panel: #191416;
--sage: #c99b5b;
--cyan: #a96a70;
--gold: #dfb36a;
--danger: #e77970;
```

The existing variable names such as `--sage` were retained so component selectors did not need to be rewritten. The name is now a compatibility label for EchoFree's primary accent rather than a requirement that the color be muted green.

The page background combines an obsidian base with low-opacity burgundy and antique-gold radial light. This creates depth while keeping text and controls readable. The local app icons use the same obsidian, gold, and warm-ivory identity.

This approach is useful because one token change can update buttons, active navigation, track cards, focus states, player controls, and install chrome together. It also keeps future theme changes localized to the design-token block.
