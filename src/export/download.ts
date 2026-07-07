/** Trigger a browser download of a Blob (or data/object URL) as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  // Revoke after the click has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, mime: string): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** A safe, descriptive base filename, e.g. "pretty-plastic_first-one_10x20". */
export function baseName(productId: string, rows: number, cols: number): string {
  return `pretty-plastic_${productId}_${cols}x${rows}`;
}
