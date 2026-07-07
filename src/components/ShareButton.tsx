import { useEffect, useState } from 'react';
import type { DesignState } from '../core/state/reducer';
import { shareUrl } from '../embed/share';
import { STR } from '../strings';

/**
 * Copies a link that reopens the exact current design (settings + any
 * hand-painted tiles, encoded in the URL hash). Also updates the address bar so
 * the browser's own share/bookmark works.
 */
export function ShareButton({ design }: { design: DesignState }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const onClick = async () => {
    const url = shareUrl(design);
    try {
      history.replaceState(null, '', url);
    } catch {
      /* embedded in an iframe with a different origin — hash update may be blocked */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // clipboard blocked (e.g. no https): select-and-copy fallback via prompt
      window.prompt(STR.copyLink, url);
    }
  };

  return (
    <div className="section">
      <button className="btn" style={{ width: '100%' }} onClick={onClick}>
        {copied ? `✓ ${STR.copied}` : `🔗 ${STR.copyLink}`}
      </button>
      <p className="note">{STR.shareHint}</p>
    </div>
  );
}
