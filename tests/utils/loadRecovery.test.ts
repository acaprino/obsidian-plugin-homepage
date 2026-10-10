import { describe, it, expect, vi } from 'vitest';
import { loadLayoutWithRecovery, loadProblemMessage, newerVersionMessage } from '../../src/utils/loadRecovery';
import { getDefaultLayout } from '../../src/validation';

const DATA = '.obsidian/plugins/homepage-blocks/data.json';
const BACKUP = `${DATA}.invalid`;

/**
 * In-memory stand-in for the slice of Obsidian's DataAdapter the load path uses.
 * `read` of a missing path rejects like the real adapter; the flags simulate a
 * failing disk and can be flipped mid-test.
 */
function fakeFs(files: Record<string, string> = {}, flags: { failWrite?: boolean; failExists?: boolean; failRead?: boolean } = {}) {
  const store = new Map(Object.entries(files));
  return {
    files: store,
    flags,
    exists: async (p: string) => {
      if (flags.failExists) throw new Error('EIO');
      return store.has(p);
    },
    read: async (p: string) => {
      if (flags.failRead) throw new Error('EBUSY');
      const v = store.get(p);
      if (v === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return v;
    },
    write: async (p: string, data: string) => {
      if (flags.failWrite) throw new Error('ENOSPC');
      store.set(p, data);
    },
  };
}

describe('loadLayoutWithRecovery', () => {
  it('backs up an unparseable data.json byte for byte and loads the defaults (RF-R4)', async () => {
    // Obsidian's loadData() returns undefined when data.json exists but is not valid JSON.
    const original = '{"columns": 4, "blocks": [\n<<<<<<< sync conflict';
    const fs = fakeFs({ [DATA]: original });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(out.problem).toEqual({ kind: 'unreadable' });
    expect(out.backupPath).toBe(BACKUP);
    expect(fs.files.get(BACKUP)).toBe(original);
    expect(out.layout).toEqual(getDefaultLayout());
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('uses data.json when reading it again succeeds, as after a transient lock', async () => {
    const fs = fakeFs({ [DATA]: JSON.stringify({ columns: 4, blocks: [] }) });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(out.problem).toBeNull();
    expect(out.layout.columns).toBe(4);
    expect(fs.files.has(BACKUP)).toBe(false);
  });

  it('treats a missing data.json (loadData returns null) as a first install', async () => {
    const fs = fakeFs();

    const out = await loadLayoutWithRecovery(null, DATA, fs);

    expect(out.problem).toBeNull();
    expect(out.backupPath).toBeNull();
    expect(fs.files.size).toBe(0);
    expect(out.layout).toEqual(getDefaultLayout());
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('treats undefined with no file on disk as a first install, not as corruption', async () => {
    const fs = fakeFs();

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(out.problem).toBeNull();
    expect(fs.files.size).toBe(0);
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('holds every write back while the unreadable file cannot be backed up, and releases them once it can', async () => {
    const fs = fakeFs({ [DATA]: 'not json' }, { failWrite: true });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);
    expect(out.problem).toEqual({ kind: 'unreadable' });
    expect(out.backupPath).toBeNull();
    expect(await out.guard.allowWrite()).toEqual({ allowed: false, backupPath: null });
    expect(await out.guard.allowWrite()).toEqual({ allowed: false, backupPath: null });

    fs.flags.failWrite = false; // the disk recovers
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: BACKUP });
    expect(fs.files.get(BACKUP)).toBe('not json');
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('lets writes through once data.json is gone: nothing is left to protect', async () => {
    const fs = fakeFs({ [DATA]: 'not json' }, { failRead: true });
    const out = await loadLayoutWithRecovery(undefined, DATA, fs);
    expect(await out.guard.allowWrite()).toEqual({ allowed: false, backupPath: null });

    fs.files.delete(DATA); // the user removed it, or a sync client did
    fs.flags.failRead = false;

    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('logs a failed backup once, not on every write it holds back', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fs = fakeFs({ [DATA]: 'not json' }, { failWrite: true });
      const out = await loadLayoutWithRecovery(undefined, DATA, fs);
      await out.guard.allowWrite();
      await out.guard.allowWrite();

      expect(errors).toHaveBeenCalledTimes(1);
    } finally {
      errors.mockRestore();
    }
  });

  it('holds writes back when the file cannot be read at all, and keeps it', async () => {
    const fs = fakeFs({ [DATA]: 'not json' }, { failRead: true });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(out.problem).toEqual({ kind: 'unreadable' });
    expect(await out.guard.allowWrite()).toEqual({ allowed: false, backupPath: null });
    expect(fs.files.get(DATA)).toBe('not json');
  });

  it('treats undefined as unreadable when the file cannot even be checked', async () => {
    const fs = fakeFs({ [DATA]: 'not json' }, { failExists: true, failWrite: true });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(out.problem).toEqual({ kind: 'unreadable' });
    expect(await out.guard.allowWrite()).toEqual({ allowed: false, backupPath: null });
  });

  it('never clobbers an earlier backup: a second corruption gets a timestamped sibling', async () => {
    const fs = fakeFs({ [DATA]: 'second bad copy', [BACKUP]: 'first bad copy' });

    const out = await loadLayoutWithRecovery(undefined, DATA, fs);

    expect(fs.files.get(BACKUP)).toBe('first bad copy');
    expect(out.backupPath).toMatch(/data\.json\.invalid\.\d+$/);
    expect(fs.files.get(out.backupPath!)).toBe('second bad copy');
  });

  it('backs up the original file text, not the migrated value, when blocks are dropped', async () => {
    // A legacy _hideTitle that migration rewrites in place, plus one invalid block.
    const text = JSON.stringify({
      blocks: [
        { id: 'keep', type: 'clock', x: 0, y: 0, w: 1, h: 3, config: { _hideTitle: true } },
        { id: 'bad id', type: 'clock', x: 0, y: 3, w: 1, h: 3, config: {} },
      ],
    }, null, 2);
    const fs = fakeFs({ [DATA]: text });

    const out = await loadLayoutWithRecovery(JSON.parse(text), DATA, fs);

    expect(out.problem).toEqual({ kind: 'blocks-dropped', count: 1 });
    expect(fs.files.get(BACKUP)).toBe(text);
    expect(out.layout.blocks.map(b => b.id)).toEqual(['keep']);
    expect(await out.guard.allowWrite()).toEqual({ allowed: true, backupPath: null });
  });

  it('backs up a data.json whose top level is not an object', async () => {
    const fs = fakeFs({ [DATA]: '["not", "a", "layout"]' });

    const out = await loadLayoutWithRecovery(['not', 'a', 'layout'], DATA, fs);

    expect(out.problem).toEqual({ kind: 'unusable' });
    expect(fs.files.get(BACKUP)).toBe('["not", "a", "layout"]');
    expect(out.layout).toEqual(getDefaultLayout());
  });

  it('backs up a data.json whose blocks field is not an array', async () => {
    const text = JSON.stringify({ columns: 4, blocks: { c1: 'not an array' } });
    const fs = fakeFs({ [DATA]: text });

    const out = await loadLayoutWithRecovery(JSON.parse(text), DATA, fs);

    expect(out.problem).toEqual({ kind: 'unusable' });
    expect(fs.files.get(BACKUP)).toBe(text);
  });

  it('writes nothing for a clean layout', async () => {
    const text = JSON.stringify({ columns: 4, blocks: [] });
    const fs = fakeFs({ [DATA]: text });

    const out = await loadLayoutWithRecovery(JSON.parse(text), DATA, fs);

    expect(out.problem).toBeNull();
    expect(out.backupPath).toBeNull();
    expect([...fs.files.keys()]).toEqual([DATA]);
    expect(out.layout.columns).toBe(4);
  });
});

describe('loadProblemMessage', () => {
  it('names the backup file when the copy was written', () => {
    const msg = loadProblemMessage({ kind: 'unreadable' }, `${BACKUP}.1700000000000`);
    expect(msg).toContain('data.json.invalid.1700000000000');
  });

  it('says the backup failed and that nothing will be saved, instead of claiming one', () => {
    const msg = loadProblemMessage({ kind: 'blocks-dropped', count: 2 }, null);
    expect(msg).toContain('could not be backed up');
    expect(msg).toContain('nothing will be saved');
    expect(msg).not.toContain('saved as');
  });
});

describe('newerVersionMessage (M58)', () => {
  it('says how many blocks need a newer version and that they are kept', () => {
    const layout = { ...getDefaultLayout(), preserved: { blocks: [{}], mobileBlocks: [{}, {}], fields: {} } };
    expect(newerVersionMessage(layout)).toBe('Homepage blocks: 3 block(s) need a newer version of the plugin. They are kept and not shown.');
  });

  it('says nothing when there are none', () => {
    expect(newerVersionMessage(getDefaultLayout())).toBeNull();
    expect(newerVersionMessage({ ...getDefaultLayout(), preserved: { blocks: [], mobileBlocks: [], fields: { x: 1 } } })).toBeNull();
  });
});
