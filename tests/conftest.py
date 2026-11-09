"""Shared fixtures: build outputs, a local server with production headers, and a headless browser."""
import json, os, sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
BUILD, DIST = os.path.join(ROOT, 'build'), os.path.join(ROOT, 'dist')


def need(path):
    if not os.path.exists(path):
        pytest.fail('%s is missing. Run `npm run build` first.' % os.path.relpath(path, ROOT), pytrace=False)
    return path


@pytest.fixture(scope='session')
def content():
    return json.load(open(need(os.path.join(BUILD, 'content.json')), encoding='utf-8'))


@pytest.fixture(scope='session')
def solution(content):
    mods = {m['id']: m for m in content['modules']}
    return lambda mid, n, ds: mods[mid]['exercises'][n - 1]['v'][ds]['sql']


@pytest.fixture(scope='session')
def base_url():
    need(os.path.join(DIST, 'index.html'))
    import serve
    srv = serve.start(0)
    yield 'http://127.0.0.1:%d/' % srv.server_address[1]
    srv.shutdown()


@pytest.fixture(scope='session')
def playwright_instance():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope='session')
def browser(playwright_instance):
    b = playwright_instance.chromium.launch()
    yield b
    b.close()


@pytest.fixture(scope='session')
def firefox(playwright_instance):
    try:
        b = playwright_instance.firefox.launch()
    except Exception:
        pytest.skip('Firefox is not installed (python -m playwright install firefox)')
    yield b
    b.close()


class App:
    """A loaded GageQuery page plus helpers that mirror what a learner does."""

    CM = "document.querySelector('.work .CodeMirror').CodeMirror"

    def __init__(self, page):
        self.page = page
        self.errors = []
        page.on('pageerror', lambda e: self.errors.append('pageerror: %s' % e))
        page.on('console', lambda m: self.errors.append('console: %s' % m.text) if m.type == 'error' else None)

    def real_errors(self):
        # Web fonts may be unreachable in CI; that is not an app error.
        return [e for e in self.errors if 'fonts.g' not in e and 'ERR_' not in e]

    def go(self, route):
        self.page.evaluate("r => { history.replaceState(null, '', '#' + r); window.dispatchEvent(new HashChangeEvent('hashchange')); }", route)

    def open_exercise(self, ex_id, ds):
        self.page.select_option('#ds-select', ds)
        self.page.wait_for_timeout(300)
        self.go(ex_id)
        self.page.wait_for_selector('.task', timeout=10000)

    def check(self, sql):
        """Type sql into the exercise editor, press Check answer, return ('ok'|'no', feedback text)."""
        self.page.evaluate("document.querySelectorAll('.fb').forEach(e => e.remove())")
        self.page.evaluate('s => %s.setValue(s)' % self.CM, sql)
        self.page.click(".action-bar button:has-text('Check answer')")
        fb = self.page.wait_for_selector('.fb', timeout=15000)
        return ('ok' if 'ok' in fb.get_attribute('class').split() else 'no'), fb.inner_text()


@pytest.fixture
def app_factory(browser, base_url):
    contexts = []

    def make(route='home', viewport=(1400, 900), init_script=None, **ctx):
        c = browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, **ctx)
        contexts.append(c)
        if init_script:
            c.add_init_script(init_script)
        app = App(c.new_page())
        app.page.goto(base_url + '#' + route)
        app.page.wait_for_selector('#engine.ready', state='attached', timeout=60000)
        return app

    yield make
    for c in contexts:
        c.close()


@pytest.fixture
def app(app_factory):
    return app_factory()
