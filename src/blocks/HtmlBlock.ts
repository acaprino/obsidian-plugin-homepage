import { Setting, sanitizeHTMLToDom } from 'obsidian';
import { BaseBlock } from './BaseBlock';

export class HtmlBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('html-block');

    const { html = '' } = this.instance.config as {
      html?: string;
    };

    this.renderHeader(el, 'HTML');

    const contentEl = el.createDiv({ cls: 'html-block-content' });

    if (!html) {
      const hint = contentEl.createDiv({ cls: 'block-empty-hint' });
      hint.createDiv({ cls: 'block-empty-hint-icon', text: '</>' });
      hint.createDiv({ cls: 'block-empty-hint-text', text: 'No HTML content yet. Add your markup in settings.' });
      return;
    }

    // Full-document mode: render inside a sandboxed iframe for perfect
    // style isolation and full CSS support (flexbox, grid, animations, etc.)
    if (/<style\b/i.test(html)) {
      this.renderIframe(contentEl, html);
      return;
    }

    // Simple fragment mode: sanitize and render inline
    const DANGEROUS_TAGS_RE = /<\/?\s*(iframe|object|embed|form|meta|link|base|script|style|svg)\b[^>]*>/gi;
    let sanitized = html;
    let prev: string;
    do {
      prev = sanitized;
      sanitized = sanitized.replace(DANGEROUS_TAGS_RE, '');
    } while (sanitized !== prev);
    contentEl.appendChild(sanitizeHTMLToDom(sanitized));
  }

  /** Render full HTML documents inside a sandboxed iframe with Obsidian CSS variable bridging. */
  private renderIframe(contentEl: HTMLElement, html: string): void {
    // Strip script tags AND other navigation/exfil vectors for defense-in-depth
    // (sandbox also blocks execution, but <meta refresh> / <base> / <link> can still
    // leak requests or redirect even without scripts).
    const DANGEROUS_IFRAME_TAGS_RE = /<\/?\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi;
    let safe = html;
    let prev: string;
    do { prev = safe; safe = safe.replace(DANGEROUS_IFRAME_TAGS_RE, ''); } while (safe !== prev);

    // Collect var(--...) references used in the HTML/CSS
    const varRefs = new Set<string>();
    const VAR_RE = /var\((--[\w-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = VAR_RE.exec(safe)) !== null) varRefs.add(m[1]);

    // Build bridge stylesheet: Obsidian CSS variables + body padding reset.
    // Dynamic width/scale are driven from the load handler below via
    // setProperty('--hp-body-...', ...) on custom properties; the `hp-clipped`
    // class toggles overflow:hidden. This detour avoids the obsidianmd
    // no-static-styles-assignment rule (which permits custom-property writes
    // but not static `.style.x = 'literal'` or `setAttribute('style', ...)`).
    const bridgeParts = [
      'html{height:100%;margin:0;padding:0}',
      'html.hp-clipped{overflow:hidden}',
      'body{margin:0;padding:0;min-height:100%;width:var(--hp-body-width,auto);transform-origin:top left;transform:scale(var(--hp-body-scale,1))}',
    ];
    if (varRefs.size > 0) {
      const rootStyle = getComputedStyle(document.body);
      const pairs = [...varRefs]
        .map(v => {
          const val = rootStyle.getPropertyValue(v).trim();
          return val ? `${v}:${val}` : '';
        })
        .filter(Boolean);
      if (pairs.length > 0) bridgeParts.unshift(`:root{${pairs.join(';')}}`);
    }
    const bridge = `<style>${bridgeParts.join('')}</style>`;
    const headMatch = safe.match(/<head\b[^>]*>/i);
    if (headMatch && headMatch.index !== undefined) {
      const pos = headMatch.index + headMatch[0].length;
      safe = safe.slice(0, pos) + bridge + safe.slice(pos);
    } else {
      safe = bridge + safe;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.srcdoc = safe;
    iframe.addClass('hp-html-iframe');

    contentEl.appendChild(iframe);

    // Auto-scale: if content overflows vertically, widen + shrink to fill the card.
    // Iterates because widening the body causes flex-wrap reflow (shorter content),
    // which changes the required scale. Converges in 2-3 rounds.
    iframe.addEventListener('load', () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const availableH = iframe.clientHeight;
        let contentH = doc.documentElement.scrollHeight;
        if (contentH <= availableH || availableH <= 0) return;

        let scale = availableH / contentH;
        for (let i = 0; i < 4; i++) {
          doc.body.style.setProperty('--hp-body-width', `${(1 / scale) * 100}%`);
          contentH = doc.documentElement.scrollHeight;
          const next = availableH / contentH;
          if (Math.abs(next - scale) < 0.005) { scale = next; break; }
          scale = next;
        }

        doc.documentElement.classList.add('hp-clipped');
        doc.body.style.setProperty('--hp-body-width', `${(1 / scale) * 100}%`);
        doc.body.style.setProperty('--hp-body-scale', `${scale}`);
      } catch { /* cross-origin fallback */ }
    });
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    new Setting(body).setName('HTML').setDesc('Supports full HTML documents with <style> blocks.');
    const textarea = body.createEl('textarea', { cls: 'html-settings-textarea' });
    textarea.value = draft.html as string ?? '';
    textarea.rows = 12;
    textarea.setAttribute('spellcheck', 'false');
    textarea.addEventListener('input', () => { draft.html = textarea.value; });
  }
}
