# Security

GageQuery is a free, static training site. It has no server, no accounts and no cookies. Learners' SQL runs in their
own browser, in a Web Worker, on a private copy of the data, and nothing is sent anywhere.

## How it is protected

- **Content Security Policy** (`public/_headers`, also written into `dist/index.html` as a `<meta>` tag so hosts that
  cannot send headers, such as GitHub Pages, enforce it too): no remote scripts, styles, fonts or connections.
- **No remote resources at runtime.** Fonts are bundled into the page and there is no third-party script. The only outside request is an optional anonymous visit counter: a tiny image loaded from one GoatCounter address (the only origin the policy allows, as `img-src`). It sends the page name, a few milestones such as `solved/m03-e02`, the screen size and the referrer; it sets no cookies, never sends SQL or progress, and stores only the date of the last visit on the device (key `gagequery-seen`, no ID, never sent) to tell new from returning visitors, and is skipped when the browser sends Do Not Track or Global Privacy Control. It exists only in builds made with `GOATCOUNTER_URL`.
- **Consent first (GDPR, ePrivacy, Nigeria's NDPA).** Both optional tools, GoatCounter visit counting and Google Analytics, do nothing and store nothing until the learner agrees. The banner offers Accept all, Reject all (equally prominent) and Choose (one switch per tool, both off). The choice is recorded with its date and notice version (`gagequery-consent`) and asked again after 12 months or when `PRIVACY.version` changes. Privacy in the sidebar shows the full notice and the switches; withdrawing stops the tool and deletes what it stored. Do Not Track and Global Privacy Control mean no, with no banner. The notice (owner GageQuery, contact gagexplorerinc@gmail.com, age 16+) lives in `viewPrivacy()` in `src/app.js`; bump `PRIVACY.version` whenever what the tools collect changes.
- **Google Analytics is opt-in.** Builds made with `GA_MEASUREMENT_ID` show a consent banner. Until the learner clicks Allow, no Google script loads and nothing is sent to Google; No thanks, Do Not Track or Global Privacy Control keep it off. With consent, GA4 receives page views (each `#route` as a path), `exercise_solved` and `module_completed`; ads features are denied. The choice (`gagequery-analytics` in localStorage) can be changed on My progress, which disables GA and deletes its `_ga` cookies. The CSP allows `*.googletagmanager.com` (script, img, connect) and `*.google-analytics.com` / `*.analytics.google.com` (img, connect) for this; Google Tag Manager containers are deliberately not used, because they can load arbitrary code.
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
