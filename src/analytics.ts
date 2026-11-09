// GA4 tracking for the Façade Designer. It reports into the same GA4 property as prettyplastic.nl
// (measurement id below), so the marketing dashboard can show designer exports and requests on
// their own, separate from the website's contact forms and downloads.
//
// Event names (the dashboard queries exactly these, see config/dashboard.config.json → ga4.events):
//   facade_designer_export          a file was exported (export_format, product_id)
//   facade_designer_sample_request  a sample request was sent from the designer (product_id)
//   facade_designer_quote_request   a quote request was sent from the designer (product_id)
const MEASUREMENT_ID = 'G-Z0CELBG9LE';

/** Only the production designer reports; previews and local builds would pollute the numbers. */
const TRACKED_HOSTS = [/^prettyplasticdesigner\.vercel\.app$/i, /(^|\.)prettyplastic\.nl$/i];

type AnalyticsParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

// --- Meta pixel (same pixel as prettyplastic.nl), loaded only after marketing consent -------------
// Used to measure Instagram/Facebook ad visits to the designer. Consent is stored in localStorage and
// asked with a small banner when the designer runs standalone (design.prettyplastic.nl). When embedded
// in an iframe the host page can grant it with postMessage({ type: 'pp-consent', granted: true }).
const META_PIXEL_ID = '972680593112110';
const CONSENT_KEY = 'pp_marketing_consent';
let metaLoaded = false;

function readConsent(): 'granted' | 'denied' | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function storeConsent(v: 'granted' | 'denied'): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* ignore */
  }
}

function loadMetaPixel(): void {
  if (metaLoaded || window.fbq) return;
  metaLoaded = true;
  const w = window;
  const fbq = function (this: unknown, ...args: unknown[]) {
    if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void).apply(fbq, args);
    else fbq.queue.push(args);
  } as NonNullable<Window['fbq']> & { queue: unknown[] };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  w.fbq = fbq;
  w._fbq = fbq;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');
}

function showConsentBanner(): void {
  const bar = document.createElement('div');
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookies');
  bar.style.cssText =
    'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:520px;background:#fff;color:#1c1c1e;' +
    'border:1px solid #dedbd4;border-radius:6px;padding:12px 14px;font:13px/1.4 "Work Sans",system-ui,sans-serif;' +
    'box-shadow:0 4px 18px rgba(0,0,0,.15);display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  const text = document.createElement('span');
  text.style.flex = '1 1 220px';
  text.textContent =
    'We use marketing cookies (Meta) to measure our ads. Allow them? The designer works either way.';
  const mk = (label: string, primary: boolean, v: 'granted' | 'denied') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'cursor:pointer;border-radius:6px;padding:6px 12px;font:inherit;border:1px solid #cf5b2e;' +
      (primary ? 'background:#cf5b2e;color:#fff' : 'background:#fff;color:#cf5b2e');
    b.onclick = () => {
      storeConsent(v);
      bar.remove();
      if (v === 'granted') loadMetaPixel();
    };
    return b;
  };
  bar.append(text, mk('Decline', false, 'denied'), mk('Allow', true, 'granted'));
  document.body.appendChild(bar);
}

function initMetaConsent(): void {
  const consent = readConsent();
  if (consent === 'granted') loadMetaPixel();
  window.addEventListener('message', (e) => {
    const d = e.data as { type?: string; granted?: boolean } | null;
    if (d && d.type === 'pp-consent' && e.source === window.parent) {
      storeConsent(d.granted ? 'granted' : 'denied');
      if (d.granted) loadMetaPixel();
    }
  });
  // Standalone visit without a choice yet: ask. In an iframe the host page owns the banner.
  if (consent === null && window.parent === window) {
    if (document.body) showConsentBanner();
    else window.addEventListener('DOMContentLoaded', showConsentBanner, { once: true });
  }
}

export function initAnalytics(): void {
  if (typeof window === 'undefined' || window.gtag) return;
  if (!TRACKED_HOSTS.some((re) => re.test(window.location.hostname))) return;

  window.dataLayer = window.dataLayer ?? [];
  // gtag.js only accepts the `arguments` object, not an array: keep this a classic function.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    // The designer runs in an iframe on prettyplastic.nl: its cookie must be allowed cross-site.
    cookie_flags: 'SameSite=None;Secure',
    tool: 'facade_designer',
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  initMetaConsent();
}

/** Best-effort analytics: tracking must never interrupt a design or export. */
export function trackDesignerEvent(name: string, params: AnalyticsParams = {}): void {
  try {
    window.gtag?.('event', name, { ...params, tool: 'facade_designer' });
    window.fbq?.('trackCustom', name, params); // no-op until marketing consent loaded the pixel
  } catch {
    /* ignore */
  }
}
