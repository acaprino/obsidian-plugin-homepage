import { MAX_BLOCKS, validateLayout } from '../validation';
import type { LayoutConfig } from '../types';

/** The slice of Obsidian's DataAdapter the load path needs. */
export interface DataFileAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
}

export type LoadProblem =
  | { kind: 'unreadable' }
  | { kind: 'unusable' }
  | { kind: 'blocks-dropped'; count: number };

export interface LoadOutcome {
  layout: LayoutConfig;
  problem: LoadProblem | null;
  /** Where the original data.json was copied; null when no copy was needed or the copy failed. */
  backupPath: string | null;
  /** Consult before every write to data.json. */
  guard: DataFileGuard;
}

/**
 * Validate what `Plugin.loadData()` returned and, when data.json is unusable in
 * whole or in part, copy it verbatim to a sibling file before anything can
 * write over it.
 *
 * Obsidian's `loadData()` returns `null` when data.json does not exist and
 * `undefined` when it exists but cannot be read or parsed: `Vault.readJson`
 * logs the error and swallows it. validateLayout sees both as "no layout yet",
 * so the second case is told apart here by checking that the file is there
 * (when even that check fails, the file is assumed present: keeping it is the
 * safe side), then reading it once more: a read that failed only transiently
 * (a sync client holding the file) leaves text that parses now.
 *
 * The copy is the file's text, not a re-serialized value: validateLayout
 * migrates nested configs in place, and an unparseable file has no value.
 */
export async function loadLayoutWithRecovery(
  raw: unknown,
  dataPath: string,
  adapter: DataFileAdapter,
): Promise<LoadOutcome> {
  const found: LoadProblem[] = [];
  let text: string | null = null;
  if (raw === undefined && await adapter.exists(dataPath).catch(() => true)) {
    text = await adapter.read(dataPath).catch(() => null);
    const parsed = text === null ? undefined : parseJson(text);
    if (parsed === undefined) found.push({ kind: 'unreadable' });
    else raw = parsed;
  }
  const layout = validateLayout(
    raw,
    () => { found.push({ kind: 'unusable' }); },
    (count) => { found.push({ kind: 'blocks-dropped', count }); },
  );
  const problem = found[0] ?? null;
  if (!problem) return { layout, problem, backupPath: null, guard: new DataFileGuard(adapter, dataPath, false) };

  const backupPath = await backupDataFile(adapter, dataPath, text);
  return { layout, problem, backupPath, guard: new DataFileGuard(adapter, dataPath, backupPath === null) };
}

/** JSON.parse that reports failure as `undefined` instead of throwing. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Copy data.json to data.json.invalid, or to a timestamped sibling when that
 * name is taken, so a second corruption can never destroy the copy of the
 * first. `knownText` is the file's text when it was already read. Returns the
 * path written, or null when the copy failed (logged unless `logFailure` is false).
 */
async function backupDataFile(
  adapter: DataFileAdapter,
  dataPath: string,
  knownText: string | null = null,
  logFailure = true,
): Promise<string | null> {
  try {
    const text = knownText ?? await adapter.read(dataPath);
    const base = `${dataPath}.invalid`;
    let target = base;
    try {
      if (await adapter.exists(base)) target = `${base}.${Date.now()}`;
    } catch {
      // exists() failed: fall back to the base name rather than refusing to back up.
    }
    await adapter.write(target, text);
    return target;
  } catch (err) {
    if (logFailure) {
      console.error('[Homepage Blocks] Failed to back up data.json', err instanceof Error ? err.message : 'unknown error');
    }
    return null;
  }
}

/**
 * Holds writes to data.json back while an unusable original has not been
 * copied aside. The in-memory layout is then the default one, and the first
 * write of any kind (an auto-height persist of a homepage restored at startup
 * needs no user action) would destroy the only copy; so every write asks
 * first, and each ask retries the copy.
 */
export class DataFileGuard {
  constructor(
    private readonly adapter: DataFileAdapter,
    private readonly dataPath: string,
    private pending: boolean,
  ) {}

  /** Whether data.json may be written now; `backupPath` names a copy made by this call. */
  async allowWrite(): Promise<{ allowed: boolean; backupPath: string | null }> {
    if (!this.pending) return { allowed: true, backupPath: null };
    // Once the file is gone there is nothing left to protect. A check that
    // throws keeps the write held back.
    const gone = await this.adapter.exists(this.dataPath).then(exists => !exists, () => false);
    if (gone) {
      this.pending = false;
      return { allowed: true, backupPath: null };
    }
    // The failure was logged at load; retries on every save stay quiet.
    const backupPath = await backupDataFile(this.adapter, this.dataPath, null, false);
    if (backupPath === null) return { allowed: false, backupPath: null };
    this.pending = false;
    return { allowed: true, backupPath };
  }
}

/** The Notice for a load problem. It names a backup only when one was actually written. */
export function loadProblemMessage(problem: LoadProblem, backupPath: string | null): string {
  const what = problem.kind === 'unreadable'
    ? 'data.json could not be read, so the default layout was loaded.'
    : problem.kind === 'unusable'
      ? 'data.json does not hold a usable layout, so the default blocks were loaded.'
      : `${problem.count} block(s) couldn't be loaded (invalid, or past the limit of ${MAX_BLOCKS}) and were removed.`;
  const backup = backupPath
    ? ` The original file was saved as ${fileName(backupPath)}.`
    : ' The original file could not be backed up, so nothing will be saved until it can be; data.json is kept as it is.';
  return `Homepage blocks: ${what}${backup}`;
}

/**
 * The notice for blocks a newer plugin version wrote: kept and written back, but
 * not drawn (M58). Null when there are none.
 */
export function newerVersionMessage(layout: LayoutConfig): string | null {
  const n = (layout.preserved?.blocks.length ?? 0) + (layout.preserved?.mobileBlocks.length ?? 0);
  return n > 0 ? `Homepage blocks: ${n} block(s) need a newer version of the plugin. They are kept and not shown.` : null;
}

/**
 * The newer-version notice, once per set of kept blocks: `told` is the
 * signature of the set last told about (null for none), and the result carries
 * the signature to store. A notice at every launch about the same blocks was
 * noise; a new or a changed set is told again.
 */
export function newerVersionNotice(layout: LayoutConfig, told: string | null): { message: string; told: string } | null {
  const message = newerVersionMessage(layout);
  if (!message) return null;
  const ids = [...(layout.preserved?.blocks ?? []), ...(layout.preserved?.mobileBlocks ?? [])]
    .map(b => { const id = (b as { id?: unknown }).id; return typeof id === 'string' ? id : ''; }).sort().join(',');
  return ids === told ? null : { message, told: ids };
}

/** The last segment of a vault path. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
