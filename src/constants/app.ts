import pkg from '../../package.json' with { type: 'json' };

export const APP_NAME = 'yt-dlp Client';
export const APP_VERSION: string = pkg.version;
export const APP_REPO = 'chamindudilsh/yt-dlp-client';
export const APP_HOMEPAGE_URL = 'https://ytdlpc.chamindu.lk';
export const APP_PRIVACY_URL = 'https://ytdlpc.chamindu.lk/privacy';
export const APP_DISCLAIMER = 'yt-dlp Client is an independent open-source utility and is not affiliated with, endorsed by, or sponsored by any media streaming service. All product names, logos, and brands are property of their respective owners.';
export const APP_RELEASES_URL = 'https://github.com/chamindudilsh/yt-dlp-client/releases';
export const APP_LATEST_RELEASE_URL = 'https://github.com/chamindudilsh/yt-dlp-client/releases/latest';
export const APP_RELEASES_API = 'https://api.github.com/repos/chamindudilsh/yt-dlp-client/releases/latest';

export const YTDLP_RELEASES_URL = 'https://github.com/yt-dlp/yt-dlp/releases';
export const YTDLP_RELEASES_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
