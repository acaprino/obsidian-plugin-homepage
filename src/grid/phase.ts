/**
 * Grid lifecycle phases. Controls which operations are allowed — drag/resize events
 * fired during Initializing (GridStack's own layout pass) are suppressed so they
 * don't corrupt the persisted layout. Destroyed guards every callback that could
 * still be in flight after teardown().
 */
export const Phase = {
  Destroyed: 0,
  Initializing: 1,
  Ready: 2,
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];
