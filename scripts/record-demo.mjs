#!/usr/bin/env node
/**
 * Records a scripted walkthrough of the Facade Designer and writes an MP4 (+GIF).
 *
 * The take: pick First One, size the wall, run through three quick looks
 * (Terracotta blend → Greens → Earthy mix), lay them out three ways (gradient →
 * checker → back to gradient, then turned left to right), hand-paint a four-tile
 * diamond in Ochre Medium high on the right and another in Grey Medium low on
 * the left, set a 15% waste allowance, then request a quote with the project
 * details filled in and send.
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
 * 16 × 16 → 4.86 × 4.74 m, 512 tiles. The app's own default is 10 × 10.
 */
const [GRID_COLS, GRID_COURSES] = String(flag('grid', '16x16')).toLowerCase().split('x');

/**
 * Placeholder identity for the lead-capture gate — not a real person. The
 * project fields are optional in the form and filled anyway: the take doubles
 * as the worked example of a well-formed request, and a quote with a project
 * and a phase on it is the one Pretty Plastic can actually price.
 */
const DEMO_LEAD = {
  first: 'Alex',
  last: 'Rivera',
  email: 'alex@rivera.studio',
  company: 'Rivera Studio',
  projectName: 'Zuidkade housing block',
  projectPhase: 'Definitive design', // one of the five PROJECT_PHASES options
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

/**
 * Click out the four-tile diamond nearest (ax, ay) — see pickDiamond — in the
 * currently selected swatch, named here only so the result can be checked.
 *
 * Worth checking: a click that misses a tile is silent. The pattern underneath
 * is ochre in places too, so a diamond that never landed still looks plausible
 * in the finished video — and the hand-painting is half of what the take is
 * for. Compare against the swatch's own colour rather than a copy of the
 * palette kept here, so a repaint of the app can't quietly invalidate it.
 */
async function paintDiamond(page, materialName, ax, ay) {
  const picks = await pickDiamond(page, ax, ay);
  if (picks.length !== 4) {
    throw new Error(`no room for a four-tile diamond near ${ax}, ${ay} of the wall`);
  }
  for (const t of picks) {
    await clickAt(page, t.x, t.y, { travel: 250, settle: 70 });
    await beat(70);
  }
  await beat(320);

  const materialId = materialName.toLowerCase().replace(/\s+/g, '-'); // "Ochre Dark" → ochre-dark
  const painted = await page.evaluate(
    ([cells, id, name]) => {
      const swatch = document.querySelector(`button.swatch[title^="${name}"]`);
      const want = getComputedStyle(swatch).backgroundColor;
      const svg = document.querySelector('.preview svg');
      // Photographed tiles carry the material in the texture path. Each photo
      // is hoisted into <defs> once and the tiles <use> it, so the path is one
      // hop away; a tile drawn without photography carries its material as a
      // flat polygon fill instead.
      const textureOf = (tile) => {
        const use = tile.querySelector('use[href^="#"]');
        const image = use
          ? svg.getElementById(use.getAttribute('href').slice(1))
          : tile.querySelector('image');
        return image?.getAttribute('href') ?? null;
      };
      return cells.filter((cell) => {
        const tile = svg.querySelector(`[data-cell="${cell}"]`);
        if (!tile) return false;
        const texture = textureOf(tile);
        if (texture !== null) return texture.includes(id);
        const polygon = tile.querySelector('polygon');
        return polygon !== null && getComputedStyle(polygon).fill === want;
      }).length;
    },
    [picks.map((p) => p.cell), materialId, materialName],
  );
  if (painted !== 4) {
    throw new Error(`only ${painted} of 4 tiles came out ${materialName} — a click missed`);
  }
}

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

/**
 * Four tiles of the real wall that meet as one larger diamond, sited as close to
 * (ax, ay) — fractions of the wall — as the geometry allows.
 *
 * First One is a fish-scale of diamonds, and adjacent rows are offset by half a
 * pitch. So a tile, its right-hand neighbour, and the two tiles half a pitch
 * along sitting above and below the seam between them share four edges and read
 * as a single diamond at twice the size — the motif you'd actually pick out on a
 * facade. Sizes come off the rendered tiles rather than the mm constants, so a
 * zoom or a viewport change can't put the picks between tiles.
 *
 * Returned in a path around the shape (top, left, bottom, right) so the cursor
 * draws the diamond instead of hopping across it.
 */
async function pickDiamond(page, ax, ay) {
  return page.evaluate(
    ([ax, ay]) => {
      const svg = document.querySelector('.preview svg');
      const groups = [...svg.querySelectorAll(':scope > g')];
      // the wall itself is the only untransformed group holding tiles; the
      // others are seamless repeats (translated) and the frame overlay
      const real = groups.find((g) => !g.hasAttribute('transform') && g.querySelector('[data-cell]'));
      const wall = real.getBoundingClientRect();
      const anchor = { x: wall.x + wall.width * ax, y: wall.y + wall.height * ay };

      const tiles = [...real.querySelectorAll('[data-cell]')].map((g) => {
        const r = g.getBoundingClientRect();
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
      });
      // the whole tiles set the pitch; every edge tile is a clipped half
      const pitchX = Math.max(...tiles.map((t) => t.w));
      const pitchY = Math.max(...tiles.map((t) => t.h));

      const cluster = (t) => [
        [t.cx + pitchX / 2, t.cy - pitchY / 2], // top
        [t.cx, t.cy], // left
        [t.cx + pitchX / 2, t.cy + pitchY / 2], // bottom
        [t.cx + pitchX, t.cy], // right
      ];

      // inside the wall by a comfortable margin (so no member is a cut edge
      // tile), and clear of the caption pill and the zoom bar
      const safe = (x, y) =>
        x > wall.x + pitchX * 0.6 &&
        x < wall.x + wall.width - pitchX * 0.6 &&
        y > wall.y + pitchY * 0.6 &&
        y < wall.y + wall.height - pitchY * 0.6 &&
        y < innerHeight - 130 &&
        !(x > innerWidth - 190 && y > innerHeight - 130);

      const candidates = tiles
        .filter((t) => t.w > pitchX * 0.9 && t.h > pitchY * 0.9)
        // rank on where the finished diamond lands, not on its left-hand tile
        .sort(
          (a, b) =>
            Math.hypot(a.cx + pitchX / 2 - anchor.x, a.cy - anchor.y) -
            Math.hypot(b.cx + pitchX / 2 - anchor.x, b.cy - anchor.y),
        );

      for (const t of candidates) {
        const points = cluster(t);
        if (!points.every(([x, y]) => safe(x, y))) continue;
        const picks = [];
        const seen = new Set();
        for (const [x, y] of points) {
          // whichever tile actually receives the click at that point wins
          const hit = document.elementFromPoint(x, y)?.closest?.('[data-cell]');
          if (!hit || !real.contains(hit)) break;
          const cell = hit.getAttribute('data-cell');
          if (seen.has(cell)) break; // four distinct cells or it isn't a diamond
          seen.add(cell);
          picks.push({ x: Math.round(x), y: Math.round(y), cell });
        }
        if (picks.length === 4) return picks;
      }
      return [];
    },
    [ax, ay],
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
/** Send-button to "Sent!" — the stubbed round trip, not real network time. */
let sendSeconds = 0;
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

  await step('quick looks', async () => {
    // Three of the six one-click looks, so the row reads as a range rather than
    // a single button that happens to do something. Each applies a fresh seed,
    // so each is a full regenerate — the pauses are mostly the app, not pacing.
    const look = async (name, caption, travel) => {
      await say(page, caption);
      await clickEl(page, page.locator(`button.preset[title="${name}"]`), { travel });
      await beat(760);
    };
    await look('Terracotta blend', 'Try a quick look — Terracotta blend', 400);
    await look('Greens', '…or go all greens', 300);
    await look('Earthy mix', '…or an earthy mix of all twelve', 300);
  });

  await step('pattern', async () => {
    // The look sets the palette; the pattern sets how it's laid out. Land back
    // on the gradient — it's the one the hand-painted diamonds read against.
    const select = page.locator('.section:has(h2:text-is("Pattern")) select').first();
    const box = await select.boundingBox();
    await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, 320);
    await beat(200);
    const pick = async (value, caption) => {
      await say(page, caption);
      await select.selectOption(value);
      await beat(800);
    };
    await pick('gradient', 'Lay the same colours out as a gradient');
    await pick('checker', '…or a checker');
    await pick('gradient', '…gradient it is');

    // The gradient's own Direction control — it only exists while the type is
    // Gradient, hence the tail of this step. Vertical by default, so this is
    // the beat that turns the bands from courses into columns.
    const direction = page.locator(
      '.section:has(h2:text-is("Pattern")) .field:has(label:text-is("Direction")) select',
    );
    await say(page, '…running left to right');
    const dirBox = await direction.boundingBox();
    await moveTo(page, dirBox.x + dirBox.width / 2, dirBox.y + dirBox.height / 2, 300);
    await beat(200);
    await direction.selectOption('horizontal');
    await beat(820);
  });

  await step('ochre medium', async () => {
    await say(page, 'Now paint tiles by hand — Ochre Medium');
    // the palette sits below the fold at this scroll position — bring it into
    // view once so both swatch clicks land
    await scrollPanelTo(page, page.locator('.palette-grid'), 430);
    await clickEl(page, page.locator('button.swatch[title^="Ochre Medium"]'), { travel: 380 });
    await beat(300);
    await say(page, 'Four tiles make one bigger diamond');
    // Each diamond sits against the far end of the palette: the horizontal
    // gradient runs ochre on the left to grey on the right, so an ochre reads
    // over on the grey side and a grey reads back on the ochre side.
    await paintDiamond(page, 'Ochre Medium', 0.88, 0.14); // high and right
  });

  await step('grey medium', async () => {
    await say(page, '…and Grey Medium in the opposite corner');
    await clickEl(page, page.locator('button.swatch[title^="Grey Medium"]'), { travel: 400 });
    await beat(280);
    await paintDiamond(page, 'Grey Medium', 0.12, 0.86); // low and left
    await beat(220);
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
    await say(page, 'Who you are…');
    await clickEl(page, page.locator('#lead-first-name'), { travel: 440 });
    await page.keyboard.type(DEMO_LEAD.first, { delay: 45 / SPEED });
    await beat(140);
    await page.locator('#lead-last-name').fill(DEMO_LEAD.last);
    await beat(150);
    await page.locator('#lead-email').fill(DEMO_LEAD.email);
    await beat(150);
    await page.locator('#lead-company').fill(DEMO_LEAD.company);
    await beat(260);

    // Project name and phase are optional in the form. Fill them anyway: this
    // take is the worked example, and they are what lets Pretty Plastic quote
    // against a real project instead of a bare square-metre figure.
    await say(page, '…and what the project is');
    await page.locator('#lead-project-name').fill(DEMO_LEAD.projectName);
    await beat(200);
    // the phase is a real click, so the cursor visibly reaches the project
    // block rather than the fields filling themselves from off to one side
    const phase = page.locator('#lead-project-phase');
    await clickEl(page, phase, { travel: 360 });
    await phase.selectOption(DEMO_LEAD.projectPhase);
    await beat(420);

    // Area and product below are already filled in from the design itself.
    await say(page, 'Area and product come from the design');
    await beat(760);
    await clickEl(page, page.getByRole('button', { name: 'Continue', exact: true }), { travel: 380 });
    await page.locator('#preview-subject').waitFor({ timeout: 10_000 });
    await say(page, 'Everything is written for you — edit or just send');
    await beat(1400);
  });

  await step('send', async () => {
    await clickEl(page, page.getByRole('button', { name: 'Send', exact: true }), { travel: 380 });
    await say(page, 'Sending it over…');
    const t0 = Date.now();
    await page.locator('p.note', { hasText: 'Sent!' }).waitFor({ timeout: 60_000 });
    sendSeconds = (Date.now() - t0) / 1000;
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
    ` send ${sendSeconds.toFixed(1)}s)`,
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
