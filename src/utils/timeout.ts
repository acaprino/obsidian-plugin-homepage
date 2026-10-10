/** The awaited work did not settle in time. */
export class RequestTimeoutError extends Error {}

/**
 * `promise`, or a RequestTimeoutError once `ms` have passed without it settling.
 * The work itself is not cancelled (requestUrl cannot be), only no longer awaited.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new RequestTimeoutError(`no response after ${ms} ms`)), ms);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      (err: unknown) => { window.clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); },
    );
  });
}
