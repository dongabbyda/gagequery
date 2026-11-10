#!/usr/bin/env python3
"""Bundle GageQuery into self-contained pages.

Reads   src/*, build/content.json, node_modules (codemirror, sql.js, terser), public/*
Writes  dist/index.html                 the site: one HTML file plus public/* (deploy the whole dist/ folder)
        build/gagequery.artifact.html   the same app as a claude.ai Artifact fragment (no <html>/<head>/<body>)

Everything (engine, editor, content, datasets) is inlined so the page works offline and needs no API.
"""
import base64, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, NM = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'node_modules')
BUILD, DIST, PUBLIC = os.path.join(ROOT, 'build'), os.path.join(ROOT, 'dist'), os.path.join(ROOT, 'public')


def read(*parts):
    return open(os.path.join(*parts), encoding='utf-8').read()


def safe(js):
    """Make text safe to place inside a <script> element."""
    return js.replace('</script', '<\\/script').replace('<!--', '<\\!--')


FONTS = [  # family, package, file: variable Latin subsets, inlined so the page makes no request to a font host
    ('Source Sans 3', 'source-sans-3', 'source-sans-3-latin-wght-normal.woff2'),
    ('Source Serif 4', 'source-serif-4', 'source-serif-4-latin-wght-normal.woff2'),
    ('JetBrains Mono', 'jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2'),
]


def font_css():
    out = []
    for family, pkg, name in FONTS:
        data = base64.b64encode(open(os.path.join(NM, '@fontsource-variable', pkg, 'files', name), 'rb').read()).decode()
        out.append("@font-face{font-family:'%s';font-style:normal;font-weight:200 900;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}" % (family, data))
    return ''.join(out)


def analytics_meta():
    """Optional anonymous visit counting: set GOATCOUNTER_URL (for example https://gagequery.goatcounter.com) when building.
    Without it the page contains no counter, which is what local runs and tests use."""
    url = os.environ.get('GOATCOUNTER_URL', '').strip().rstrip('/')
    if not url:
        return ''
    if not re.fullmatch(r'https://[a-z0-9-]+\.goatcounter\.com', url):
        sys.exit('GOATCOUNTER_URL must look like https://yourcode.goatcounter.com')
    if url not in read(PUBLIC, '_headers'):
        sys.exit('Add %s to img-src in public/_headers so the browser may load the counter image.' % url)
    return '<meta name="analytics-endpoint" content="%s">\n' % url


def ga_meta():
    """Optional Google Analytics, loaded only after the learner clicks Allow: set GA_MEASUREMENT_ID (G-...) when building."""
    ga = os.environ.get('GA_MEASUREMENT_ID', '').strip()
    if not ga:
        return ''
    if not re.fullmatch(r'G-[A-Z0-9]{4,16}', ga):
        sys.exit('GA_MEASUREMENT_ID must look like G-XXXXXXXXXX')
    if 'googletagmanager.com' not in read(PUBLIC, '_headers'):
        sys.exit('Allow Google Analytics in the Content-Security-Policy in public/_headers first.')
    return '<meta name="ga-measurement-id" content="%s">\n' % ga


def csp_meta():
    """The same policy as public/_headers, as a <meta> tag, for hosts (GitHub Pages) that cannot send headers.
    frame-ancestors is not allowed in a meta policy, so it is left out here."""
    line = next(l for l in read(PUBLIC, '_headers').splitlines() if l.strip().startswith('Content-Security-Policy:'))
    policy = line.split(':', 1)[1].strip()
    policy = '; '.join(d.strip() for d in policy.split(';') if d.strip() and not d.strip().startswith('frame-ancestors'))
    return '<meta http-equiv="Content-Security-Policy" content="%s">\n' % policy


def minify(paths):
    return subprocess.run(['node', os.path.join(NM, 'terser', 'bin', 'terser'), *paths, '-c', '-m'],
                          capture_output=True, text=True, encoding='utf-8', check=True).stdout


def main():
    content_path = os.path.join(BUILD, 'content.json')
    if not os.path.exists(content_path):
        sys.exit('build/content.json is missing. Run: npm run content')
    if not os.path.isdir(os.path.join(NM, 'codemirror')):
        sys.exit('node_modules is missing. Run: npm ci')

    cm = os.path.join(NM, 'codemirror')
    cm_js = minify([os.path.join(cm, p) for p in ('lib/codemirror.js', 'mode/sql/sql.js', 'addon/edit/matchbrackets.js',
                                                  'addon/hint/show-hint.js', 'addon/hint/sql-hint.js')])
    cm_css = read(cm, 'lib', 'codemirror.css') + read(cm, 'addon', 'hint', 'show-hint.css')
    sqljs = read(NM, 'sql.js', 'dist', 'sql-asm.js')
    content = json.load(open(content_path, encoding='utf-8'))
    data = json.dumps(content, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    head = read(SRC, 'head.html')
    shell = read(SRC, 'shell.html').replace('{{LOGO}}', read(SRC, 'logo.svg').strip())

    body = (f'\n<style>{font_css()}</style>\n<style>{cm_css}</style>\n{shell}'
            f'<script type="application/json" id="qc-data">{data}</script>\n'
            f'<script type="text/plain" id="sqljs-src">{safe(sqljs)}</script>\n'
            f'<script type="text/plain" id="engine-src">{safe(read(SRC, "engine.js"))}</script>\n'
            f'<script>{safe(cm_js)}</script>\n'
            f'<script>{safe(read(SRC, "app.js"))}</script>\n')

    os.makedirs(BUILD, exist_ok=True)
    frag = head + body
    open(os.path.join(BUILD, 'gagequery.artifact.html'), 'w', encoding='utf-8').write(frag)

    # Empty dist/ rather than deleting it: on Windows a folder held open by a server, editor or sync client cannot be removed.
    os.makedirs(DIST, exist_ok=True)
    for name in os.listdir(DIST):
        path = os.path.join(DIST, name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
    shutil.copytree(PUBLIC, DIST, dirs_exist_ok=True)
    page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' + csp_meta() + analytics_meta() + ga_meta() +
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="GageQuery: learn SQL by doing. From your first query to a capstone business review on six real-world datasets, every answer checked in your browser.">\n'
            '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n'
            + head + '\n</head>\n<body>' + body + '</body>\n</html>\n')
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(page)
    print('dist/index.html %d KB; build/gagequery.artifact.html %d KB' % (len(page.encode()) // 1024, len(frag.encode()) // 1024))


if __name__ == '__main__':
    main()
