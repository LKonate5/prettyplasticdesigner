#!/usr/bin/env node
/**
 * Records a scripted walkthrough of the Facade Designer and writes an MP4 (+GIF).
 *
 * The take is deterministic — every move, click and pause is a beat below — so
 * the video can be re-shot identically after a UI tweak. Playwright captures the
 * page only (no browser chrome); ffmpeg transcodes.
 *
 *   npm run dev          # the app must be running (or pass --url)
 *   npm run demo
 *
 * Flags: --url=… --speed=1.15 (tighten every beat) --headed --no-gif --keep-webm
 *
 * Two things Playwright can't do on its own, both handled by an injected
 * overlay (see installOverlay): videos have no mouse cursor, and there is no
 * caption track. The overlay draws both, following the real synthetic pointer.
 *
 * Nothing leaves the machine: /api/send-email is stubbed so the final "Sent!"
 * confirmation appears without touching Resend or the visitor's mail app.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// ── options ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

const URL_ = flag('url', 'http://localhost:5173/');
const SPEED = Number(flag('speed', 1)) || 1;
const HEADED = Boolean(flag('headed', false));
const MAKE_GIF = !flag('no-gif', false);
const KEEP_WEBM = Boolean(flag('keep-webm', false));
const VERBOSE = Boolean(flag('verbose', false));
const BUDGET_S = Number(flag('budget', 50)) || 50;
const TARGET_S = BUDGET_S - 2; // aim under, so a slow take still clears the cap
const MAX_FIT = 1.45; // beyond this the playback reads as fast-forward

const OUT_DIR = path.join(ROOT, 'videos');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const NAME = String(flag('name', 'facade-designer-v2'));
const VIEWPORT = { width: 1920, height: 1080 };

/**
 * Wall the walkthrough types in, as COLUMNS x COURSES — the app's primary size
 * control (metres sit behind a toggle). These commit on blur, so a multi-digit
 * value costs one regenerate instead of one per keystroke.
 *
 * A course is two internal tile rows, so cells = cols × courses × 2:
 * 16 × 14 → 4.86 × 4.15 m, 448 tiles. Default is 10 × 10.
 */
const [GRID_COLS, GRID_COURSES] = String(flag('grid', '16x14')).toLowerCase().split('x');

/** Placeholder identity for the lead-capture gate — not a real person. */
const DEMO_LEAD = {
  first: 'Alex',
  last: 'Rivera',
  email: 'alex@rivera.studio',
  company: 'Rivera Studio',
};

// ── in-page overlay: mouse cursor, click ripple, caption pill ────────────────
function installOverlay() {
  if (window.__demo) return;
  const boot = () => {
    if (window.__demo) return;
    const style = document.createElement('style');
    style.textContent = `
      #demo-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;
        pointer-events:none;opacity:0;transition:opacity .18s ease;will-change:transform;
        filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))}
      #demo-cursor.on{opacity:1}
      .demo-ripple{position:fixed;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;
        border-radius:50%;z-index:2147483646;pointer-events:none;background:rgba(255,255,255,.30);
        border:2px solid rgba(255,255,255,.95);box-shadow:0 0 0 1.5px rgba(0,0,0,.35);
        animation:demo-ripple .5s cubic-bezier(.2,.7,.3,1) forwards}
      @keyframes demo-ripple{from{transform:scale(.35);opacity:1}to{transform:scale(3);opacity:0}}
      #demo-caption{position:fixed;left:50%;bottom:36px;transform:translate(-50%,12px);
        z-index:2147483645;pointer-events:none;white-space:nowrap;
        font:500 16px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;
        letter-spacing:.005em;color:#fff;background:rgba(20,20,20,.82);
        -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
        padding:10px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.15);
        box-shadow:0 8px 28px rgba(0,0,0,.4);opacity:0;
        transition:opacity .22s ease,transform .22s ease}
      #demo-caption.on{opacity:1;transform:translate(-50%,0)}
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    // arrow with its tip at 0,0 so translate(x,y) lands the hotspot on the pointer
    cursor.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
      '<path d="M1 1 L1 18.4 L5.6 14.2 L8.6 20.8 L11.8 19.3 L8.8 12.9 L15 12.6 Z" ' +
      'fill="#fff" stroke="#141414" stroke-width="1.3" stroke-linejoin="round"/></svg>';

    const caption = document.createElement('div');
    caption.id = 'demo-caption';

    document.body.append(cursor, caption);

    const move = (e) => {
      cursor.classList.add('on');
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    addEventListener('pointermove', move, true);
    addEventListener('mousemove', move, true);
    addEventListener(
      'pointerdown',
      (e) => {
        const r = document.createElement('div');
        r.className = 'demo-ripple';
        r.style.left = `${e.clientX}px`;
        r.style.top = `${e.clientY}px`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 600);
      },
      true,
    );

    window.__demo = {
      caption(text) {
        if (!text) {
          caption.classList.remove('on');
          return;
        }
        caption.textContent = text;
        caption.classList.add('on');
      },
    };
  };
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
}

// ── driving helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const beat = (ms) => sleep(Math.max(0, ms / SPEED));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const cursor = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.5 };

/**
 * Eased pointer travel that lands in `ms` wall-clock. Each mouse.move is a CDP
 * round-trip (~10ms), so the pacing is a deadline per step, not a fixed sleep —
 * otherwise every move overshoots its beat and the take balloons.
 */
async function moveTo(page, x, y, ms = 420, maxSteps = 14) {
  const dur = ms / SPEED;
  const steps = Math.max(5, Math.min(maxSteps, Math.round(dur / 24)));
  const { x: x0, y: y0 } = cursor;
  const t0 = Date.now();
  for (let i = 1; i <= steps; i++) {
    const t = easeInOut(i / steps);
    await page.mouse.move(x0 + (x - x0) * t, y0 + (y - y0) * t);
    const rest = t0 + (dur * i) / steps - Date.now();
    if (rest > 0) await sleep(rest);
  }
  cursor.x = x;
  cursor.y = y;
}

async function clickAt(page, x, y, { travel = 420, settle = 130 } = {}) {
  await moveTo(page, x, y, travel);
  await beat(settle);
  await page.mouse.down();
  await beat(70);
  await page.mouse.up();
}

async function clickEl(page, locator, opts = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no bounding box for ${locator}`);
  await clickAt(page, box.x + box.width / 2, box.y + box.height / 2, opts);
}

const say = (page, text) => page.evaluate((t) => window.__demo?.caption(t), text);

/** Wheel-scroll the control panel so `locator` sits `targetY` px down the viewport. */
async function scrollPanelTo(page, locator, targetY) {
  const box = await locator.boundingBox();
  if (!box) return;
  const delta = Math.round(box.y - targetY);
  if (Math.abs(delta) < 8) return;
  await moveTo(page, 160, VIEWPORT.height * 0.5, 260);
  const steps = Math.max(4, Math.min(10, Math.round(Math.abs(delta) / 70)));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta / steps);
    await sleep(18 / SPEED);
  }
  await beat(140);
}

/** Tiles of the real wall (the untransformed group) nearest an anchor, deduped by hit test. */
async function pickTiles(page, count, ax, ay) {
  return page.evaluate(
    ([count, ax, ay]) => {
      const svg = document.querySelector('.preview svg');
      const groups = [...svg.querySelectorAll(':scope > g')];
      // the wall itself is the only untransformed group holding tiles; the
      // others are seamless repeats (translated) and the frame overlay
      const real = groups.find((g) => !g.hasAttribute('transform') && g.querySelector('[data-cell]'));
      const wall = real.getBoundingClientRect();
      const anchor = { x: wall.x + wall.width * ax, y: wall.y + wall.height * ay };

      const candidates = [...real.querySelectorAll('[data-cell]')]
        .map((g) => {
          const r = g.getBoundingClientRect();
          return { g, cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
        })
        // skip the clipped half-tiles at the wall edges and anything under the
        // caption pill / zoom bar
        .filter(
          (t) =>
            t.w > 40 &&
            t.cx > wall.x + t.w * 0.6 &&
            t.cx < wall.x + wall.width - t.w * 0.6 &&
            t.cy > wall.y + t.h * 0.6 &&
            t.cy < wall.y + wall.height - t.h * 0.6 &&
            t.cy < innerHeight - 130 &&
            !(t.cx > innerWidth - 190 && t.cy > innerHeight - 130),
        )
        .sort((a, b) => Math.hypot(a.cx - anchor.x, a.cy - anchor.y) - Math.hypot(b.cx - anchor.x, b.cy - anchor.y));

      const picks = [];
      const seen = new Set();
      for (const t of candidates) {
        // whichever tile actually receives the click at that point wins
        const hit = document.elementFromPoint(t.cx, t.cy)?.closest?.('[data-cell]');
        if (!hit || !real.contains(hit)) continue;
        const cell = hit.getAttribute('data-cell');
        if (seen.has(cell)) continue;
        seen.add(cell);
        picks.push({ x: Math.round(t.cx), y: Math.round(t.cy), cell });
        if (picks.length >= count) break;
      }
      return picks;
    },
    [count, ax, ay],
  );
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────
function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} failed:\n${res.stderr?.slice(-1200)}`);
  return res.stdout.trim();
}

function probeDuration(file) {
  return Number(
    run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      file,
    ]),
  );
}

/**
 * Decode the whole file to /dev/null. A half-copied mp4 still looks fine to
 * `ls` but has no moov atom, which is exactly what QuickTime reports as "not
 * compatible" — catch it here rather than on the user's screen.
 */
function verify(file) {
  run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  const d = probeDuration(file);
  if (!Number.isFinite(d) || d < 1) throw new Error(`${file} probed as ${d}s — bad encode`);
  return d;
}

// ── the take ─────────────────────────────────────────────────────────────────
const marks = [];
/** How long the app spent rasterising the wall for the quote attachment. */
let renderSeconds = 0;
/** Seconds of app boot at the head of the raw capture, trimmed on encode. */
let bootSeconds = 0;
/** Proof the quote never left the machine — asserted after the success note. */
let sendIntercepted = false;
const blockedHosts = new Set();
async function step(label, fn) {
  const t0 = Date.now();
  await fn();
  const s = (Date.now() - t0) / 1000;
  marks.push([label, s]);
  if (VERBOSE) console.log(`    · ${label} ${s.toFixed(1)}s`);
}

async function record() {
  await rm(RAW_DIR, { recursive: true, force: true });
  await mkdir(RAW_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    // pinned so the metre fields use a decimal POINT — a comma locale renders
    // "3,04" and rejects the "4.5" we type
    locale: 'en-GB',
    recordVideo: { dir: RAW_DIR, size: VIEWPORT },
  });
  await context.addInitScript(installOverlay);

  // recording starts with the page, so everything before the wall is painted in
  // is blank-screen boot — timed here, trimmed off on encode
  const tPage = Date.now();
  const page = await context.newPage();

  // Hard network guard. emailEndpoint() resolves to the PRODUCTION endpoint
  // during local dev (src/embed/email.ts), so an unintercepted Send would email
  // Pretty Plastic for real. Fulfil the send locally, let localhost through, and
  // refuse everything else outright rather than trusting one glob to match.
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    try {
      if (url.includes('/api/send-email')) {
        sendIntercepted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"ok":true}',
        });
        return;
      }
      if (/^(https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)|data:|blob:|about:)/.test(url)) {
        await route.continue();
        return;
      }
      blockedHosts.add(url.replace(/^(\w+:\/\/[^/]*).*/, '$1'));
      await route.abort();
    } catch {
      // a handler that throws leaves the request hanging forever — never let it
    }
  });

  try {
    await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  } catch (err) {
    await context.close();
    await browser.close();
    throw new Error(`Could not load ${URL_} — is the dev server running? (${err.message})`);
  }

  const panel = page.locator('aside.panel');
  await panel.waitFor({ timeout: 15_000 });
  // Tile photography loads async. The <image> elements appearing is not enough
  // — they have to be fetched and painted, or the trimmed video opens on a wall
  // of empty dark diamonds.
  // 'attached', not 'visible': the textures are hoisted into <defs> and
  // referenced by the tiles, so the <image> nodes themselves never render
  await page
    .locator('.preview svg image[href*="textures/first-one"]')
    .first()
    .waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await sleep(600);
  bootSeconds = (Date.now() - tPage) / 1000;
  await page.mouse.move(cursor.x, cursor.y);
  await beat(700);

  await step('product', async () => {
    await say(page, 'Start with the First One tile');
    await beat(360);
    await clickEl(page, page.locator('.seg.vertical button', { hasText: 'First One' }).first(), {
      travel: 520,
    });
    await beat(480);
  });

  await step('wall size', async () => {
    // Courses first: it lands the smaller of the two intermediate grids, so the
    // throwaway regenerate between the two commits is the cheap one. Enter/Tab
    // is what commits a DraftNumberInput — typing alone changes nothing.
    await say(page, 'Set the wall size');
    await clickEl(page, page.locator('#rows'), { travel: 380 });
    await page.keyboard.press('ControlOrMeta+a');
    await beat(140);
    await page.keyboard.type(GRID_COURSES, { delay: 70 / SPEED });
    await page.keyboard.press('Enter');
    await beat(520);
    await clickEl(page, page.locator('#cols'), { travel: 220 });
    await page.keyboard.press('ControlOrMeta+a');
    await beat(140);
    await page.keyboard.type(GRID_COLS, { delay: 70 / SPEED });
    await page.keyboard.press('Enter');
    await beat(620);
  });

  await step('preset', async () => {
    await say(page, 'Try a quick look — Terracotta blend');
    await clickEl(page, page.locator('button.preset[title="Terracotta blend"]'), { travel: 400 });
    await beat(800);
  });

  await step('pattern', async () => {
    await say(page, 'Choose a pattern');
    const select = page.locator('.section:has(h2:text-is("Pattern")) select').first();
    const box = await select.boundingBox();
    await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, 320);
    await beat(240);
    await select.selectOption('gradient');
    await beat(850);
  });

  await step('colour 1 + paint', async () => {
    await say(page, 'Pick a colour and paint tiles by hand');
    // the Grey row sits below the fold at this scroll position — bring the
    // whole palette into view once so both swatch clicks land
    await scrollPanelTo(page, page.locator('.palette-grid'), 430);
    await clickEl(page, page.locator('button.swatch[title^="Green Dark"]'), { travel: 380 });
    await beat(300);
    // high on the wall, where the vertical gradient is pale ochre — a dark
    // green reads instantly there, and light grey does the same down in the
    // terracotta at the bottom
    for (const t of await pickTiles(page, 4, 0.3, 0.24)) {
      await clickAt(page, t.x, t.y, { travel: 260, settle: 70 });
      await beat(70);
    }
    await beat(260);
  });

  await step('colour 2 + paint', async () => {
    await say(page, '…and a second colour');
    await clickEl(page, page.locator('button.swatch[title^="Grey Light"]'), { travel: 400 });
    await beat(280);
    for (const t of await pickTiles(page, 4, 0.68, 0.74)) {
      await clickAt(page, t.x, t.y, { travel: 260, settle: 70 });
      await beat(70);
    }
    await beat(450);
  });

  await step('waste', async () => {
    await say(page, 'Add a 15% waste allowance');
    const waste = page.locator('#waste');
    await scrollPanelTo(page, waste, 300);
    const box = await waste.boundingBox();
    const PAD = 8; // half the range thumb
    const xFor = (v) => box.x + PAD + ((box.width - PAD * 2) * v) / 0.25;
    const y = box.y + box.height / 2;
    await moveTo(page, xFor(0.1), y, 360);
    await beat(180);
    await page.mouse.down();
    // few steps on purpose: each one that changes the value re-renders the wall
    await moveTo(page, xFor(0.15), y, 480, 7);
    await page.mouse.up();
    // land exactly on 15% whatever the thumb geometry did
    for (let i = 0; i < 25; i++) {
      const v = Number(await waste.inputValue());
      if (Math.abs(v - 0.15) < 0.001) break;
      await page.keyboard.press(v < 0.15 ? 'ArrowRight' : 'ArrowLeft');
      await sleep(40 / SPEED);
    }
    await beat(850);
  });

  await step('request quote', async () => {
    await say(page, 'Request a quote');
    const quote = page.getByRole('button', { name: 'Request a quote', exact: true });
    await scrollPanelTo(page, quote, 640);
    await clickEl(page, quote, { travel: 440 });
    await page.locator('#lead-first-name').waitFor({ timeout: 10_000 });
    await beat(480);
  });

  await step('lead form', async () => {
    // Type the first field so the form reads as hand-filled, then fill() the
    // rest: every keystroke re-renders the wall behind the modal, and 40 of
    // them cost more screen time than the whole painting sequence.
    await clickEl(page, page.locator('#lead-first-name'), { travel: 440 });
    await page.keyboard.type(DEMO_LEAD.first, { delay: 45 / SPEED });
    await beat(140);
    await page.locator('#lead-last-name').fill(DEMO_LEAD.last);
    await beat(160);
    await page.locator('#lead-email').fill(DEMO_LEAD.email);
    await beat(160);
    await page.locator('#lead-company').fill(DEMO_LEAD.company);
    await beat(320);
    await clickEl(page, page.getByRole('button', { name: 'Continue', exact: true }), { travel: 380 });
    await page.locator('#preview-subject').waitFor({ timeout: 10_000 });
    await beat(1100);
  });

  await step('send', async () => {
    await clickEl(page, page.getByRole('button', { name: 'Send', exact: true }), { travel: 380 });
    // the quote attaches a rendered PNG of the wall, so this is real work —
    // caption it rather than leaving the button on "…" in silence
    await say(page, 'Rendering your wall and sending it over');
    const t0 = Date.now();
    await page.locator('p.note', { hasText: 'Sent!' }).waitFor({ timeout: 60_000 });
    renderSeconds = (Date.now() - t0) / 1000;
    if (!sendIntercepted) {
      throw new Error('the app reported "Sent!" without the stub firing — a real email may have gone out');
    }
    await say(page, 'Sent straight to Pretty Plastic');
    await beat(1600);
    await say(page, null);
    await beat(350);
  });

  const video = page.video();
  await context.close();
  const webm = await video.path();
  await browser.close();
  return webm;
}

// ── main ─────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const webmTmp = await record();
const wall = (Date.now() - t0) / 1000;

await mkdir(OUT_DIR, { recursive: true });
const webm = path.join(RAW_DIR, `${NAME}.webm`);
if (webmTmp !== webm) await rename(webmTmp, webm);

// open on the finished wall, not on a blank booting page (a beat of lead-in is
// kept so the first frame is settled rather than mid-fade)
const trim = Math.max(0, bootSeconds - 0.8);

// How long the app takes to re-render 600+ SVG tiles swings by ~10s between
// takes, so the raw length isn't something the beat sheet alone can pin down.
// Nudge playback to land under the budget — nothing is cut, it just plays a
// touch quicker.
const rawDuration = probeDuration(webm) - trim;
const fit =
  Number.isFinite(rawDuration) && rawDuration > TARGET_S
    ? Math.min(MAX_FIT, rawDuration / TARGET_S)
    : 1;

// H.264 High@4.0 / yuv420p / bt709 / faststart — the combination QuickTime,
// Preview, Slack and Keynote all open without transcoding
const mp4 = path.join(OUT_DIR, `${NAME}.mp4`);
run('ffmpeg', [
  '-y', '-i', webm,
  '-ss', trim.toFixed(2),
  '-an',
  '-vf', `setpts=(PTS-STARTPTS)/${fit.toFixed(4)},fps=30,scale=1920:-2:flags=lanczos`,
  '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0',
  '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-movflags', '+faststart',
  mp4,
]);
verify(mp4);

let gif = null;
if (MAKE_GIF) {
  gif = path.join(OUT_DIR, `${NAME}.gif`);
  const palette = path.join(RAW_DIR, 'palette.png');
  run('ffmpeg', [
    '-y', '-i', mp4,
    '-vf', 'fps=10,scale=640:-2:flags=lanczos,palettegen=stats_mode=diff',
    '-f', 'image2', palette,
  ]);
  run('ffmpeg', [
    '-y', '-i', mp4, '-i', palette,
    '-lavfi', 'fps=10,scale=640:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
    '-loop', '0', gif,
  ]);
}

if (!KEEP_WEBM) await rm(RAW_DIR, { recursive: true, force: true });

const dur = verify(mp4); // re-check after the GIF pass and the raw cleanup
const mb = async (f) => ((await stat(f)).size / 1e6).toFixed(1);

console.log('\n  beats');
for (const [label, s] of marks) console.log(`    ${label.padEnd(18)} ${s.toFixed(1)}s`);
console.log(
  `\n  drive time   ${wall.toFixed(1)}s   (boot ${bootSeconds.toFixed(1)}s trimmed,` +
    ` wall raster ${renderSeconds.toFixed(1)}s)`,
);
console.log(`  captured     ${rawDuration.toFixed(1)}s → played at ${fit.toFixed(2)}×`);
console.log(
  `  send         stubbed locally${blockedHosts.size ? `, blocked ${[...blockedHosts].join(', ')}` : ', no off-localhost requests'}`,
);
console.log(`  ${path.relative(ROOT, mp4)}  ${dur.toFixed(1)}s  ${await mb(mp4)} MB`);
if (gif) console.log(`  ${path.relative(ROOT, gif)}  ${await mb(gif)} MB`);

if (dur > BUDGET_S) {
  const suggest = (SPEED * (dur / TARGET_S)).toFixed(2);
  console.log(
    `\n  ⚠ ${dur.toFixed(1)}s is over the ${BUDGET_S}s budget even at ${fit.toFixed(2)}× —` +
      ` re-run with --speed=${suggest}`,
  );
  process.exitCode = 1;
} else {
  console.log(`  ✓ under the ${BUDGET_S}s budget`);
}
