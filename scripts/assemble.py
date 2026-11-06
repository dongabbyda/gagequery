#!/usr/bin/env python3
"""Bundle GageQuery into self-contained pages.

Reads   src/*, build/content.json, node_modules (codemirror, sql.js, terser), public/*
Writes  dist/index.html                 the site: one HTML file plus public/* (deploy the whole dist/ folder)
        build/gagequery.artifact.html   the same app as a claude.ai Artifact fragment (no <html>/<head>/<body>)

Everything (engine, editor, content, datasets) is inlined so the page works offline and needs no API.
"""
import json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, NM = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'node_modules')
BUILD, DIST, PUBLIC = os.path.join(ROOT, 'build'), os.path.join(ROOT, 'dist'), os.path.join(ROOT, 'public')


def read(*parts):
    return open(os.path.join(*parts), encoding='utf-8').read()


def safe(js):
    """Make text safe to place inside a <script> element."""
    return js.replace('</script', '<\\/script').replace('<!--', '<\\!--')


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

    body = (f'\n<style>{cm_css}</style>\n{shell}'
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
    page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="GageQuery: learn SQL by doing. From your first query to a capstone business review on six real-world datasets, every answer checked in your browser.">\n'
            '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n'
            + head + '\n</head>\n<body>' + body + '</body>\n</html>\n')
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(page)
    print('dist/index.html %d KB; build/gagequery.artifact.html %d KB' % (len(page.encode()) // 1024, len(frag.encode()) // 1024))


if __name__ == '__main__':
    main()
