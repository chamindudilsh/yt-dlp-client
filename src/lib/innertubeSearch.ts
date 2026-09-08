import { SearchEngine, SearchResultItem } from '../types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Searches standard YouTube or YouTube Music via InnerTube API.
 * High performance (~150-250ms), zero dependency, rich metadata.
 */
export async function searchInnerTube(
  query: string,
  engine: SearchEngine = 'youtube',
  filter?: string
): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  if (engine === 'ytmusic') {
    return searchYouTubeMusic(cleanQuery, filter);
  }
  return searchYouTube(cleanQuery, filter);
}

async function searchYouTube(query: string, filter?: string): Promise<SearchResultItem[]> {
  try {
    let params: string | undefined = undefined;
    if (filter === 'video') params = 'EgIQAQ%3D%3D';
    else if (filter === 'playlist') params = 'EgIQAw%3D%3D';
    else if (filter === 'channel') params = 'EgIQAg%3D%3D';

    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240826.01.00',
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
          const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

          results.push({
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title,
            author,
            duration,
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
          const thumbnail = pr.thumbnails?.[0]?.thumbnails?.slice(-1)[0]?.url;

          results.push({
            id,
            url: `https://www.youtube.com/playlist?list=${id}`,
            title,
            author,
            duration,
            thumbnail,
            type: 'playlist',
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

async function searchYouTubeMusic(query: string, filter?: string): Promise<SearchResultItem[]> {
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
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240826.01.00',
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

    for (const sec of secList) {
      // 1. Top Card Result if present
      if (sec.musicCardShelfRenderer) {
        const card = sec.musicCardShelfRenderer;
        const col1Runs = card.title?.runs || [];
        const cardTitle = col1Runs.map((r: any) => r.text).join('').trim();
        const cardVideoId = col1Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
          card.buttons?.[0]?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
        const cardBrowseId = col1Runs[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        const cardSubtitleRuns = card.subtitle?.runs || [];
        const cardAuthor = cardSubtitleRuns.filter((r: any) => r.text !== ' • ').map((r: any) => r.text).join(' - ') || 'Artist';
        const cardThumb = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

        if (cardTitle && (cardVideoId || cardBrowseId)) {
          const id = cardVideoId || cardBrowseId;
          const isPlaylist = String(id).startsWith('VL') || String(id).startsWith('MPRE');
          const finalUrl = cardVideoId
            ? `https://music.youtube.com/watch?v=${cardVideoId}`
            : isPlaylist
            ? `https://music.youtube.com/playlist?list=${String(id).replace(/^VL/, '')}`
            : `https://music.youtube.com/browse/${id}`;

          results.push({
            id,
            url: finalUrl,
            title: cardTitle,
            author: cardAuthor,
            thumbnail: cardThumb,
            type: cardVideoId ? 'song' : (isPlaylist ? 'playlist' : 'artist'),
            engine: 'ytmusic'
          });
        }
      }

      // 2. Responsive List Items
      const list = sec.musicShelfRenderer?.contents || sec.itemSectionRenderer?.contents || [];
      for (const it of list) {
        const r = it.musicResponsiveListItemRenderer;
        if (!r) continue;

        const col1 = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const col2 = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const col3 = r.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

        const title = col1.map((x: any) => x.text).join('').trim();
        const rawRuns = col2.map((x: any) => x.text).filter((x: any) => x !== ' • ');

        const videoId = r.playlistItemData?.videoId ||
          col1[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
          r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
        const browseId = col1[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

        if (!title || (!videoId && !browseId)) continue;

        const firstToken = (rawRuns[0] || '').toLowerCase();
        let itemType: 'song' | 'video' | 'album' | 'playlist' | 'artist' = 'song';
        if (firstToken.includes('video')) itemType = 'video';
        else if (firstToken.includes('album') || firstToken.includes('ep') || firstToken.includes('single')) itemType = 'album';
        else if (firstToken.includes('playlist')) itemType = 'playlist';
        else if (firstToken.includes('artist')) itemType = 'artist';

        let author = rawRuns[1] || rawRuns[0] || 'Artist';
        let album: string | undefined = undefined;
        let year: string | undefined = undefined;

        for (const token of rawRuns) {
          if (/^\d{4}$/.test(token)) {
            year = token;
          }
        }

        if (rawRuns.length >= 3 && !/^\d{4}$/.test(rawRuns[2])) {
          album = rawRuns[2];
        }

        let duration: string | undefined = undefined;
        const col3Text = col3.map((x: any) => x.text).join('').trim();
        if (/^\d+:\d+$/.test(col3Text)) {
          duration = col3Text;
        }

        const finalId = videoId || browseId;
        const isAlbumOrPlaylist = itemType === 'album' || itemType === 'playlist' || String(finalId).startsWith('VL') || String(finalId).startsWith('MPRE');

        let url = `https://music.youtube.com/watch?v=${finalId}`;
        if (videoId) {
          url = `https://music.youtube.com/watch?v=${videoId}`;
        } else if (isAlbumOrPlaylist) {
          url = `https://music.youtube.com/playlist?list=${String(finalId).replace(/^VL/, '')}`;
        } else {
          url = `https://music.youtube.com/browse/${finalId}`;
        }

        results.push({
          id: finalId,
          url,
          title,
          author,
          album,
          year,
          duration,
          thumbnail: thumb,
          type: itemType,
          engine: 'ytmusic'
        });
      }
    }

    return results;
  } catch (err: any) {
    console.warn('[InnerTube YouTube Music Error]:', err?.message || err);
    return [];
  }
}
