/**
 * When embedded in an iframe, tell the host page our content height so it can
 * size the iframe (no inner scrollbar). Squarespace users can add a tiny
 * listener — see README — or just give the iframe a fixed height and ignore
 * this. Safe no-op when not framed.
 */
export function startAutoHeight(): void {
  if (typeof window === 'undefined' || window.parent === window) return;

  const post = () => {
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'pp-designer:height', height }, '*');
  };

  const ro = new ResizeObserver(post);
  ro.observe(document.documentElement);
  window.addEventListener('load', post);
  post();
}
