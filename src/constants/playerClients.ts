export interface PlayerClientInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  recommended?: boolean;
}

export const PLAYER_CLIENTS: PlayerClientInfo[] = [
  {
    id: 'default',
    name: 'Auto / Default',
    shortName: 'Auto',
    description: 'Let yt-dlp determine the best YouTube player client automatically.',
    badge: 'Default',
    badgeColor: 'text-slate-400 bg-slate-800/80 border-slate-700',
  },
  {
    id: 'android',
    name: 'Android Mobile App',
    shortName: 'Android',
    description: 'Official YouTube Android client persona. Highly recommended for bypassing HTTP 429, bot checks, and stream throttling.',
    badge: 'Best for Bypass',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
    recommended: true,
  },
  {
    id: 'ios',
    name: 'iOS Mobile App',
    shortName: 'iOS',
    description: 'Official YouTube iOS client persona. Fast and clean streaming URLs with minimal bot challenge interruptions.',
    badge: 'Fast & Clean',
    badgeColor: 'text-sky-400 bg-sky-950/60 border-sky-800/50',
  },
  {
    id: 'web',
    name: 'Desktop Web Browser',
    shortName: 'Web',
    description: 'Standard YouTube desktop web player. Required for PO token verification and 4K/8K AV1/VP9 codecs.',
    badge: 'Desktop',
    badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/50',
  },
  {
    id: 'mweb',
    name: 'Mobile Web (mweb)',
    shortName: 'Mobile Web',
    description: 'Mobile browser client with lightweight player footprint and alternative signature deciphering.',
    badge: 'Mobile',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/50',
  },
  {
    id: 'web_creator',
    name: 'YouTube Studio (Creator)',
    shortName: 'Studio',
    description: 'Creator Studio portal client persona with distinct authorization and metadata delivery.',
    badge: 'Studio',
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800/50',
  },
  {
    id: 'tv',
    name: 'Smart TV (Living Room)',
    shortName: 'Smart TV',
    description: 'Living Room TV client persona. Often serves direct media streams without complex script challenges.',
    badge: 'TV',
    badgeColor: 'text-teal-400 bg-teal-950/60 border-teal-800/50',
  },
  {
    id: 'tv_embedded',
    name: 'TV Embedded',
    shortName: 'TV Embed',
    description: 'Embedded TV player client used across consumer television devices.',
    badge: 'TV Embed',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/50',
  },
  {
    id: 'android_music',
    name: 'YouTube Music (Android)',
    shortName: 'YT Music',
    description: 'Dedicated YouTube Music client persona. Ideal for maximum audio bitrate and music releases.',
    badge: 'Audio',
    badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-800/50',
  },
  {
    id: 'all',
    name: 'All Clients (Multi-Fallback)',
    shortName: 'All Clients',
    description: 'Sequential fallback across iOS, Android, Desktop Web, and TV. Tries all clients until extraction succeeds.',
    badge: 'Max Resilience',
    badgeColor: 'text-yellow-400 bg-yellow-950/60 border-yellow-800/50',
  },
];

export function getPlayerClientInfo(id?: string): PlayerClientInfo {
  const found = PLAYER_CLIENTS.find(c => c.id === id);
  return found || PLAYER_CLIENTS[0];
}
