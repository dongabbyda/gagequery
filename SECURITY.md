# Security

GageQuery is a free, static training site. It has no server, no accounts and no cookies. Learners' SQL runs in their
own browser, in a Web Worker, on a private copy of the data, and nothing is sent anywhere.

## How it is protected

- **Content Security Policy** (`public/_headers`, also written into `dist/index.html` as a `<meta>` tag so hosts that
  cannot send headers, such as GitHub Pages, enforce it too): no remote scripts, styles, fonts or connections.
- **No remote resources at runtime.** Fonts are bundled into the page; there is no analytics or third-party script.
- **No `eval`, `new Function` or `document.write`.** Learner text and database values are written as text or escaped.
- **Saved and imported progress is validated** (`cleanState` in `src/app.js`): unknown keys, wrong shapes, unknown
  exercise ids and oversized values are dropped.
- **Sandboxed engine:** `ATTACH`, `writable_schema` and memory-limit pragmas are switched off, queries time out, and a
  learner's database cannot grow past about 32 MB.
- **Dependencies** are pinned (`package-lock.json`) and updated through Dependabot. `npm audit` is clean.

## Known limits

- Progress is stored in the browser and can be edited by the learner. This is fine for a free course; it would not be
  for certificates or a leaderboard, which would need server-side checks.
- Model answers ship inside the page, so a learner can read them.
- GitHub Pages cannot send response headers, so `frame-ancestors` (clickjacking protection) only applies on hosts that
  read `public/_headers`, such as Netlify and Cloudflare Pages.

## Reporting a problem

Open a private security advisory on the GitHub repository, or email the owner (see the profile on GitHub).
