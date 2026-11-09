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
}

/** Best-effort analytics: tracking must never interrupt a design or export. */
export function trackDesignerEvent(name: string, params: AnalyticsParams = {}): void {
  try {
    window.gtag?.('event', name, { ...params, tool: 'facade_designer' });
  } catch {
    /* ignore */
  }
}
