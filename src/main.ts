import { Notice, Platform, Plugin, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE, HomepageView } from './HomepageView';
import { BlockInstance, LayoutConfig, LayoutPriority, OpenMode, IHomepagePlugin } from './types';
import { getDefaultLayout, validateLayout } from './validation';
import { BlockRegistry } from './BlockRegistry';
import { HomepageSettingTab } from './settings/HomepageSettingTab';
import { installTagCacheListeners } from './utils/tags';
import { decryptStringEx, encryptStringEx, isEncrypted, _resetDeviceKeyCache } from './utils/apiKeyCrypto';
import { GreetingBlock } from './blocks/GreetingBlock';
import { ClockBlock } from './blocks/ClockBlock';
import { FolderLinksBlock } from './blocks/FolderLinksBlock';
import { ButtonGridBlock } from './blocks/ButtonGridBlock';
import { QuotesListBlock } from './blocks/QuotesListBlock';
import { ImageGalleryBlock } from './blocks/ImageGalleryBlock';
import { EmbeddedNoteBlock } from './blocks/EmbeddedNoteBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import { HtmlBlock } from './blocks/HtmlBlock';
import { VideoEmbedBlock } from './blocks/VideoEmbedBlock';
import { BookmarkBlock } from './blocks/BookmarkBlock';
import { RecentFilesBlock } from './blocks/RecentFilesBlock';
import { PomodoroBlock } from './blocks/PomodoroBlock';
import { SpacerBlock } from './blocks/SpacerBlock';
import { RandomNoteBlock } from './blocks/RandomNoteBlock';
import { VoiceDictationBlock } from './blocks/VoiceDictationBlock';
import { VaultSearchBlock } from './blocks/VaultSearchBlock';
import { imageCache } from './utils/imageCache';
import { closeSharedAudioCtx, clearPomodoroState } from './blocks/PomodoroBlock';
import { abortActiveLightbox } from './blocks/ImageGalleryBlock';


// ── Block registration ───────────────────────────────────────────────────────

function registerBlocks(): void {
  BlockRegistry.clear();

  BlockRegistry.register({
    type: 'greeting',
    displayName: 'Greeting',
    defaultConfig: { name: 'World', showTime: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'clock',
    displayName: 'Clock / date',
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'folder-links',
    displayName: 'Quick links',
    defaultConfig: { _titleLabel: 'Quick links', folder: '', links: [] },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin),
  });


  BlockRegistry.register({
    type: 'button-grid',
    displayName: 'Button grid',
    defaultConfig: { _titleLabel: 'Button grid', columns: 2, items: [] },
    defaultSize: { w: 1, h: 5 },
    autoHeight: true,
    create: (app, instance, plugin) => new ButtonGridBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'quotes-list',
    displayName: 'Quotes',
    defaultConfig: { tag: '', _titleLabel: 'Quotes', columns: 2, maxItems: 0, quoteStyle: 'classic', fontStyle: 'default', customFont: '', dailySeed: true, showNoteTitle: true },
    defaultSize: { w: 2, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'image-gallery',
    displayName: 'Image gallery',
    defaultConfig: { folder: '', _titleLabel: 'Gallery', columns: 3, maxItems: 0 },
    defaultSize: { w: 3, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'embedded-note',
    displayName: 'Embedded note',
    defaultConfig: { filePath: '', showTitle: true },
    defaultSize: { w: 1, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'static-text',
    displayName: 'Static text',
    defaultConfig: { content: '' },
    defaultSize: { w: 1, h: 3 },
    autoHeight: true,
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'html',
    displayName: 'HTML block',
    defaultConfig: { html: '' },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'video-embed',
    displayName: 'Video embed',
    defaultConfig: { url: '', shuffleOnLoad: false },
    defaultSize: { w: 2, h: 4 },
    create: (app, instance, plugin) => new VideoEmbedBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'bookmarks',
    displayName: 'Bookmarks',
    defaultConfig: { _titleLabel: 'Bookmarks', items: [], columns: 2, showDescriptions: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new BookmarkBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'recent-files',
    displayName: 'Recent files',
    defaultConfig: { _titleLabel: 'Recent files', maxItems: 10, showTimestamp: true, excludeFolders: '' },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RecentFilesBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'pomodoro',
    displayName: 'Pomodoro timer',
    defaultConfig: { _titleLabel: 'Pomodoro', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLong: 4 },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new PomodoroBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'spacer',
    displayName: 'Spacer',
    defaultConfig: { _showTitle: false, _showBorder: false, _showBackground: false, _showHeaderAccent: false },
    defaultSize: { w: 1, h: 2 },
    create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin),
  });

  BlockRegistry.register({
    type: 'random-note',
    displayName: 'Random note',
    defaultConfig: { _titleLabel: 'Random note', tag: '', dailySeed: false, imageProperty: 'cover', titleProperty: 'title', showImage: true, showPreview: true },
    defaultSize: { w: 1, h: 4 },
    autoHeight: true,
    create: (app, instance, plugin) => new RandomNoteBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'voice-dictation',
    displayName: 'Voice notes',
    defaultConfig: {
      folder: '',
      triggerMode: 'tap',
      provider: 'whisper',
      apiKey: '',
      model: '',
      language: '',
      noteTemplate: '',
    },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
  });
  BlockRegistry.register({
    type: 'vault-search',
    displayName: 'Vault Search',
    defaultConfig: { placeholder: 'Search vault...' },
    defaultSize: { w: 2, h: 2 },
    create: (app, instance, plugin) => new VaultSearchBlock(app, instance, plugin),
  });
}

// ── Plugin ───────────────────────────────────────────────────────────────────

// ── API key encryption helpers ──────────────────────────────────────────────
//
// Walked every save / load. Only block types whose defaultConfig declares `apiKey`
// currently need this (voice-dictation today), but checking by key name makes
// this future-proof — any new block that names its field `apiKey` gets encrypted
// automatically.

/**
 * Encrypt every BlockInstance.config.apiKey on the given layout. Returns a new
 * layout with new block objects — never mutates the input.
 *
 * If WebCrypto is unavailable, encryptStringEx returns `ok: false`. To avoid
 * downgrading already-stored ciphertext to plaintext (which would propagate via
 * vault sync), we look up the previously-persisted apiKey from `priorOnDisk` and
 * keep its ciphertext value when the encrypt step fell back to plaintext.
 */
async function encryptApiKeys(layout: LayoutConfig, priorOnDisk: LayoutConfig | null): Promise<LayoutConfig> {
  const buildPriorMap = (blocks: BlockInstance[] | undefined): Map<string, string> => {
    const m = new Map<string, string>();
    if (!Array.isArray(blocks)) return m;
    for (const b of blocks) {
      const k = b?.config?.apiKey;
      if (typeof k === 'string' && k) m.set(b.id, k);
    }
    return m;
  };
  const priorDesktop = buildPriorMap(priorOnDisk?.blocks);
  const priorMobile = buildPriorMap(priorOnDisk?.mobileBlocks);

  const encryptBlocks = async (blocks: BlockInstance[], prior: Map<string, string>): Promise<BlockInstance[]> =>
    Promise.all(blocks.map(async (b) => {
      const key = b.config.apiKey;
      if (typeof key !== 'string' || !key || isEncrypted(key)) return b;
      const r = await encryptStringEx(key);
      if (!r.ok) {
        // Refuse to overwrite a previously-stored ciphertext with plaintext.
        const previously = prior.get(b.id);
        if (typeof previously === 'string' && isEncrypted(previously)) {
          return { ...b, config: { ...b.config, apiKey: previously } };
        }
        // No prior ciphertext on disk: there's nothing to protect, so we let the
        // plaintext fallback proceed (the warn is logged inside encryptStringEx).
      }
      return { ...b, config: { ...b.config, apiKey: r.value } };
    }));

  const [blocks, mobileBlocks] = await Promise.all([
    encryptBlocks(layout.blocks, priorDesktop),
    encryptBlocks(layout.mobileBlocks, priorMobile),
  ]);
  return { ...layout, blocks, mobileBlocks };
}

/**
 * Decrypt apiKey fields on a layout in place. Returns `true` when every
 * decryption succeeded (or the value was empty / plaintext), `false` if at
 * least one ciphertext was preserved on disk because the device key was
 * transiently unavailable. Callers should skip the post-load resave when
 * this returns false, otherwise a transient WebCrypto/IndexedDB hiccup
 * would silently destroy the user's encrypted key.
 *
 * The function still produces new BlockInstance / config objects rather than
 * mutating the input — old code mutated in place to keep object identity, but
 * that pattern leaked into shared input fixtures during tests.
 */
async function decryptApiKeys(layout: LayoutConfig): Promise<{ stable: boolean }> {
  let stable = true;

  const decryptBlocks = async (blocks: BlockInstance[]): Promise<BlockInstance[]> => {
    const out: BlockInstance[] = [];
    for (const b of blocks) {
      const key = b.config.apiKey;
      if (typeof key !== 'string' || !key || !isEncrypted(key)) {
        out.push(b);
        continue;
      }
      const r = await decryptStringEx(key);
      if (r.ok) {
        out.push({ ...b, config: { ...b.config, apiKey: r.plaintext } });
      } else if (r.reason === 'no-key' && r.transient) {
        // IndexedDB/WebCrypto hiccuped. Keep the ciphertext on disk untouched
        // (we leave b.config.apiKey alone in memory; runtime callers will see
        // the encrypted form, which is benign — the dictation block will fail
        // with a clear "key invalid" path until next launch retries decrypt).
        stable = false;
        new Notice('Homepage blocks: voice API key could not be loaded right now. It will be retried on next restart.', 10_000);
        out.push(b);
      } else {
        // Permanent failure: corrupt ciphertext, missing WebCrypto entirely,
        // or wrong device. Clearing forces the user to re-enter on this device.
        out.push({ ...b, config: { ...b.config, apiKey: '' } });
        new Notice('Homepage blocks: voice API key could not be decrypted on this device. Please re-enter it in settings.', 10_000);
      }
    }
    return out;
  };

  const desktop = await decryptBlocks(layout.blocks);
  const mobile = await decryptBlocks(layout.mobileBlocks);
  layout.blocks = desktop;
  layout.mobileBlocks = mobile;
  return { stable };
}

export default class HomepagePlugin extends Plugin implements IHomepagePlugin {
  layout: LayoutConfig = getDefaultLayout();

  async onload(): Promise<void> {
    registerBlocks();

    // Re-arm the imageCache singleton in case a previous onunload disposed it.
    // The module-level cache survives across plugin disable+enable in the same
    // renderer; without this, every gallery thumbnail would rebuild forever.
    imageCache.reset();

    // Plugin-wide tag-cache invalidation — replaces the per-block clearTagCache()
    // dance so callers of getFilesWithTag() always see fresh data without having
    // to remember to wire up vault listeners themselves.
    installTagCacheListeners(this);

    const raw = await this.loadData() as unknown;
    const validated = validateLayout(raw, (badRaw) => {
      // data.json existed but its top-level shape is unusable (string from a
      // sync conflict marker, array from a schema mistake, etc.). Stash a copy
      // alongside the plugin's data folder so the user can recover by hand
      // instead of silently losing every block + every persisted setting.
      void this.stashCorruptedData(badRaw).catch((err) => {
        console.error('[Homepage Blocks] Failed to stash corrupted data.json', err instanceof Error ? err.message : 'unknown error');
      });
      new Notice('Homepage blocks: data.json was unreadable and has been backed up. Layout has been reset to defaults.', 12_000);
    });
    // At-rest apiKey values are encrypted (AES-GCM, non-extractable device key in
    // IndexedDB). Decrypt on load so blocks see plaintext; encrypt again on save.
    const decryptResult = await decryptApiKeys(validated);
    this.layout = validated;
    // Persist cleaned layout to remove old-format properties and fix corruption,
    // BUT only when the apiKey decrypt was stable. If a key was preserved as
    // ciphertext because of a transient WebCrypto/IndexedDB failure, the post-load
    // resave would round-trip empty plaintext through encryptApiKeys and overwrite
    // the original ciphertext on disk -- destroying the user's key for good.
    if (decryptResult.stable) {
      await this.saveLayout(this.layout);
    }

    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: 'open-homepage',
      name: 'Open homepage',
      callback: () => { void this.openHomepage(this.layout.manualOpenMode); },
    });

    this.addCommand({
      id: 'toggle-edit-mode',
      name: 'Toggle edit mode',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.toggleEditMode();
          }
        }
      },
    });

    this.addCommand({
      id: 'add-block',
      name: 'Add block',
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.openAddBlockModal();
          }
        }
      },
    });

    this.addRibbonIcon('home', 'Open homepage', () => { void this.openHomepage(this.layout.manualOpenMode); });

    this.addSettingTab(new HomepageSettingTab(this.app, this));

    let layoutReady = false;
    this.app.workspace.onLayoutReady(() => {
      layoutReady = true;
      if (this.layout.openOnStartup) {
        void this.openHomepage(this.layout.openMode);
      }
    });

    let emptyCheckTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEmptyOpen = 0;
    this.register(() => { if (emptyCheckTimer) clearTimeout(emptyCheckTimer); });
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        if (!layoutReady || !this.layout.openWhenEmpty) return;
        if (emptyCheckTimer) clearTimeout(emptyCheckTimer);
        emptyCheckTimer = setTimeout(() => {
          emptyCheckTimer = null;
          if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
          // Another plugin may briefly close all leaves before opening its own.
          // Guard against racing it into opening a duplicate homepage.
          if (Date.now() - lastEmptyOpen < 2000) return;
          let hasContent = false;
          this.app.workspace.iterateRootLeaves(leaf => {
            if (leaf.view.getViewType() !== 'empty') hasContent = true;
          });
          if (!hasContent) {
            lastEmptyOpen = Date.now();
            void this.openHomepage('retain');
          }
        }, 500);
      }),
    );
  }

  onunload(): void {
    imageCache.destroy();
    clearPomodoroState();
    closeSharedAudioCtx();
    abortActiveLightbox();
    // Drop the cached CryptoKey reference. The IndexedDB record itself stays so
    // a re-enable on the same device decrypts existing ciphertext, but we don't
    // hold a stale reference into a possibly-wiped database across reloads.
    _resetDeviceKeyCache();
  }

  /**
   * Write a copy of corrupted data.json content to a sibling file so the user
   * can manually recover. Only invoked from validateLayout's corruption hook;
   * silent in normal flow. Uses a single fixed sibling name (no timestamp) to
   * avoid accumulating files when data.json corrupts repeatedly -- the most
   * recent bad copy is the one the user typically wants.
   */
  private async stashCorruptedData(badRaw: unknown): Promise<void> {
    const dir = this.manifest.dir;
    if (!dir) return;
    let serialized: string;
    if (typeof badRaw === 'string') {
      serialized = badRaw;
    } else {
      try {
        serialized = JSON.stringify(badRaw, null, 2);
      } catch {
        serialized = String(badRaw);
      }
    }
    const target = `${dir}/data.json.invalid`;
    await this.app.vault.adapter.write(target, serialized);
  }

  // ── Platform-aware layout helpers ─────────────────────────────────

  isMobileActive(): boolean {
    return Platform.isMobile && this.layout.responsiveMode === 'separate';
  }

  activeBlocks(): BlockInstance[] {
    return this.isMobileActive() ? this.layout.mobileBlocks : this.layout.blocks;
  }

  activeColumns(): number {
    return this.isMobileActive() ? this.layout.mobileColumns : this.layout.columns;
  }

  activeLayoutPriority(): LayoutPriority {
    return this.isMobileActive() ? this.layout.mobileLayoutPriority : this.layout.layoutPriority;
  }

  // ── Persistence ───────────────────────────────────────────────────

  private savePromise = Promise.resolve();
  private saveErrorNotified = false;

  async saveLayout(layout: LayoutConfig): Promise<void> {
    this.layout = layout;
    // Serialize save ordering AND await the pre-save encryption inside the
    // chain so a later-queued save sees the updated ciphertext format.
    this.savePromise = this.savePromise.then(async () => {
      // Read the prior on-disk layout so encryptApiKeys can refuse to overwrite
      // a previously-stored ciphertext with plaintext when WebCrypto is gated
      // (cross-platform vault-sync footgun: ciphertext on desktop, plaintext on
      // mobile if the mobile platform's WebCrypto is restricted).
      let priorOnDisk: LayoutConfig | null = null;
      try {
        const prior = await this.loadData() as unknown;
        if (prior && typeof prior === 'object' && !Array.isArray(prior)) {
          priorOnDisk = prior as LayoutConfig;
        }
      } catch {
        // Read failure is benign — without prior context we accept the plaintext
        // fallback (encryptStringEx still warns), since refusing the save would
        // be worse.
      }
      // Clone so we don't write ciphertext back into the live layout the blocks
      // are reading from — runtime copies always stay plaintext.
      const persistable = await encryptApiKeys(layout, priorOnDisk);
      await this.saveData(persistable);
    }).then(
      () => { this.saveErrorNotified = false; },
      (err) => {
        // In-memory state stays authoritative so the session keeps working.
        // The user needs to know that the edit didn't persist though.
        console.error('[Homepage Blocks] Failed to save layout', err);
        if (!this.saveErrorNotified) {
          this.saveErrorNotified = true;
          new Notice('Homepage blocks: failed to save layout. Check disk space / permissions.', 8000);
        }
      },
    );
    await this.savePromise;
  }

  async saveActiveBlocks(blocks: BlockInstance[]): Promise<void> {
    const next = this.isMobileActive()
      ? { ...this.layout, mobileBlocks: blocks }
      : { ...this.layout, blocks };
    await this.saveLayout(next);
  }

  /**
   * Atomically patch one block's config. The patcher reads `activeBlocks()`
   * here at call time, but if a positional save (dragstop) is currently
   * waiting on the savePromise chain it will land BEFORE this read -- so
   * the snapshot we capture already reflects the dragged positions. Then
   * saveLayout serializes our update behind it. The previous saveActiveBlocks
   * pattern read positions inside the rename handler (before the chain),
   * which lost any dragstop that hadn't yet been awaited.
   */
  async updateBlockConfig(id: string, patch: Record<string, unknown>): Promise<void> {
    // Wait for any pending writes so we read positions written by a prior
    // dragstop before computing newBlocks.
    try {
      await this.savePromise;
    } catch {
      // Prior save's failure has already been notified in saveLayout's chain;
      // reading the current in-memory layout is still the right move.
    }
    const live = this.activeBlocks();
    if (!live.some(b => b.id === id)) return;
    const next = live.map(b =>
      b.id === id ? { ...b, config: { ...b.config, ...patch } } : b,
    );
    await this.saveActiveBlocks(next);
  }

  async openHomepage(mode: OpenMode = 'retain'): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      if (this.layout.pin) existing[0].setPinned(true);
      return;
    }

    let leaf: WorkspaceLeaf;
    if (mode === 'replace-all') {
      const toClose: WorkspaceLeaf[] = [];
      workspace.iterateAllLeaves(l => {
        if (l.getRoot() === workspace.rootSplit) toClose.push(l);
      });
      toClose.forEach(l => l.detach());
      leaf = workspace.getLeaf(true);
    } else if (mode === 'replace-last') {
      leaf = workspace.getLeaf(false);
    } else {
      leaf = workspace.getLeaf('tab');
    }

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);

    if (this.layout.pin) leaf.setPinned(true);
  }
}
