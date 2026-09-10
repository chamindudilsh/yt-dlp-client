import { SearchResultItem } from '../types';
import { DEFAULT_USER_AGENT } from '../constants/app';

let cachedClientId = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
let lastClientIdFetch = Date.now();

// Format milliseconds into M:SS or H:MM:SS
function formatDuration(ms?: number): string {
  if (!ms || typeof ms !== 'number' || ms <= 0) return '';
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Get high-res 500x500 artwork URL from SoundCloud's image CDN
function getHighResArtwork(url?: string | null): string {
  if (!url) return '';
  // SoundCloud default thumbnails end with -large.jpg (100x100), change to -t500x500.jpg for 500x500
  return url.replace('-large.', '-t500x500.').replace('-badge.', '-t500x500.');
}

/**
 * Fetch and extract the active SoundCloud client_id from soundcloud.com web scripts.
 */
export async function getSoundCloudClientId(forceRefresh = false, userAgent?: string): Promise<string> {
  // If we have a cached client_id and it's less than 12 hours old, use it
  if (!forceRefresh && cachedClientId && Date.now() - lastClientIdFetch < 12 * 3600 * 1000) {
    return cachedClientId;
  }

  const effectiveUa = userAgent?.trim() || DEFAULT_USER_AGENT;

  try {
    const res = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': effectiveUa },
      signal: AbortSignal.timeout(8000)
    });
    const html = await res.text();
    const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1]);

    for (const url of scriptUrls.slice(-8).reverse()) {
      try {
        const fullUrl = url.startsWith('http') ? url : `https://soundcloud.com${url}`;
        const sRes = await fetch(fullUrl, {
          headers: { 'User-Agent': effectiveUa },
          signal: AbortSignal.timeout(5000)
        });
        const sText = await sRes.text();
        const m = sText.match(/client_id[:=]["']?([a-zA-Z0-9]{32})["']?/);
        if (m && m[1]) {
          cachedClientId = m[1];
          lastClientIdFetch = Date.now();
          return cachedClientId;
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[SoundCloud] Failed to refresh client_id dynamically, using fallback:', err);
  }

  return cachedClientId || 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
}

/**
 * Search SoundCloud tracks, playlists, and artists using SoundCloud's public v2 API.
 */
export async function searchSoundCloud(query: string, filter?: string, userAgent?: string): Promise<SearchResultItem[]> {
  const clean = query.trim();
  if (!clean) return [];

  const effectiveUa = userAgent?.trim() || DEFAULT_USER_AGENT;
  let clientId = await getSoundCloudClientId(false, effectiveUa);

  // Determine endpoint based on filter
  let endpoint = 'https://api-v2.soundcloud.com/search';
  const fil = (filter || 'all').toLowerCase().trim();

  if (fil === 'track' || fil === 'tracks' || fil === 'song') {
    endpoint = 'https://api-v2.soundcloud.com/search/tracks';
  } else if (fil === 'playlist' || fil === 'playlists' || fil === 'album') {
    endpoint = 'https://api-v2.soundcloud.com/search/playlists';
  } else if (fil === 'user' || fil === 'users' || fil === 'artist') {
    endpoint = 'https://api-v2.soundcloud.com/search/users';
  }

  const fetchUrl = `${endpoint}?q=${encodeURIComponent(clean)}&client_id=${clientId}&limit=25`;

  let response: Response;
  try {
    response = await fetch(fetchUrl, {
      headers: { 'User-Agent': effectiveUa },
      signal: AbortSignal.timeout(8000)
    });

    // If 401 Unauthorized, client_id might have rotated -> refresh once and retry
    if (response.status === 401) {
      console.warn('[SoundCloud] 401 Unauthorized with client_id, refreshing token...');
      clientId = await getSoundCloudClientId(true, effectiveUa);
      const retryUrl = `${endpoint}?q=${encodeURIComponent(clean)}&client_id=${clientId}&limit=25`;
      response = await fetch(retryUrl, {
        headers: { 'User-Agent': effectiveUa },
        signal: AbortSignal.timeout(8000)
      });
    }
  } catch (err: any) {
    console.error('[SoundCloud Search Network Error]:', err);
    return [];
  }

  if (!response.ok) {
    console.warn(`[SoundCloud Search Error]: status ${response.status}`);
    return [];
  }

  try {
    const data = await response.json();
    const collection = data.collection || [];
    const items: SearchResultItem[] = [];

    for (const item of collection) {
      if (!item) continue;
      const kind = item.kind || (endpoint.includes('/tracks') ? 'track' : endpoint.includes('/playlists') ? 'playlist' : endpoint.includes('/users') ? 'user' : 'track');

      // Track / Song
      if (kind === 'track') {
        const title = item.title || 'Untitled Track';
        const author = item.user?.username || item.user?.full_name || 'SoundCloud Artist';
        const url = item.permalink_url || `https://soundcloud.com/${item.user?.permalink || 'track'}/${item.permalink || item.id}`;
        const thumbnail = getHighResArtwork(item.artwork_url || item.user?.avatar_url);
        const duration = formatDuration(item.duration);
        const year = item.created_at ? new Date(item.created_at).getFullYear().toString() : undefined;

        items.push({
          id: `sc_${item.id}`,
          url,
          title,
          author,
          album: item.genre || undefined,
          duration,
          thumbnail,
          type: 'song',
          engine: 'soundcloud',
          year
        });
      } 
      // Playlist / Album / Set
      else if (kind === 'playlist') {
        const title = item.title || 'SoundCloud Playlist';
        const author = item.user?.username || 'SoundCloud Curator';
        const url = item.permalink_url || `https://soundcloud.com/${item.user?.permalink || 'playlist'}/${item.permalink || item.id}`;
        const thumbnail = getHighResArtwork(item.artwork_url || item.user?.avatar_url);
        const trackCount = item.track_count ? `${item.track_count} tracks` : undefined;
        const year = item.created_at ? new Date(item.created_at).getFullYear().toString() : undefined;

        items.push({
          id: `sc_pl_${item.id}`,
          url,
          title,
          author,
          duration: trackCount,
          thumbnail,
          type: 'playlist',
          engine: 'soundcloud',
          year
        });
      }
      // Artist / User
      else if (kind === 'user') {
        const title = item.username || item.full_name || 'SoundCloud Artist';
        const author = [item.city, item.country_code].filter(Boolean).join(', ') || 'Artist';
        const url = item.permalink_url || `https://soundcloud.com/${item.permalink || item.id}`;
        const thumbnail = getHighResArtwork(item.avatar_url);
        const trackCount = item.track_count ? `${item.track_count} tracks` : undefined;

        items.push({
          id: `sc_user_${item.id}`,
          url,
          title,
          author,
          duration: trackCount,
          thumbnail,
          type: 'artist',
          engine: 'soundcloud'
        });
      }
    }

    return items;
  } catch (err: any) {
    console.error('[SoundCloud Parse Error]:', err);
    return [];
  }
}
