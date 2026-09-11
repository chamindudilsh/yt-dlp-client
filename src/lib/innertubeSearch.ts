import { SearchEngine, SearchResultItem } from '../types';
import { DEFAULT_USER_AGENT } from '../constants/app';

/**
 * Searches standard YouTube or YouTube Music via InnerTube API.
 * High performance (~150-250ms), zero dependency, rich metadata.
 */
export async function searchInnerTube(
  query: string,
  engine: SearchEngine = 'youtube',
  filter?: string,
  userAgent?: string
): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const effectiveUserAgent = userAgent?.trim() || DEFAULT_USER_AGENT;

  if (engine === 'ytmusic') {
    return searchYouTubeMusic(cleanQuery, filter, effectiveUserAgent);
  }
  return searchYouTube(cleanQuery, filter, effectiveUserAgent);
}

async function searchYouTube(query: string, filter?: string, userAgent: string = DEFAULT_USER_AGENT): Promise<SearchResultItem[]> {
  try {
    let params: string | undefined = undefined;
    if (filter === 'video') params = 'EgIQAQ%3D%3D';
    else if (filter === 'playlist') params = 'EgIQAw%3D%3D';
    else if (filter === 'channel') params = 'EgIQAg%3D%3D';

    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20260910.01.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query,
        params
      })
    });

    if (!res.ok) {
      throw new Error(`YouTube search returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const primaryContents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const results: SearchResultItem[] = [];

    for (const section of primaryContents) {
      const itemSection = section?.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        if (item.videoRenderer) {
          const vr = item.videoRenderer;
          const id = vr.videoId;
          if (!id) continue;

          const title = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || 'Untitled Video';
          const author = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'YouTube Creator';
          const duration = vr.lengthText?.simpleText || undefined;
          const views = vr.shortViewCountText?.simpleText || vr.viewCountText?.simpleText || undefined;
          const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

          results.push({
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title,
            author,
            duration,
            views,
            thumbnail,
            type: 'video',
            engine: 'youtube'
          });
        } else if (item.playlistRenderer) {
          const pr = item.playlistRenderer;
          const id = pr.playlistId;
          if (!id) continue;

          const title = pr.title?.simpleText || pr.title?.runs?.map((r: any) => r.text).join('') || 'Playlist';
          const author = pr.shortBylineText?.runs?.[0]?.text || 'YouTube';
          const duration = pr.videoCount ? `${pr.videoCount} videos` : undefined;
          const views = pr.viewCountText?.simpleText || undefined;
          const thumbnail = pr.thumbnails?.[0]?.thumbnails?.slice(-1)[0]?.url;

          results.push({
            id,
            url: `https://www.youtube.com/playlist?list=${id}`,
            title,
            author,
            duration,
            views,
            thumbnail,
            type: 'playlist',
            engine: 'youtube'
          });
        } else if (item.channelRenderer) {
          const cr = item.channelRenderer;
          const id = cr.channelId;
          if (!id) continue;

          const title = cr.title?.simpleText || cr.title?.runs?.map((r: any) => r.text).join('') || 'Channel';
          const author = cr.subscriberCountText?.simpleText || 'YouTube Creator';
          const duration = cr.videoCountText?.simpleText || undefined;
          const thumbnail = cr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

          results.push({
            id,
            url: `https://www.youtube.com/channel/${id}`,
            title,
            author,
            duration,
            views: cr.subscriberCountText?.simpleText || undefined,
            thumbnail,
            type: 'artist',
            engine: 'youtube'
          });
        } else if (item.lockupViewModel) {
          const lm = item.lockupViewModel;
          const id = lm.contentId;
          if (!id) continue;

          const title = lm.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled';
          const metaRows = lm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
          let author = 'YouTube';
          let duration: string | undefined = undefined;
          let views: string | undefined = undefined;
          if (metaRows.length > 0) {
            const firstParts = metaRows[0]?.metadataParts || [];
            if (firstParts.length > 0) author = firstParts[0]?.text?.content || 'YouTube';
            for (let i = 1; i < firstParts.length; i++) {
              const partText = firstParts[i]?.text?.content;
              if (!partText) continue;
              if (/views?|subscribers?|plays?/i.test(partText)) {
                views = partText;
              } else if (!duration && /^\d+:\d+/.test(partText)) {
                duration = partText;
              }
            }
          }

          let thumbnail: string | undefined = undefined;
          const colThumb = lm.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources;
          if (Array.isArray(colThumb) && colThumb.length > 0) {
            thumbnail = colThumb[colThumb.length - 1]?.url;
          } else {
            const sources = lm.contentImage?.thumbnailViewModel?.image?.sources;
            if (Array.isArray(sources) && sources.length > 0) {
              thumbnail = sources[sources.length - 1]?.url;
            }
          }

          const isPlaylist = lm.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' || id.startsWith('PL') || id.startsWith('OLAK');
          const isChannel = id.startsWith('UC');
          const finalUrl = isPlaylist
            ? `https://www.youtube.com/playlist?list=${id}`
            : isChannel
            ? `https://www.youtube.com/channel/${id}`
            : `https://www.youtube.com/watch?v=${id}`;

          results.push({
            id,
            url: finalUrl,
            title,
            author,
            duration,
            views,
            thumbnail,
            type: isPlaylist ? 'playlist' : isChannel ? 'artist' : 'video',
            engine: 'youtube'
          });
        }
      }
    }

    return results;
  } catch (err: any) {
    console.warn('[InnerTube YouTube Error]:', err?.message || err);
    return [];
  }
}

/**
 * Parses a YouTube Music responsive list item into a standardized SearchResultItem.
 */
function parseMusicResponsiveItem(r: any, filter?: string): SearchResultItem | null {
  if (!r) return null;

  const col0Runs = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const title = col0Runs.map((x: any) => x.text).join('').trim();

  const videoId = r.playlistItemData?.videoId ||
    col0Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
    r.navigationEndpoint?.watchEndpoint?.videoId ||
    r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
  const browseId = r.navigationEndpoint?.browseEndpoint?.browseId ||
    col0Runs[0]?.navigationEndpoint?.browseEndpoint?.browseId;
  const playlistId = r.menu?.menuRenderer?.items?.find((m: any) =>
    m.toggleMenuServiceItemRenderer?.defaultServiceEndpoint?.likeEndpoint?.target?.playlistId
  )?.toggleMenuServiceItemRenderer?.defaultServiceEndpoint?.likeEndpoint?.target?.playlistId ||
    r.navigationEndpoint?.watchEndpoint?.playlistId;

  const finalId = videoId || playlistId || browseId;
  if (!title || !finalId) return null;

  const allRuns: any[] = [];
  if (r.flexColumns) {
    for (let i = 1; i < r.flexColumns.length; i++) {
      const runs = r.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      for (const run of runs) allRuns.push(run);
    }
  }
  if (r.fixedColumns) {
    for (const c of r.fixedColumns) {
      const runs = c?.musicResponsiveListItemFixedColumnRenderer?.text?.runs || [];
      for (const run of runs) allRuns.push(run);
    }
  }

  let duration: string | undefined = undefined;
  let year: string | undefined = undefined;
  let views: string | undefined = undefined;
  let detectedType: 'song' | 'video' | 'album' | 'playlist' | 'artist' | undefined = undefined;
  let album: string | undefined = undefined;
  const artists: string[] = [];
  const unclassified: string[] = [];

  for (const run of allRuns) {
    const text = (run.text || '').trim();
    if (!text || text === '•' || text === '&' || text === ',') continue;

    const pageType = run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    const itemBrowseId = run.navigationEndpoint?.browseEndpoint?.browseId || '';

    // Duration (e.g. 3:45 or 1:24:49)
    if (/^\d+:\d{2}(:\d{2})?$/.test(text)) {
      duration = text;
      continue;
    }

    // Year (e.g. 2024, 1989)
    if (/^(19\d\d|20\d\d)$/.test(text)) {
      year = text;
      continue;
    }

    // Views / Plays / Audience (e.g. "683M plays", "9.9M views", "457M monthly audience", "12K views")
    if (/(plays?|views?|audience|listeners?|subscribers?)/i.test(text)) {
      views = text;
      continue;
    }

    // Category / Type token
    const lower = text.toLowerCase();
    if (['song', 'video', 'album', 'single', 'ep', 'playlist', 'artist'].includes(lower)) {
      if (lower === 'song') detectedType = 'song';
      else if (lower === 'video') detectedType = 'video';
      else if (lower === 'album' || lower === 'single' || lower === 'ep') detectedType = 'album';
      else if (lower === 'playlist') detectedType = 'playlist';
      else if (lower === 'artist') detectedType = 'artist';
      continue;
    }

    // Browse Page Type
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL' || itemBrowseId.startsWith('UC')) {
      artists.push(text);
      continue;
    }
    if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || itemBrowseId.startsWith('MPRE')) {
      album = text;
      continue;
    }

    unclassified.push(text);
  }

  let author = '';
  if (artists.length > 0) {
    author = artists.join(', ');
    if (!album && unclassified.length > 0) album = unclassified[0];
  } else if (unclassified.length > 0) {
    author = unclassified[0];
    if (!album && unclassified.length > 1) album = unclassified[1];
  }

  let itemType = detectedType;
  if (filter === 'song') itemType = 'song';
  else if (filter === 'video') itemType = 'video';
  else if (filter === 'album') itemType = 'album';
  else if (filter === 'playlist') itemType = 'playlist';
  else if (filter === 'artist') itemType = 'artist';
  else if (!itemType) {
    if (videoId) itemType = 'song';
    else if (String(finalId).startsWith('UC')) itemType = 'artist';
    else if (String(finalId).startsWith('VL') || String(finalId).startsWith('MPRE') || String(finalId).startsWith('OLAK')) itemType = 'playlist';
    else itemType = 'song';
  }

  if (itemType === 'artist' && (!author || author === title)) {
    author = 'Artist';
  }

  const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;
  const isAlbumOrPlaylist = itemType === 'album' || itemType === 'playlist' || String(finalId).startsWith('VL') || String(finalId).startsWith('MPRE') || String(finalId).startsWith('OLAK');

  let url = `https://music.youtube.com/watch?v=${finalId}`;
  if (videoId) {
    url = `https://music.youtube.com/watch?v=${videoId}`;
  } else if (playlistId) {
    url = `https://music.youtube.com/playlist?list=${playlistId}`;
  } else if (isAlbumOrPlaylist) {
    url = `https://music.youtube.com/playlist?list=${String(finalId).replace(/^VL/, '')}`;
  } else {
    url = `https://music.youtube.com/browse/${finalId}`;
  }

  return {
    id: finalId,
    url,
    title,
    author: author || 'Unknown Artist',
    album,
    year,
    duration,
    views,
    thumbnail: thumb,
    type: itemType,
    engine: 'ytmusic'
  };
}

async function searchYouTubeMusic(query: string, filter?: string, userAgent: string = DEFAULT_USER_AGENT): Promise<SearchResultItem[]> {
  try {
    let params: string | undefined = undefined;
    if (filter === 'song') params = 'EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D';
    else if (filter === 'video') params = 'EgWKAQIQAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D';
    else if (filter === 'album') params = 'EgWKAQIYAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D';
    else if (filter === 'playlist') params = 'EgWKAQIoAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D';
    else if (filter === 'artist') params = 'EgWKAQIgAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D';

    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20260908.14.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query,
        params
      })
    });

    if (!res.ok) {
      throw new Error(`YouTube Music search returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const secList = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const results: SearchResultItem[] = [];

    const addResult = (item: SearchResultItem) => {
      const existing = results.find(x => x.id === item.id);
      if (existing) {
        if (!existing.duration && item.duration) existing.duration = item.duration;
        if (!existing.album && item.album) existing.album = item.album;
        if (!existing.year && item.year) existing.year = item.year;
        if (!existing.views && item.views) existing.views = item.views;
        if (!existing.thumbnail && item.thumbnail) existing.thumbnail = item.thumbnail;
        return;
      }
      results.push(item);
    };

    for (const sec of secList) {
      // 1. Top Card Result if present
      if (sec.musicCardShelfRenderer) {
        const card = sec.musicCardShelfRenderer;
        const col0Runs = card.title?.runs || [];
        const cardTitle = col0Runs.map((r: any) => r.text).join('').trim();
        const cardVideoId = col0Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
          card.buttons?.[0]?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId ||
          card.onTap?.watchEndpoint?.videoId;
        const cardBrowseId = col0Runs[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          card.onTap?.browseEndpoint?.browseId;
        const id = cardVideoId || cardBrowseId;

        if (cardTitle && id) {
          const cardSubtitleRuns = card.subtitle?.runs || [];
          let cardDuration: string | undefined = undefined;
          let cardYear: string | undefined = undefined;
          let cardViews: string | undefined = undefined;
          let cardType: 'song' | 'video' | 'album' | 'playlist' | 'artist' | undefined = undefined;
          const cardArtists: string[] = [];
          const cardUnclassified: string[] = [];

          for (const r of cardSubtitleRuns) {
            const text = (r.text || '').trim();
            if (!text || text === '•') continue;
            if (/^\d+:\d{2}(:\d{2})?$/.test(text)) {
              cardDuration = text;
              continue;
            }
            if (/^(19\d\d|20\d\d)$/.test(text)) {
              cardYear = text;
              continue;
            }
            if (/(plays?|views?|audience|listeners?|subscribers?)/i.test(text)) {
              cardViews = text;
              continue;
            }
            const lower = text.toLowerCase();
            if (['song', 'video', 'album', 'single', 'ep', 'playlist', 'artist'].includes(lower)) {
              if (lower === 'song') cardType = 'song';
              else if (lower === 'video') cardType = 'video';
              else if (lower === 'album' || lower === 'single' || lower === 'ep') cardType = 'album';
              else if (lower === 'playlist') cardType = 'playlist';
              else if (lower === 'artist') cardType = 'artist';
              continue;
            }
            const pageType = r.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
            if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL' || r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC')) {
              cardArtists.push(text);
              continue;
            }
            cardUnclassified.push(text);
          }

          let cardAuthor = cardArtists.join(', ') || cardUnclassified[0] || (cardType === 'artist' ? 'Artist' : 'Unknown Artist');
          if (cardType === 'artist' && (!cardAuthor || cardAuthor === cardTitle)) {
            cardAuthor = 'Artist';
          }
          if (!cardType) {
            cardType = cardVideoId ? 'song' : (String(id).startsWith('UC') ? 'artist' : 'playlist');
          }

          const cardThumb = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;
          const isPlaylist = String(id).startsWith('VL') || String(id).startsWith('MPRE') || String(id).startsWith('OLAK');
          const finalUrl = cardVideoId
            ? `https://music.youtube.com/watch?v=${cardVideoId}`
            : isPlaylist
            ? `https://music.youtube.com/playlist?list=${String(id).replace(/^VL/, '')}`
            : `https://music.youtube.com/browse/${id}`;

          addResult({
            id,
            url: finalUrl,
            title: cardTitle,
            author: cardAuthor,
            year: cardYear,
            duration: cardDuration,
            views: cardViews,
            thumbnail: cardThumb,
            type: cardType,
            engine: 'ytmusic'
          });
        }

        // Also extract related tracks/albums inside card.contents if present
        if (Array.isArray(card.contents)) {
          for (const c of card.contents) {
            const parsed = parseMusicResponsiveItem(c.musicResponsiveListItemRenderer, filter);
            if (parsed) addResult(parsed);
          }
        }
      }

      // 2. Responsive List Items
      const list = sec.musicShelfRenderer?.contents || sec.itemSectionRenderer?.contents || [];
      for (const it of list) {
        const parsed = parseMusicResponsiveItem(it.musicResponsiveListItemRenderer, filter);
        if (parsed) addResult(parsed);
      }
    }

    return results;
  } catch (err: any) {
    console.warn('[InnerTube YouTube Music Error]:', err?.message || err);
    return [];
  }
}
