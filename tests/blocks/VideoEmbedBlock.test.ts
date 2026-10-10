import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { VideoEmbedBlock } from '../../src/blocks/VideoEmbedBlock';
import type { BlockInstance, IHomepagePlugin } from '../../src/types';

beforeEach(() => { document.body.empty(); });

function embed(url: string): HTMLIFrameElement | null {
  const instance: BlockInstance = { id: 'v', type: 'video-embed', x: 0, y: 0, w: 2, h: 3, config: { url } };
  const el = document.body.createDiv();
  new VideoEmbedBlock({} as App, instance, {} as IHomepagePlugin).render(el);
  return el.querySelector('iframe');
}

describe('VideoEmbedBlock Vimeo links (M47)', () => {
  it('keeps the privacy hash of an unlisted video', () => {
    expect(embed('https://vimeo.com/123456789/abcdef1234')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789?h=abcdef1234');
    expect(embed('https://vimeo.com/123456789?h=abcdef1234')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789?h=abcdef1234');
  });

  it('accepts player, channel and group links', () => {
    expect(embed('https://player.vimeo.com/video/123456789?h=abc123')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789?h=abc123');
    expect(embed('https://vimeo.com/channels/staffpicks/123456789')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789');
    expect(embed('https://vimeo.com/groups/shortfilms/videos/123456789')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789');
  });

  it('still embeds a public video by its id', () => {
    expect(embed('https://vimeo.com/123456789')?.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789');
  });
});

describe('VideoEmbedBlock referrer (M48)', () => {
  it('sends the origin, which YouTube requires, and never the path', () => {
    expect(embed('https://youtu.be/dQw4w9WgXcQ')?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
  });
});
