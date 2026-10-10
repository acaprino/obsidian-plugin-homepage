import { Notice } from 'obsidian';
import { BlockInstance } from '../types';
import { MAX_BLOCKS } from '../validation';

/**
 * Whether one more block fits under MAX_BLOCKS. Says so when it does not: a
 * block past the limit would be saved and then deleted at the next load (M8).
 */
export function canAddBlock(blocks: BlockInstance[]): boolean {
  if (blocks.length < MAX_BLOCKS) return true;
  new Notice(`Homepage blocks: a homepage holds at most ${MAX_BLOCKS} blocks.`);
  return false;
}
