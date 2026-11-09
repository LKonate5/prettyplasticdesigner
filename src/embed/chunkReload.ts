/**
 * Recover from stale Vite chunks after a deploy.
 *
 * A tab left open across a deploy still points at old hashed /assets/*.js
 * files that 404 once the new build is live. Dynamic import() then fails with
 * "Failed to fetch dynamically imported module". Vite also fires
 * `vite:preloadError` for the same case.
 *
 * Reloading once picks up the new index.html (and its fresh chunk hashes).
 * Guarded by a sessionStorage timestamp so a broken deploy cannot loop.
 */

const KEY = 'pp-chunk-reload-at';
const COOLDOWN_MS = 30_000;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i;

/** True when `err` looks like a stale-chunk / failed dynamic-import failure. */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  let msg: string;
  if (err instanceof Error) {
    msg = `${err.name} ${err.message}`;
  } else if (typeof err === 'string') {
    msg = err;
  } else if (typeof err === 'object') {
    const o = err as { name?: unknown; message?: unknown };
    msg = `${o.name ?? ''} ${o.message ?? ''}`;
  } else {
    msg = String(err);
  }
  return CHUNK_ERROR_RE.test(msg);
}

function lastReloadAt(): number {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function markReload(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode / blocked storage — reload without the guard */
  }
}

/**
 * Reload the page once to pick up a fresh deploy. Returns true if a reload
 * was triggered; false if we already reloaded within the cooldown window
 * (caller should show a manual-reload message instead of looping).
 */
export function reloadForNewDeploy(): boolean {
  if (typeof window === 'undefined') return false;
  const ago = Date.now() - lastReloadAt();
  if (ago >= 0 && ago < COOLDOWN_MS) return false;
  markReload();
  window.location.reload();
  return true;
}

/** Install the Vite `vite:preloadError` listener (call once from main.tsx). */
export function installPreloadErrorReload(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    // Stop Vite's default logging; we handle recovery ourselves.
    event.preventDefault();
    reloadForNewDeploy();
  });
}
