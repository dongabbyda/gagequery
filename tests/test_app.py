"""End-to-end checks of the built app in headless Chromium, served with the production CSP."""
import pytest

pytestmark = pytest.mark.browser

ROUTES = ['learn', 'm01', 'm04', 'm06', 'm08', 'm10', 'm12', 'playground', 'datasets', 'progress', 'about']


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
    assert app.page.locator('#rail a[data-route^=m]').count() >= 12
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
