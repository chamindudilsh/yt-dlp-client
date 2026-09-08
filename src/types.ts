export type MediaType = 'video' | 'audio';

export interface ExtractedFormat {
  format_id: string;
  ext: string;
  resolution: string;
  height?: number;
  fps?: number;
  filesize?: number;
  tbr?: number;
  vcodec?: string;
  acodec?: string;
  format_note?: string;
  isAudioOnly?: boolean;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration_string: string;
  uploader?: string;
  thumbnail: string;
  selected: boolean;
}

export interface ExtractedMedia {
  isPlaylist: boolean;
  id?: string;
  title: string;
  uploader?: string;
  channel_id?: string;
  duration_string?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
  upload_date?: string;
  tags?: string[];
  description?: string;
  subtitles?: string[];
  formats?: ExtractedFormat[];
  entries?: PlaylistEntry[];
  entriesCount?: number;
  isBotGuard?: boolean;
  botGuardMessage?: string;
}

export interface SubtitleOptions {
  enabled: boolean;
  langs: string;
  embed: boolean;
  keepSubs?: boolean;
  autoSubs: boolean;
  writeAutoSubs?: boolean;
  format?: 'srt' | 'vtt' | 'ass' | 'best';
}

export type SponsorBlockAction = 'remove' | 'mark' | 'off';

export interface SponsorBlockCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultAction: SponsorBlockAction;
}

export interface SponsorBlockOptions {
  enabled: boolean;
  categories: string[];
  action: 'remove' | 'mark';
  categoryActions: Record<string, SponsorBlockAction>;
  apiUrl?: string;
}

export interface CustomAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  track?: string;
}

export interface AuthOptions {
  cookieSource: 'none' | 'browser' | 'file' | 'text';
  browser?: 'chrome' | 'firefox' | 'edge' | 'brave' | 'chromium' | 'opera' | 'vivaldi' | 'safari';
  browserProfile?: string;
  cookieContent?: string;
  cookieFile?: string;
  poToken?: string;
  visitorData?: string;
  playerClient?: 'default' | 'web' | 'ios' | 'android' | 'mweb' | 'web_creator' | 'tv';
  enablePoToken?: boolean;
}

export interface TaskOptions {
  downloadDir?: string;
  namingTemplate: string;
  subtitles: SubtitleOptions;
  sponsorblock: SponsorBlockOptions;
  audioCropThumbnailSquare: boolean;
  cropFocus?: 'center' | 'left' | 'right';
  embedMetadata: boolean;
  customMetadata?: CustomAudioMetadata;
  simplifyFileSelection?: boolean;
  defaultVideoQuality?: string;
  defaultVideoFormat?: string;
  defaultAudioFormat?: string;
  defaultMediaType?: MediaType;
  auth?: AuthOptions;
  upscaleHeight?: number;
}

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: string;
  type: MediaType;
  format: string;
  status: 'queued' | 'fetching' | 'downloading' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  speed: string;
  eta: string;
  totalSize: string;
  downloadedSize: string;
  filename?: string;
  filepath?: string;
  logs: string[];
  error?: string;
  fullError?: string;
  createdAt: number;
  completedAt?: number;
  options: TaskOptions;
  upscaleHeight?: number;
}

export interface SystemStatus {
  status: string;
  version: string;
  ffmpeg: boolean;
  ffprobe?: boolean;
  ffprobeVersion?: string;
  ytdlp_installed?: boolean;
  ffmpeg_installed?: boolean;
  portableMode: boolean;
  downloadDir: string;
  activeTasks: number;
  queuedTasks: number;
  totalDownloads: number;
  os: string;
}

export interface MediaProbeVideoStream {
  codec: string;
  codecLong: string;
  width: number;
  height: number;
  resolution: string;
  aspectRatio: string;
  fps: number;
  pixelFormat: string;
  bitRateKbps?: number;
}

export interface MediaProbeAudioStream {
  codec: string;
  codecLong: string;
  sampleRate: number;
  channels: number;
  channelLayout: string;
  bitRateKbps?: number;
}

export interface MediaProbeInfo {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sizeFormatted: string;
  formatName: string;
  formatLongName: string;
  durationSeconds: number;
  durationFormatted: string;
  bitRateKbps: number;
  video?: MediaProbeVideoStream;
  audio?: MediaProbeAudioStream;
  hasCoverArt: boolean;
  tags: Record<string, string>;
  chapterCount: number;
  isValid: boolean;
  error?: string;
  rawStreams?: any[];
  rawFormat?: any;
}

export interface AppReleaseAsset {
  name: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
  contentType?: string;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseTag: string;
  releaseUrl: string;
  publishedAt?: string;
  releaseNotes: string;
  assets: AppReleaseAsset[];
  checkedAt?: string;
  error?: string;
}

export interface EngineUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
  releaseUrl: string;
  checkedAt?: string;
  error?: string;
}

export interface UpdateInfo extends EngineUpdateInfo {}

export interface DownloadedFile {
  name: string;
  size: string;
  sizeBytes: number;
  mtime: string;
  type: 'video' | 'audio' | 'other';
  downloadUrl: string;
  filepath?: string;
}

export interface DownloadDirInfo {
  current: string;
  configured: string;
  defaultDir: string;
  fallbackDir: string;
  isCustom: boolean;
  exists: boolean;
}

export type SearchEngine = 'youtube' | 'ytmusic' | 'soundcloud';

export interface SearchResultItem {
  id: string;
  url: string;
  title: string;
  author: string;
  album?: string;
  duration?: string;
  thumbnail?: string;
  type: 'video' | 'song' | 'album' | 'playlist' | 'artist';
  engine: SearchEngine;
  year?: string;
}
