import { getTrackDurationLabel } from './library.js';

export function renderLibrary(tracks, allTracks, currentIndex, onTrackClick, onDeleteTrack, onToggleFavorite, onQueueTrack, onOpenContextMenu = null) {
  const trackList = document.getElementById('trackList');
  if (!tracks.length) {
    trackList.innerHTML = '';
    return;
  }

  trackList.innerHTML = tracks.map((track, idx) => {
    const active = track.id === (allTracks[currentIndex] || {}).id;
    const readableDuration = getTrackDurationLabel(track.duration || 0);
    const title = track.title || 'Untitled Track';
    const artist = track.artist || 'Unknown Artist';
    const album = track.album || 'Unknown Album';
    const artwork = track.artwork || '';
    const favorite = Boolean(track.favorite);
    return `<article class="track-card ${active ? 'active' : ''}" data-index="${idx}" data-track-id="${escapeHtml(track.id || '')}" tabindex="0">
      <div class="track-art">
        ${artwork ? `<img src="${artwork}" alt="" class="track-image" />` : `<span class="track-art-placeholder">${(title || 'E').charAt(0).toUpperCase()}</span>`}
      </div>
      <div class="track-main">
        <div class="track-title-row">
          <span class="track-title">${escapeHtml(title)}</span>
          <span class="track-duration">${readableDuration}</span>
        </div>
        <div class="track-meta">
          <span class="track-artist">${escapeHtml(artist)}</span>
          <span class="track-sep">•</span>
          <span class="track-album">${escapeHtml(album)}</span>
        </div>
      </div>
      <div class="track-actions">
        <button class="favorite-track ${favorite ? 'favorite-active' : ''}" data-action="favorite" aria-label="${favorite ? 'Unfavorite' : 'Favorite'} ${escapeHtml(title)}" title="${favorite ? 'Unfavorite' : 'Favorite'}">
          <svg viewBox="0 0 24 24" class="heart-icon"><path d="M12 21s-8-4.8-10-8.4C1.3 10.3 3 8 5.8 8c2 0 3.4 1.1 4 2.2C10.4 9.1 11.8 8 13.8 8c2.8 0 4.5 2.3 3.8 4.6C20 16.2 12 21 12 21z" fill="${favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
        <button class="track-context" data-action="context" aria-label="Track actions for ${escapeHtml(title)}" title="Track actions">⋮</button>
        <button class="play-row" aria-label="Play ${escapeHtml(title)}">
          <svg viewBox="0 0 24 24" class="row-play-icon">
            <path d="M7 4v16l14-8z" fill="currentColor" />
          </svg>
        </button>
        <button class="delete-track" aria-label="Delete ${escapeHtml(title)}" title="Delete track">
          <svg viewBox="0 0 24 24" class="delete-icon">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="track-context-menu" hidden>
        <button class="context-menu-item" data-context="play">Play</button>
        <button class="context-menu-item" data-context="queue">Add to Queue</button>
        <button class="context-menu-item" data-context="playlist">Add to Playlist</button>
        <button class="context-menu-item" data-context="favorite">${favorite ? 'Unfavorite' : 'Favorite'}</button>
        <button class="context-menu-item danger" data-context="delete">Remove from Library</button>
      </div>
    </article>`;
  }).join('');

  trackList.querySelectorAll('.track-card').forEach(card => {
    const clickedTrack = tracks[Number(card.dataset.index)];
    const globalIndex = allTracks.findIndex(track => track.id === clickedTrack.id);

    card.addEventListener('click', event => {
      const action = event.target.closest('[data-action]');
      const contextAction = event.target.closest('[data-context]');
      if (event.target.closest('.delete-track')) {
        if (typeof onDeleteTrack === 'function') onDeleteTrack(clickedTrack.id);
        return;
      }
      if (action && action.dataset.action === 'favorite') {
        if (typeof onToggleFavorite === 'function') onToggleFavorite(clickedTrack.id);
        return;
      }
      if (action && action.dataset.action === 'context') {
        const menu = card.querySelector('.track-context-menu');
        if (menu) menu.hidden = !menu.hidden;
        return;
      }
      if (contextAction) {
        const context = contextAction.dataset.context;
        if (context === 'play' && globalIndex >= 0) onTrackClick(globalIndex);
        if (context === 'queue' && typeof onQueueTrack === 'function') onQueueTrack(clickedTrack.id);
        if (context === 'favorite' && typeof onToggleFavorite === 'function') onToggleFavorite(clickedTrack.id);
        if (context === 'delete' && typeof onDeleteTrack === 'function') onDeleteTrack(clickedTrack.id);
        if (context === 'playlist' && typeof onOpenContextMenu === 'function') onOpenContextMenu(clickedTrack.id);
        const menu = card.querySelector('.track-context-menu');
        if (menu) menu.hidden = true;
        return;
      }
      if (globalIndex >= 0) onTrackClick(globalIndex);
    });

    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (event.target.closest('.delete-track')) return;
        if (event.target.closest('[data-action]')) return;
        if (globalIndex >= 0) onTrackClick(globalIndex);
      }
    });
  });
}

function escapeHtml(value) {
  if (!value) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
