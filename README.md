# Pretty Plastic Facade Designer

A self-contained web tool for designing walls of Pretty Plastic recycled-PVC
cladding tiles. Pick a product, set the wall size (in metres or rows×columns),
auto-generate or hand-paint a **seamlessly-tileable** colour pattern from the
12-material palette, choose a joint colour, read off a tile schedule and
order-ready quantities, then export (PNG, JPEG, SVG, seamless texture, DXF, PDF,
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
Pages, or even a plain web-server folder. You'll get a public URL like
`https://pretty-plastic-designer.netlify.app/`.

> The build uses relative asset paths (`base: './'`), so it works no matter what
> sub-path it ends up hosted under.

---

## Embed it in Squarespace

1. Host the built site (previous step) and copy its public URL.
2. In Squarespace, edit the page → **Add Block → Code**.
3. Paste this, replacing the URL with yours:

```html
<iframe
  src="https://YOUR-HOSTED-URL/"
  title="Pretty Plastic Facade Designer"
  style="width:100%; height:820px; border:0;"
  loading="lazy"
></iframe>
```

That's it — a fixed 820 px height works well on desktop and the panel collapses
to a menu button on narrow screens.

### Optional: auto-resize the iframe to its content

The app posts its height to the parent page. If you want the iframe to grow/
shrink to fit (no inner scrollbar), add this **below** the iframe in the same
Code block, and give the iframe an `id="pp-designer"`:

```html
<script>
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'pp-designer:height') {
      var f = document.getElementById('pp-designer');
      if (f) f.style.height = e.data.height + 'px';
    }
  });
</script>
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

- **`SALES_EMAIL`** (`config.ts`) — where the "Request a sample", "Request a
  quote" and "Email to Pretty Plastic" buttons send their message. Defaults to
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
  touches it. The browser calls `POST /api/send-email` with just the message
  text (and an optional attachment); the function fills in the real `from`/`to`
  and calls Resend.
- The recipient (`SALES_EMAIL`) is **hard-coded server-side**, not sent by the
  browser — so the endpoint can't be turned into an open relay to some other
  address.
- **"Request a sample"**, **"Request a quote"** (which also attaches a preview
  image of the wall) and **Export → "Email to Pretty Plastic"** all use this.
  If the send fails for any reason (missing key, offline, Resend error), each
  one falls back to opening the visitor's own email app with the same message
  pre-filled, so nothing is ever a dead end.

### Setup

1. Get an API key at [resend.com/api-keys](https://resend.com/api-keys).
2. **Local development:** copy `.env.example` to `.env` and paste the key in.
   `.env` is gitignored — never commit a real key.
3. **Production (Vercel):** add `RESEND_API_KEY` in the project's
   **Settings → Environment Variables** — not in a file at all.
4. The sender address is Resend's shared testing address
   (`onboarding@resend.dev`), which works with no setup. For real production
   use, [verify a domain in Resend](https://resend.com/docs/dashboard/domains/introduction)
   (e.g. `prettyplastic.nl`) and change `FROM_EMAIL` in
   `api/_lib/sendEmail.ts` to a real address on it — this improves
   deliverability and stops the email looking like it came from a stranger.

Because this needs a server-side function, the static build alone (the
`dist/` folder) can't send email on its own — it has to be **hosted on
Vercel** (or another platform that runs the same `/api` files) for that one
feature to work. Everything else in this app — the designer, every file
export — still runs 100% in the browser with no server at all.

---

## Exports — what's real vs. interchange

Everything below is generated **in your browser**, client-side:

| Format | What it is |
|---|---|
| **PNG / JPEG** | A picture of the rendered wall (JPEG has a white background). |
| **SVG** | Scalable vector of the layout, at true 1:1 mm size. |
| **Seamless texture (PNG)** | A tileable image — one repeat of the pattern that wraps edge-to-edge, for 3D/render tools. Needs an even row count for offset patterns. |
| **DXF (2D)** | The industry CAD interchange file. Millimetre units, one layer per colour. Opens in **AutoCAD, Revit, and SketchUp**. |
| **PDF spec sheet** | One A4 page: the render + a tile schedule (count/% /m²/weight per colour) for quoting. |
| **3D model — GLB** | Single self-contained file: every tile extruded to its real thickness, colours baked in. Opens in **SketchUp (2021+), Blender, Windows 3D Viewer** and online glTF viewers. |
| **3D model — OBJ + MTL** | The same 3D wall as a zipped OBJ + material file — the most universal 3D interchange (older SketchUp, Rhino, 3ds Max, MeshLab). |

**SketchUp (.skp) and Revit (.rvt/.rfa)** are proprietary formats that can't be
written from a browser — no tool can. The correct path is to **import** the
GLB/OBJ (for 3D) or the DXF (for 2D); all of them open cleanly in SketchUp and
Revit.

The 3D model extrudes each tile's visible footprint to its true depth (First
One 29 mm, Second High 67 mm, Basic Third 30 mm) with a thin joint between
tiles. Surface relief (Second High's facets, Basic Third's bands) is shown in
the 2D render/texture, not carved into the mesh — the mesh carries the true
footprint, thickness and layout, which is what CAD/3D tools need.

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
  export/      SVG, PNG/JPEG, seamless, DXF, PDF, GLB, OBJ (each lazy-loaded)
  data/        Product specs + palette (edit these to add products/colours)
  strings.ts   All interface text (one place → easy to translate later)
```

**Adding a product** = add a spec in `data/products.ts` + a layout module in
`core/layout/`. **Adding a colour** = add a row in `data/palette.ts`. The core
logic doesn't need touching.
