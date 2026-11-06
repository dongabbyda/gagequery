"""End-to-end checks of the built app in headless Chromium, served with the production CSP."""
import pytest

pytestmark = pytest.mark.browser

ROUTES = ['learn', 'm00', 'm01', 'm04', 'm06', 'm08', 'm10', 'm12', 'm13', 'm14', 'practice', 'playground', 'datasets', 'progress', 'about']


def test_loads_in_worker_without_errors(app):
    assert 'ready' in app.page.get_attribute('#engine', 'class')
    assert app.page.evaluate('typeof window.__qcEngine') == 'undefined', 'engine fell back to the main thread; the worker was blocked'
    assert app.real_errors() == []


def test_in_browser_selftest_runs_every_query(app):
    r = app.page.evaluate('window.__qcSelfTest()')
    assert r['problems'] == [], r['problems'][:10]
    assert r['checked'] >= 700


def test_every_main_route_renders(app):
    for route in ROUTES:
        app.page.click('#rail a[data-route=%s]' % route)
        app.page.wait_for_timeout(150)
        assert app.page.inner_text('h1').strip(), route
    assert app.page.locator('#rail a[data-route^=m]').count() >= 15
    assert app.real_errors() == []


def test_wrong_then_right_answer(app, solution):
    app.open_exercise('m04-e03', 'sales')
    state, text = app.check('SELECT c.first_name, COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id')
    assert state == 'no' and text.strip()
    assert app.check(solution('m04', 3, 'sales'))[0] == 'ok'


@pytest.mark.parametrize('ex,ds,wrong,mid,n', [
    # a view with the wrong columns
    ('m10-e01', 'sport', 'CREATE VIEW player_goal_stats AS SELECT player_id FROM goals GROUP BY player_id;', 'm10', 1),
    # forbidden: wrapping the indexed column in a function
    ('m11-e03', 'finance', 'SELECT loan_id, disbursed_date FROM loans WHERE YEAR(disbursed_date) = 2025 AND MONTH(disbursed_date) = 6 ORDER BY loan_id;', 'm11', 3),
    # the NOT IN + NULL trap
    ('m11-e05', 'politics', 'SELECT party_name FROM parties WHERE party_id NOT IN (SELECT party_id FROM candidates) ORDER BY party_name;', 'm11', 5),
    # required: ROLLBACK, not COMMIT
    ('m12-e02', 'finance', 'START TRANSACTION; DELETE FROM repayments; COMMIT;', 'm12', 2),
])
def test_script_and_rule_exercises(app, solution, ex, ds, wrong, mid, n):
    app.open_exercise(ex, ds)
    assert app.check(wrong)[0] == 'no'
    assert app.check(solution(mid, n, ds))[0] == 'ok'


def test_index_exercise_accepts_any_index_name(app):
    app.open_exercise('m11-e01', 'sales')
    assert app.check('SELECT 1;')[0] == 'no'
    assert app.check('CREATE INDEX my_idx ON orders(customer_id);')[0] == 'ok'


def test_runaway_query_is_stopped(app):
    app.page.click('#rail a[data-route=playground]')
    app.page.wait_for_selector('.CodeMirror')
    app.page.evaluate("document.querySelector('.CodeMirror').CodeMirror.setValue('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT count(*) FROM r;')")
    app.page.click("button:has-text('Run')")
    assert app.page.wait_for_selector('.err', timeout=15000).inner_text().strip()


def test_phone_width_has_no_sideways_scroll(app_factory):
    app = app_factory('m04-e03', viewport=(390, 844), color_scheme='dark')
    app.page.wait_for_selector('.task')
    assert app.page.evaluate('document.documentElement.scrollWidth') <= 390


def test_progress_carries_over_from_querycraft(app_factory):
    old = "localStorage.setItem('querycraft-v1', JSON.stringify({ds: 'politics', progress: {}, drafts: {}, hints: {}, helped: {}}))"
    app = app_factory('home', init_script="if (!localStorage.getItem('gagequery-v1')) { %s }" % old)
    assert app.page.eval_on_selector('#ds-select', 'e => e.value') == 'politics'


def test_wrong_answer_lists_what_matches_and_names_the_mistake(app):
    app.open_exercise('m04-e03', 'sales')
    state, text = app.check('SELECT c.first_name, COUNT(*) FROM customers c JOIN orders o GROUP BY c.customer_id')
    assert state == 'no'
    assert app.page.locator('.fb .checklist li').count() >= 2
    assert 'ON' in text and 'JOIN' in text


def test_expected_output_shows_the_model_result(app):
    app.open_exercise('m03-e01', 'fashion')
    app.page.click("button:has-text('Show expected output')")
    app.page.wait_for_selector('.expected table.grid', timeout=10000)
    assert app.page.locator('.expected tbody tr').count() >= 1


def test_cleaning_exercise_requires_trim(app, solution):
    app.open_exercise('m13-e01', 'finance')
    no_trim = "SELECT signup_id, REPLACE(UPPER(full_name), '  ', ' ') AS name_clean, LOWER(email) AS email_clean FROM loan_applications ORDER BY signup_id;"
    assert app.check(no_trim)[0] == 'no'
    assert app.check(solution('m13', 1, 'finance'))[0] == 'ok'


def test_capstone_task_checks(app, solution):
    app.open_exercise('m14-e05', 'healthcare')
    assert app.check(solution('m14', 5, 'healthcare'))[0] == 'ok'
    assert '+200 XP' in app.page.inner_text('.fb.ok')


def test_old_progress_migrates_to_xp_streaks_and_practice(app_factory):
    old = ("localStorage.setItem('gagequery-v1', JSON.stringify({ds: 'sales', drafts: {}, hints: {'m01-e02@sales': 2}, helped: {},"
           " progress: {'m01-e01': {state: 'solved', ds: 'sales', at: Date.now()}, 'm01-e02': {state: 'solved', ds: 'sales', at: Date.now() - 864e5}}}))")
    app = app_factory('progress', init_script="if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); %s }" % old)
    assert '100 XP' in app.page.inner_text('#meter-text')
    assert app.page.locator('.badge-card.on').count() >= 1
    assert app.page.locator('figure.radar svg').count() == 1
    days = app.page.evaluate("[...document.querySelectorAll('.stats div')].find(d => d.innerText.includes('days practised')).querySelector('b').innerText")
    assert days == '2'
    app.go('practice')
    app.page.wait_for_selector('.why-review')
    assert 'hints' in app.page.inner_text('.stack')
    assert app.real_errors() == []


SEEDED = ("if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('gagequery-v1', JSON.stringify({v: 2, ds: 'sales',"
          " drafts: {}, hints: {}, helped: {}, days: {}, reviewed: {}, progress: {%s}})) }")


def test_dashboard_map_and_module_page_point_to_the_next_step(app_factory):
    done = ', '.join("'m00-e0%d': {state: 'solved', ds: 'sales', at: Date.now()}" % i for i in (1, 2, 3))
    app = app_factory('home', init_script=SEEDED % done)
    app.page.wait_for_selector('.welcome')
    assert app.page.get_attribute('.welcome .btn.primary', 'href') == '#m01-e01'
    app.go('learn')
    app.page.wait_for_selector('.mod-card.upnext')
    assert 'module 1' in app.page.inner_text('.mod-card.upnext').lower()
    app.go('m00')
    assert 'complete' in app.page.inner_text('.banner')
    assert app.real_errors() == []


def test_solving_the_last_exercise_completes_the_module(app_factory, solution):
    done = ', '.join("'m00-e0%d': {state: 'solved', ds: 'sales', at: Date.now()}" % i for i in (1, 2))
    app = app_factory('home', init_script=SEEDED % done)
    app.open_exercise('m00-e03', 'sales')
    state, text = app.check(solution('m00', 3, 'sales'))
    assert state == 'ok' and 'That completes Module 0' in text
    assert app.page.get_attribute('.fb.ok .btn.primary', 'href') == '#m01'


def test_theme_switcher_cycles_system_light_dark_and_remembers(app_factory):
    app = app_factory('home', color_scheme='dark')
    root = lambda: app.page.evaluate("document.documentElement.getAttribute('data-theme')")
    bg = lambda: app.page.evaluate("getComputedStyle(document.body).backgroundColor")
    assert root() is None and 'Theme: System' in app.page.get_attribute('#theme-btn', 'aria-label')
    dark_bg = bg()
    app.page.click('#theme-btn')
    assert root() == 'light' and bg() != dark_bg
    app.page.click('#theme-btn')
    assert root() == 'dark' and bg() == dark_bg
    app.page.reload(); app.page.wait_for_selector('#engine.ready', state='attached', timeout=60000)
    assert root() == 'dark'
    app.page.click('#theme-btn')
    assert root() is None and app.page.evaluate("localStorage.getItem('gagequery-theme')") is None
