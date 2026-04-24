import { BlockType } from './types';

export const BLOCK_META: Record<BlockType, { icon: string; desc: string }> = {
  'greeting':      { icon: '\u{1F44B}', desc: 'Personalized greeting with time of day' },
  'clock':         { icon: '\u{1F550}', desc: 'Live clock with date display' },
  'folder-links':  { icon: '\u{1F517}', desc: 'Quick links to notes and folders' },
  'button-grid':   { icon: '\u{1F532}', desc: 'Grid of emoji-labeled buttons' },
  'quotes-list':   { icon: '\u{1F4AC}', desc: 'Collection of quotes from notes' },
  'image-gallery': { icon: '\u{1F5BC}️', desc: 'Photo grid from a vault folder' },
  'embedded-note': { icon: '\u{1F4C4}', desc: 'Render a note inline on the page' },
  'static-text':   { icon: '\u{1F4DD}', desc: 'Markdown text block you write directly' },
  'html':          { icon: '</>', desc: 'Custom HTML content (sanitized)' },
  'video-embed':   { icon: '\u{1F3AC}', desc: 'Embed YouTube, Vimeo, or other videos' },
  'bookmarks':     { icon: '\u{1F516}', desc: 'Web links and vault bookmarks grid' },
  'recent-files':  { icon: '\u{1F4C2}', desc: 'Recently modified notes in your vault' },
  'pomodoro':      { icon: '\u{1F345}', desc: 'Pomodoro timer with work/break cycles' },
  'spacer':        { icon: '⬜', desc: 'Empty space for layout spacing' },
  'random-note':   { icon: '\u{1F3B2}', desc: 'Random note card with cover image and preview' },
  'voice-dictation': { icon: '🎙️', desc: 'Record voice notes saved automatically to a folder' },
  'vault-search':  { icon: '\u{1F50D}', desc: 'Search notes by name with live results' },
};
