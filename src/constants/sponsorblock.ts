import { SponsorBlockCategory, SponsorBlockAction } from '../types';

export const SPONSORBLOCK_CATEGORIES: SponsorBlockCategory[] = [
  {
    id: 'sponsor',
    name: 'Sponsor',
    description: 'Paid promotion, paid referral, product placement, and direct commercial advertisements.',
    color: '#00d400',
    defaultAction: 'remove',
  },
  {
    id: 'intro',
    name: 'Intro / Intermission',
    description: 'Opening animations, title sequence screens, pause intervals, or stream intermission breaks.',
    color: '#00ffff',
    defaultAction: 'remove',
  },
  {
    id: 'outro',
    name: 'Outro / Credits',
    description: 'End credits, channel sign-off speeches, end-screen cards, and post-roll graphics.',
    color: '#0202ed',
    defaultAction: 'remove',
  },
  {
    id: 'selfpromo',
    name: 'Self-promotion',
    description: 'Creator promoting their own merchandise, Patreon, membership perks, or secondary channels.',
    color: '#ffff00',
    defaultAction: 'remove',
  },
  {
    id: 'interaction',
    name: 'Interaction Reminder',
    description: 'Explicit verbal or visual reminders to like, subscribe, ring the bell, follow, or leave comments.',
    color: '#cc00ff',
    defaultAction: 'remove',
  },
  {
    id: 'music_offtopic',
    name: 'Music: Non-Music Section',
    description: 'Portions of official music videos with no music (acting sketches, dialogue, silence, audio cues).',
    color: '#ff0000',
    defaultAction: 'off',
  },
  {
    id: 'preview',
    name: 'Preview / Recap',
    description: 'Recaps of previous episodes, teaser hooks, or preview montages of what is coming up in this video.',
    color: '#008fd6',
    defaultAction: 'off',
  },
  {
    id: 'filler',
    name: 'Filler Tangent / Jokes',
    description: 'Tangential scenes, comedic skits, or rambling moments that deviate from the primary video topic.',
    color: '#7300ff',
    defaultAction: 'off',
  },
  {
    id: 'poi_highlight',
    name: 'Highlight / Point of Interest',
    description: 'The specific highlight or climax timestamp of the video (often used with "mark" mode).',
    color: '#ffcc00',
    defaultAction: 'off',
  },
];

export interface SponsorBlockPreset {
  id: string;
  name: string;
  description: string;
  badge?: string;
  actions: Record<string, SponsorBlockAction>;
}

export const SPONSORBLOCK_PRESETS: SponsorBlockPreset[] = [
  {
    id: 'ytdlnis-default',
    name: 'YTDLnis Default (Skip All Ads)',
    description: 'Skips sponsors, intros, outros, self-promos, and interaction reminders.',
    badge: 'Popular',
    actions: {
      sponsor: 'remove',
      intro: 'remove',
      outro: 'remove',
      selfpromo: 'remove',
      interaction: 'remove',
      music_offtopic: 'off',
      preview: 'off',
      filler: 'off',
      poi_highlight: 'off',
    },
  },
  {
    id: 'sponsors-only',
    name: 'Sponsors Only (Minimal)',
    description: 'Only cuts out paid commercial endorsements; leaves creator intros and outros intact.',
    actions: {
      sponsor: 'remove',
      intro: 'off',
      outro: 'off',
      selfpromo: 'off',
      interaction: 'off',
      music_offtopic: 'off',
      preview: 'off',
      filler: 'off',
      poi_highlight: 'off',
    },
  },
  {
    id: 'music-clean',
    name: 'Music Video Clean',
    description: 'Cuts dialogue/acting skits from music videos along with sponsors and self-promos.',
    badge: 'Audio / Music',
    actions: {
      sponsor: 'remove',
      intro: 'remove',
      outro: 'remove',
      selfpromo: 'remove',
      interaction: 'remove',
      music_offtopic: 'remove',
      preview: 'off',
      filler: 'off',
      poi_highlight: 'off',
    },
  },
  {
    id: 'mark-chapters',
    name: 'Mark as Chapters Only (No Cutting)',
    description: 'Preserves the entire original video length, but embeds chapter marks so you can easily skip or view them.',
    badge: 'Non-Destructive',
    actions: {
      sponsor: 'mark',
      intro: 'mark',
      outro: 'mark',
      selfpromo: 'mark',
      interaction: 'mark',
      music_offtopic: 'mark',
      preview: 'mark',
      filler: 'mark',
      poi_highlight: 'mark',
    },
  },
  {
    id: 'skip-everything',
    name: 'Aggressive Clean (Skip All)',
    description: 'Removes every identified non-core segment including fillers, previews, and skits.',
    actions: {
      sponsor: 'remove',
      intro: 'remove',
      outro: 'remove',
      selfpromo: 'remove',
      interaction: 'remove',
      music_offtopic: 'remove',
      preview: 'remove',
      filler: 'remove',
      poi_highlight: 'remove',
    },
  },
];
