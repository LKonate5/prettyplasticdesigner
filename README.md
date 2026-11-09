# Pretty Plastic Façade Designer

A self-contained web tool for designing walls of Pretty Plastic recycled-PVC
cladding tiles. Pick a product, set the wall size (in metres or rows×columns),
auto-generate or hand-paint a **seamlessly-tileable** colour pattern from the
12-material palette, choose a joint colour, read off a tile schedule and
order-ready quantities, then export (PNG, SVG, seamless texture, DXF, PDF, a laying plan,
3D GLB/OBJ), share a link, or email Pretty Plastic for a sample or a quote.

It's a **static front-end app** — no server, no database. It runs entirely in
the browser, so you can host it anywhere static and drop it into Squarespace
with an iframe (a small embedded window).

---

## The three products

| Product | Tile (mm) | Coverage | Notes |
|---|---|---|---|
| **First One** | 304 × 400 × 29 | 22.2 /m² | Diamond, overlapping fish-scale rows |
| **Second High** | 294 × 294 × 67 | 11.1 /m² | Square faceted; per-tile rotation is the design |
| **Basic Third** | 329 × 569 × 30 | 6.7 /m² | Rectangle, 3 relief bands; adjustable course exposure + bond |

Palette (all products): **ochre, terracotta, green, grey** × **light, medium,
dark** = 12 materials.

---

## Run it locally

You need [Node.js](https://nodejs.org) 18+ installed. Then, in this folder:

```bash
npm install      # one time — downloads the libraries it needs
npm run dev      # starts a local preview at http://localhost:5173
```

Open the printed URL in your browser. Edits to the code refresh instantly.

```bash
npm test         # run the maths/geometry tests (should say "43 passed")
```

## Build the static bundle (to host it)

```bash
npm run build    # writes a ready-to-host site into the dist/ folder
npm run preview  # optional: preview that built site locally
```

Everything the tool needs is inside **`dist/`** after this. Upload that
folder's contents to any static host — Netlify, Vercel, GitHub Pages, Cloudflare
Pages, or even a plain web-server folder. The current live deployment is:

`https://prettyplasticdesigner.vercel.app/`

> The build uses relative asset paths (`base: './'`), so it works no matter what
> sub-path it ends up hosted under.

---

## Embed it in Squarespace

1. Host the built site (previous step) and copy its public URL.
2. In Squarespace, edit the page → **Add Block → Code**.
3. Paste this Code Block:

```html
<div id="pp-designer-embed">
  <iframe
    id="pp-designer"
    src="https://prettyplasticdesigner.vercel.app/"
    title="Pretty Plastic Façade Designer"
    loading="lazy"
    allow="clipboard-write"
    style="width:100%; height:820px; border:0; display:block;"
  ></iframe>
</div>

<script>
  (function () {
    var iframe = document.getElementById('pp-designer');
    if (!iframe) return;

    var allowedOrigin = new URL(iframe.src).origin;

    window.addEventListener('message', function (e) {
      if (e.origin !== allowedOrigin) return;
      if (e.data && e.data.type === 'pp-designer:height') {
        iframe.style.height = Math.max(720, e.data.height) + 'px';
      }
    });
  })();
</script>
```

That's it — the iframe starts at 820 px high and then resizes itself when
Squarespace allows scripts in the Code Block. The panel collapses to a menu
button on narrow screens.

If Squarespace strips the `<script>` from the Code Block, keep only the
`<div>`/`<iframe>` there and put the `<script>` part in **Settings → Advanced →
Code Injection → Footer**.

```html
<iframe
  id="pp-designer"
  src="https://prettyplasticdesigner.vercel.app/"
  title="Pretty Plastic Façade Designer"
  loading="lazy"
  allow="clipboard-write"
  style="width:100%; height:820px; border:0; display:block;"
></iframe>
```

---

## Drop in the real tile textures (later)

Right now tiles use flat placeholder colours. To use real photographed tile
textures, drop PNG files into `public/textures/` using this naming:

```
public/textures/first-one/ochre-light.png
public/textures/first-one/ochre-medium.png
...
public/textures/second-high/green-dark.png
public/textures/basic-third/grey-medium.png
```

Pattern: `public/textures/{product}/{colour}-{shade}.png`
(`{product}` = `first-one` | `second-high` | `basic-third`).

No code changes needed — the app checks for each file at startup and uses it if
present, falling back to the placeholder colour if not. Add as few or as many as
you like. Then rebuild (`npm run build`).

To change the brand colours/fonts of the **interface** (not the tiles), edit the
handful of values at the top of `src/styles/theme.css`.

## Configuration (`src/config.ts` and `src/data/products.ts`)

- **`SALES_EMAIL`** (`config.ts`) — where the "Request a sample" and "Request a
  quote" buttons (and the download notifications) send their message. Defaults to
  `info@prettyplastic.nl`.
- **`palletM2`** (`products.ts`) — square metres of tile per europallet, per
  product (First One 40, Second High 30, Basic Third 60). Order quantities are
  rounded up to full square metres and divided into whole pallets.

---

## Sending email (Resend)

This is the one place the app is **not** 100% static: sending an actual email
needs a tiny server-side function, because the Resend API key must never be
visible to the browser (anything shipped to `src/` is downloadable by every
visitor via view-source — a key there could be stolen and used to send mail
under Pretty Plastic's name). So:

- `api/send-email.ts` — a **Vercel serverless function**. It reads
  `RESEND_API_KEY` from the server's environment and is the only code that ever
  touches it. The browser calls `POST /api/send-email` with the message text;
  the function fills in the real `from`/`to` and calls Resend.
- The recipient (`SALES_EMAIL`) is **hard-coded server-side**, not sent by the
  browser — so the endpoint can't be turned into an open relay to some other
  address.
- **"Request a sample"**, **"Request a quote"** and the notification sent on
  every export download all use this. Each email attaches a JPEG of the design
  (shrunk to stay under the endpoint's ~500 KB attachment limit) plus a
  compact link that reopens the exact design. If the send fails for any reason (missing key, offline, Resend error), each
  one falls back to opening the visitor's own email app with the same message
  pre-filled, so nothing is ever a dead end.

### Setup

1. Get an API key at [resend.com/api-keys](https://resend.com/api-keys).
2. **Local development:** copy `.env.example` to `.env` and paste the key in.
   `.env` is gitignored — never commit a real key.
3. **Production (Vercel):** add `RESEND_API_KEY` in the project's
   **Settings → Environment Variables** — not in a file at all.
4. The sender defaults to `Pretty Plastic Designer
   <designer@prettyplastic.nl>`. The `prettyplastic.nl` domain must remain
   [verified in Resend](https://resend.com/docs/dashboard/domains/introduction).
   Keep the sender different from the `info@prettyplastic.nl` recipient to
   avoid self-spoofing filters.

Because this needs a server-side function, the static build alone (the
`dist/` folder) can't send email on its own — it has to be **hosted on
Vercel** (or another platform that runs the same `/api` files) for that one
feature to work. Everything else in this app — the designer, every file
export — still runs 100% in the browser with no server at all.

---

## Exports

Four downloads, generated **in your browser**:

| Format | What it is |
|---|---|
| **PNG** | A picture of the wall. |
| **JPG** | The same picture as a JPG. |
| **PDF: render + tile spec sheet** | One A4 page: the render + a tile schedule (count/%/m²/weight per colour) for quoting. |
| **PDF: laying plan** | A3: which tile goes where. Every tile has a coordinate (column letter + course number, e.g. `F09`) and a colour code, with cut tiles hatched, a legend with counts, and a course-by-course list. Drawn to a true scale; a large wall is split over numbered sheets. |

---

## How the code is organised

```
src/
  core/        Pure logic, no UI — fully unit-tested
    layout/    Tile geometry per product (the single source of truth)
    pattern/   Seeded pattern generators
    state/     Undo/redo reducer
    schedule.ts, geometry.ts, types.ts
  render/      SVG scene (used on screen AND by every export)
  components/  The control panel + preview UI
  export/      SVG, PNG, seamless, DXF, PDF, laying plan, GLB, OBJ (each lazy-loaded)
  data/        Product specs + palette (edit these to add products/colours)
  strings.ts   All interface text (one place → easy to translate later)
```

**Adding a product** = add a spec in `data/products.ts` + a layout module in
`core/layout/`. **Adding a colour** = add a row in `data/palette.ts`. The core
logic doesn't need touching.
