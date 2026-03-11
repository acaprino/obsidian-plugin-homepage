import { App, Modal, Setting, setIcon } from 'obsidian';
import { BaseBlock } from './BaseBlock';

interface EmbedInfo {
  type: 'video' | 'playlist';
  /** For single videos: full embed URL. For playlists: playlist ID. */
  value: string;
  /** If a playlist URL also contains a specific video ID. */
  videoId?: string;
}

const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_ORIGIN = 'https://www.youtube.com';

/** YouTube error codes that mean "embedding disabled". */
const YT_EMBED_BLOCKED_ERRORS = new Set([101, 150]);

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

/** Build a YouTube embed URL with enablejsapi for postMessage communication. */
function ytEmbedUrl(videoId: string, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ enablejsapi: '1', ...extraParams });
  return `${YT_ORIGIN}/embed/${videoId}?${params.toString()}`;
}

function playlistEmbedUrl(listId: string, opts?: {
  index?: number;
  shuffle?: boolean;
  autoplay?: boolean;
  videoId?: string;
}): string {
  const params = new URLSearchParams({ list: listId, enablejsapi: '1' });
  if (opts?.shuffle) params.set('shuffle', '1');
  if (opts?.index !== undefined) params.set('index', String(opts.index));
  if (opts?.autoplay) params.set('autoplay', '1');
  const base = opts?.videoId
    ? `${YT_ORIGIN}/embed/${opts.videoId}`
    : `${YT_ORIGIN}/embed/videoseries`;
  return `${base}?${params.toString()}`;
}

export class VideoEmbedBlock extends BaseBlock {
  private currentIndex = 0;
  private playlistLength = 0;
  private playlistVideoIds: string[] = [];
  private iframeEl: HTMLIFrameElement | null = null;

  render(el: HTMLElement): void {
    this.currentIndex = 0;
    this.playlistLength = 0;
    this.playlistVideoIds = [];
    this.iframeEl = null;

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
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No video URL. Paste a YouTube, Vimeo, or Dailymotion link in settings.' });
      return;
    }

    if (info.type === 'video') {
      this.renderSingleVideo(wrapper, info.value);
    } else {
      this.renderPlaylist(wrapper, info.value, shuffleOnLoad, info.videoId);
    }
  }

  /** Render a clickable YouTube thumbnail (for embed-blocked videos). */
  private renderThumbnail(container: HTMLElement, videoId: string): void {
    container.empty();
    container.addClass('video-embed-thumbnail');

    container.createEl('img', {
      cls: 'video-embed-thumb-img',
      attr: {
        src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        alt: 'Video thumbnail',
        loading: 'lazy',
      },
    });

    const playBtn = container.createDiv({ cls: 'video-embed-play-overlay' });
    playBtn.createDiv({ cls: 'video-embed-play-icon' });

    const label = container.createDiv({ cls: 'video-embed-thumb-label' });
    label.setText('Watch on YouTube');

    this.registerDomEvent(container, 'click', () => {
      window.open(`${YT_ORIGIN}/watch?v=${videoId}`, '_blank');
    });
  }

  private renderSingleVideo(el: HTMLElement, videoIdOrUrl: string): void {
    const container = el.createDiv({ cls: 'video-embed-container' });
    const isYt = YT_VIDEO_ID_RE.test(videoIdOrUrl);
    const src = isYt ? ytEmbedUrl(videoIdOrUrl) : videoIdOrUrl;

    this.createIframe(container, src);

    // Listen for YouTube embed errors → swap to thumbnail
    if (isYt) {
      const gen = this.nextGeneration();
      this.listenForYtErrors(gen, container, videoIdOrUrl);
    }
  }

  private renderPlaylist(
    el: HTMLElement, listId: string,
    shuffleOnLoad: boolean, videoId?: string,
  ): void {
    const container = el.createDiv({ cls: 'video-embed-container' });

    const initialSrc = shuffleOnLoad
      ? playlistEmbedUrl(listId, { shuffle: true })
      : playlistEmbedUrl(listId, { index: 0, videoId });
    this.createIframe(container, initialSrc);

    // ── Control bar (inside container so it overlays the video) ──
    const bar = container.createDiv({ cls: 'video-embed-controls' });

    const prevBtn = bar.createEl('button', { cls: 'video-embed-ctrl-btn', attr: { 'aria-label': 'Previous video' } });
    setIcon(prevBtn, 'skip-back');

    const gen = this.nextGeneration();
    const fmtLabel = (idx: number) => {
      const num = `#${idx + 1}`;
      return this.playlistLength > 0 ? `${num}/${this.playlistLength}` : num;
    };

    const indexLabel = bar.createSpan({
      cls: 'video-embed-index-label',
      text: shuffleOnLoad ? '\u{1F500}' : fmtLabel(0),
    });

    const nextBtn = bar.createEl('button', { cls: 'video-embed-ctrl-btn', attr: { 'aria-label': 'Next video' } });
    setIcon(nextBtn, 'skip-forward');

    const randomBtn = bar.createEl('button', { cls: 'video-embed-ctrl-btn', attr: { 'aria-label': 'Random video' } });
    setIcon(randomBtn, 'shuffle');

    this.registerDomEvent(prevBtn, 'click', () => {
      if (this.currentIndex <= 0) return;
      this.currentIndex--;
      this.restoreIframeIfThumbnail(container, bar);
      this.updateIframe(playlistEmbedUrl(listId, { index: this.currentIndex, autoplay: true }));
      indexLabel.setText(fmtLabel(this.currentIndex));
    });

    this.registerDomEvent(nextBtn, 'click', () => {
      if (this.playlistLength > 0 && this.currentIndex >= this.playlistLength - 1) return;
      this.currentIndex++;
      this.restoreIframeIfThumbnail(container, bar);
      this.updateIframe(playlistEmbedUrl(listId, { index: this.currentIndex, autoplay: true }));
      indexLabel.setText(fmtLabel(this.currentIndex));
    });

    this.registerDomEvent(randomBtn, 'click', () => {
      this.restoreIframeIfThumbnail(container, bar);
      if (this.playlistLength > 0) {
        const randIdx = Math.floor(Math.random() * this.playlistLength);
        this.currentIndex = randIdx;
        this.updateIframe(playlistEmbedUrl(listId, { index: randIdx, autoplay: true }));
        indexLabel.setText(fmtLabel(randIdx));
      } else {
        this.updateIframe(playlistEmbedUrl(listId, { shuffle: true, autoplay: true }));
        indexLabel.setText('\u{1F500}');
      }
    });

    // ── Auto-detect playlist size + handle embed errors ──
    this.listenForPlaylistEvents(gen, container, bar, indexLabel, fmtLabel);
  }

  /**
   * If the container is showing a thumbnail (embed-blocked video in playlist),
   * restore it to iframe mode so the next navigation works.
   */
  private restoreIframeIfThumbnail(container: HTMLElement, controlBar: HTMLElement): void {
    if (!container.hasClass('video-embed-thumbnail')) return;
    container.empty();
    container.removeClass('video-embed-thumbnail');
    this.createIframe(container, '');
    container.appendChild(controlBar);
  }

  /** Listen for YouTube postMessage events: playlist size + embed errors. */
  private listenForPlaylistEvents(
    gen: number,
    container: HTMLElement,
    controlBar: HTMLElement,
    indexLabel: HTMLSpanElement,
    fmtLabel: (idx: number) => string,
  ): void {
    const handler = (e: MessageEvent) => {
      if (this.isStale(gen)) return;
      if (e.origin !== YT_ORIGIN) return;
      // Use this.iframeEl dynamically so it tracks across iframe recreations
      if (!this.iframeEl?.contentWindow || e.source !== this.iframeEl.contentWindow) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

        // Playlist size detection — also store video IDs for error fallback
        if (data?.event === 'infoDelivery' && Array.isArray(data?.info?.playlist)) {
          const ids: string[] = data.info.playlist;
          this.playlistLength = ids.length;
          this.playlistVideoIds = ids;
          if (!indexLabel.getText().includes('\u{1F500}')) {
            indexLabel.setText(fmtLabel(this.currentIndex));
          }
        }

        // Embed error → show thumbnail using stored playlist video IDs
        if (data?.event === 'onError' && YT_EMBED_BLOCKED_ERRORS.has(data?.info)) {
          const vidId = this.playlistVideoIds[this.currentIndex];
          if (typeof vidId === 'string' && YT_VIDEO_ID_RE.test(vidId)) {
            this.showPlaylistThumbnail(container, controlBar, vidId);
          }
        }
      } catch { /* ignore non-JSON messages */ }
    };

    window.addEventListener('message', handler);
    this.register(() => window.removeEventListener('message', handler));

    // Send initial handshake; also re-sends after iframe recreation via updateIframe
    this.sendYtHandshake(gen, 'hp-playlist');
  }

  /** Send the YouTube postMessage "listening" handshake to the current iframe. */
  private sendYtHandshake(gen: number, id: string): void {
    if (!this.iframeEl) return;
    const iframe = this.iframeEl;
    this.registerDomEvent(iframe, 'load', () => {
      if (this.isStale(gen)) return;
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id }),
        YT_ORIGIN,
      );
    });
  }

  /** Listen for YouTube error on a single video embed. */
  private listenForYtErrors(
    gen: number,
    container: HTMLElement,
    videoId: string,
  ): void {
    const iframe = this.iframeEl;
    if (!iframe) return;

    const handler = (e: MessageEvent) => {
      if (this.isStale(gen)) return;
      if (e.origin !== YT_ORIGIN) return;
      if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onError' && YT_EMBED_BLOCKED_ERRORS.has(data?.info)) {
          this.renderThumbnail(container, videoId);
          window.removeEventListener('message', handler);
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('message', handler);
    this.register(() => window.removeEventListener('message', handler));

    this.registerDomEvent(iframe, 'load', () => {
      if (this.isStale(gen)) return;
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'hp-video' }),
        YT_ORIGIN,
      );
    });
  }

  /** Show thumbnail for a blocked video within a playlist, keeping controls visible. */
  private showPlaylistThumbnail(
    container: HTMLElement,
    controlBar: HTMLElement,
    videoId: string,
  ): void {
    if (this.iframeEl) {
      this.iframeEl.addClass('hp-hidden');
    }

    // Remove any existing thumbnail elements
    container.querySelectorAll('.video-embed-thumb-img, .video-embed-play-overlay, .video-embed-thumb-label')
      .forEach(el => el.remove());

    container.addClass('video-embed-thumbnail');

    // Insert thumbnail elements before the control bar
    const img = container.createEl('img', {
      cls: 'video-embed-thumb-img',
      attr: {
        src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        alt: 'Video thumbnail',
        loading: 'lazy',
      },
    });
    container.insertBefore(img, controlBar);

    const overlay = container.createDiv({ cls: 'video-embed-play-overlay' });
    overlay.createDiv({ cls: 'video-embed-play-icon' });
    container.insertBefore(overlay, controlBar);

    const label = container.createDiv({ cls: 'video-embed-thumb-label' });
    label.setText('Watch on YouTube');
    container.insertBefore(label, controlBar);

    // Click thumbnail to open on YouTube
    this.registerDomEvent(overlay, 'click', () => {
      window.open(`${YT_ORIGIN}/watch?v=${videoId}`, '_blank');
    });
  }

  // SECURITY INVARIANT: allow-same-origin + allow-scripts nullifies the sandbox.
  // This is required by the YouTube IFrame API.  The origin guard below ensures
  // only YouTube/Vimeo/Dailymotion URLs can ever reach this code path.
  // Do NOT add new providers without a security review.
  private static readonly ALLOWED_EMBED_HOSTS =
    /^(?:www\.)?youtube\.com$|^player\.vimeo\.com$|^www\.dailymotion\.com$/;

  private createIframe(container: HTMLElement, src: string): HTMLIFrameElement {
    try {
      const host = new URL(src).hostname;
      if (!VideoEmbedBlock.ALLOWED_EMBED_HOSTS.test(host)) {
        throw new Error(`Blocked iframe src from unknown origin: ${host}`);
      }
    } catch (e) {
      console.error('[Homepage Blocks] VideoEmbed origin check failed:', e);
      container.setText('Video source blocked for security reasons.');
      return container.createEl('iframe'); // return dummy — never displayed
    }

    this.iframeEl = container.createEl('iframe', {
      cls: 'video-embed-iframe',
      attr: {
        src,
        title: 'Embedded video',
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: '',
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
        sandbox: 'allow-same-origin allow-scripts allow-popups allow-presentation',
      },
    });
    return this.iframeEl;
  }

  private updateIframe(src: string): void {
    if (this.iframeEl) {
      this.iframeEl.removeClass('hp-hidden');
      this.iframeEl.setAttribute('src', src);
    }
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
    contentEl.createEl('h2', { text: 'Video embed settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Video / playlist URL')
      .setDesc('YouTube, Vimeo, or Dailymotion URL \u2014 playlist links are supported.')
      .addText(t =>
        t.setValue(draft.url as string ?? '')
         .setPlaceholder('https://www.youtube.com/playlist?list=...')
         .onChange(v => { draft.url = v; }),
      );

    new Setting(contentEl)
      .setName('Shuffle on load')
      .setDesc('Start with a random video from the playlist each time the homepage opens \u2014 only applies to playlist URLs.')
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
