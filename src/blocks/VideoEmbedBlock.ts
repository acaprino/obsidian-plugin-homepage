import { App, Modal, Setting } from 'obsidian';
import { BaseBlock } from './BaseBlock';

const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_ORIGIN = 'https://www.youtube.com';

interface EmbedInfo {
  type: 'video' | 'playlist';
  /** For single videos: video ID (YouTube) or full embed URL. For playlists: playlist ID. */
  value: string;
  /** If a playlist URL also references a specific video. */
  videoId?: string;
}

function validListId(raw: string | null): string | null {
  return raw && PLAYLIST_ID_RE.test(raw) ? raw : null;
}

function parseUrl(raw: string): EmbedInfo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try { url = new URL(trimmed); } catch { return null; }

  // ── YouTube ──────────────────────────────────────────────
  if (/^(www\.)?youtube\.com$/i.test(url.hostname)) {
    const listId = validListId(url.searchParams.get('list'));

    if (url.pathname === '/playlist' && listId) {
      return { type: 'playlist', value: listId };
    }

    const videoId = url.searchParams.get('v')
      || url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})(?:[?/]|$)/)?.[1];

    if (videoId && YT_VIDEO_ID_RE.test(videoId)) {
      if (listId) return { type: 'playlist', value: listId, videoId };
      return { type: 'video', value: videoId };
    }

    if (listId) return { type: 'playlist', value: listId };
  }

  if (/^youtu\.be$/i.test(url.hostname)) {
    const id = url.pathname.slice(1);
    if (YT_VIDEO_ID_RE.test(id)) {
      const listId = validListId(url.searchParams.get('list'));
      if (listId) return { type: 'playlist', value: listId, videoId: id };
      return { type: 'video', value: id };
    }
  }

  // ── Vimeo ────────────────────────────────────────────────
  if (/^(www\.)?vimeo\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/^\/(\d+)/)?.[1];
    if (id) return { type: 'video', value: `https://player.vimeo.com/video/${id}` };
  }

  // ── Dailymotion ──────────────────────────────────────────
  if (/^(www\.)?dailymotion\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/^\/video\/([A-Za-z0-9]+)/)?.[1];
    if (id) return { type: 'video', value: `https://www.dailymotion.com/embed/video/${id}` };
  }

  return null;
}

function buildEmbedSrc(info: EmbedInfo, shuffleOnLoad: boolean): string {
  if (info.type === 'video') {
    return YT_VIDEO_ID_RE.test(info.value)
      ? `${YT_ORIGIN}/embed/${info.value}`
      : info.value;
  }
  const params = new URLSearchParams({ list: info.value });
  if (shuffleOnLoad) params.set('shuffle', '1');
  const base = info.videoId
    ? `${YT_ORIGIN}/embed/${info.videoId}`
    : `${YT_ORIGIN}/embed/videoseries`;
  return `${base}?${params.toString()}`;
}

// SECURITY: only allow known embed providers in the iframe src.
const ALLOWED_EMBED_HOSTS =
  /^(?:www\.)?youtube\.com$|^player\.vimeo\.com$|^www\.dailymotion\.com$/;

export class VideoEmbedBlock extends BaseBlock {

  render(el: HTMLElement): void {
    el.addClass('video-embed-block');

    const { url = '', shuffleOnLoad = false } = this.instance.config as {
      url?: string;
      shuffleOnLoad?: boolean;
    };

    this.renderHeader(el, 'Video');

    const wrapper = el.createDiv({ cls: 'video-embed-inner' });
    const info = parseUrl(url);

    if (!info) {
      const container = wrapper.createDiv({ cls: 'video-embed-container' });
      container.addClass('hp-no-padding-bottom');
      const hint = container.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '\u{1F3AC}' });
      hint.createDiv({
        cls: 'block-empty-hint-text',
        text: 'No video URL. Paste a YouTube, Vimeo, or Dailymotion link in settings.',
      });
      return;
    }

    const src = buildEmbedSrc(info, shuffleOnLoad);
    const container = wrapper.createDiv({ cls: 'video-embed-container' });

    try {
      const host = new URL(src).hostname;
      if (!ALLOWED_EMBED_HOSTS.test(host)) {
        console.warn('[Homepage Blocks] Blocked iframe src from host:', host);
        container.setText('Video source blocked for security reasons.');
        return;
      }
    } catch {
      container.setText('Invalid video URL.');
      return;
    }

    container.createEl('iframe', {
      cls: 'video-embed-iframe',
      attr: {
        src,
        title: 'Embedded video',
        frameborder: '0',
        // Keep this minimal — only what YouTube/Vimeo/Dailymotion actually need to play.
        // Notably omitting clipboard-write so the embedded page can't silently overwrite the clipboard.
        allow: 'autoplay; encrypted-media; picture-in-picture',
        allowfullscreen: '',
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
        // SECURITY: allow-same-origin + allow-scripts is required by YouTube/Vimeo/
        // Dailymotion embeds. Safe because ALLOWED_EMBED_HOSTS ensures these are always
        // cross-origin to the Obsidian app:// origin. Do NOT add same-origin hosts.
        sandbox: 'allow-same-origin allow-scripts allow-popups allow-presentation',
      },
    });
  }

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new VideoEmbedSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class VideoEmbedSettingsModal extends Modal {
  constructor(
    app: App,
    private config: Record<string, unknown>,
    private onSave: (cfg: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Video embed settings').setHeading();

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Video or playlist link')
      .setDesc('Paste a video or playlist link from any supported platform.')
      .addText(t =>
        t.setValue(draft.url as string ?? '')
         .setPlaceholder('https://www.youtube.com/watch?v=...')
         .onChange(v => { draft.url = v; }),
      );

    new Setting(contentEl)
      .setName('Shuffle on load')
      .setDesc('Start at a random video each time the homepage opens. Only works with playlists.')
      .addToggle(t =>
        t.setValue(Boolean(draft.shuffleOnLoad))
         .onChange(v => { draft.shuffleOnLoad = v; }),
      );

    new Setting(contentEl).addButton(btn =>
      btn.setButtonText('Save').setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      }),
    );
  }

  onClose(): void { this.contentEl.empty(); }
}
