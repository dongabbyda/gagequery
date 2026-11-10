"""Content and dataset checks that need no browser (fast; run with `npm run test:fast`)."""
import filecmp, json, os, subprocess, sys
import pytest
from conftest import BUILD, ROOT, need

DATASETS = ['sales', 'sport', 'fashion', 'politics', 'finance', 'healthcare']


def test_every_query_verified():
    report = json.load(open(need(os.path.join(BUILD, 'verify_report.json')), encoding='utf-8'))
    assert report['problems'] == [], '\n'.join(report['problems'])
    assert report['modules'] == 16 and report['datasets'] == len(DATASETS)
    assert report['queries_checked'] == (report['examples'] + report['exercises']) * len(DATASETS)


def test_dataset_order(content):
    assert content['order'] == DATASETS
    for ds in DATASETS:
        meta = content['datasets'][ds]
        assert meta['today'] == '2025-12-31', 'all datasets share one fixed "today" so date answers never drift'
        assert all(n > 0 for n in meta['rowCounts'].values()), ds


def test_ids_unique_and_every_exercise_has_all_six_datasets(content):
    seen = set()
    for m in content['modules']:
        assert m['concepts'], m['id'] + ' has no concepts'
        for e in m['exercises']:
            assert e['id'] not in seen, 'duplicate exercise id ' + e['id']
            seen.add(e['id'])
            assert sorted(e['v']) == sorted(DATASETS), e['id']
            for ds, v in e['v'].items():
                assert v.get('sql', '').strip(), '%s %s has no model answer' % (e['id'], ds)


STAGING = {'sales': 'web_signups', 'sport': 'fan_signups', 'fashion': 'newsletter_signups', 'politics': 'volunteer_signups',
           'finance': 'loan_applications', 'healthcare': 'patient_intake'}


def test_every_dataset_has_its_messy_signup_table(content):
    # Module 13 depends on these raw import tables and on the planted problems in them.
    for ds, table in STAGING.items():
        assert content['datasets'][ds]['rowCounts'].get(table) == 45, ds


def test_capstone_and_start_modules(content):
    mods = {m['id']: m for m in content['modules']}
    assert mods['m00']['number'] == 0 and mods['m14']['capstone'] and not mods['m13']['capstone']
    assert len(mods['m14']['exercises']) == 6 and not mods['m14']['examples']


def test_generated_datasets_are_reproducible(tmp_path):
    subprocess.run([sys.executable, os.path.join(ROOT, 'datasets', 'generate.py'), str(tmp_path)], check=True, capture_output=True)
    for ds in DATASETS[1:]:
        assert filecmp.cmp(tmp_path / (ds + '.sql'), os.path.join(ROOT, 'datasets', ds + '.sql'), shallow=False), \
            ds + '.sql differs from the generator output. Commit the regenerated file (npm run data) or revert the generator.'


def test_built_pages():
    page = open(need(os.path.join(ROOT, 'dist', 'index.html')), encoding='utf-8').read()
    frag = open(need(os.path.join(BUILD, 'gagequery.artifact.html')), encoding='utf-8').read()
    assert page.startswith('<!doctype html>') and '<title>GageQuery</title>' in page
    assert '<html' not in frag and '<body' not in frag, 'artifact fragment must not carry its own document skeleton'
    assert 'QueryCraft' not in page, 'old product name leaked into the build'
    assert len(page.encode()) < 8 * 1024 * 1024
    for f in ('favicon.svg', '_headers', 'robots.txt'):
        assert os.path.exists(os.path.join(ROOT, 'dist', f)), f


def test_page_has_no_remote_resources_and_carries_its_own_csp():
    page = open(need(os.path.join(ROOT, 'dist', 'index.html')), encoding='utf-8').read()
    assert 'googleapis' not in page and 'gstatic' not in page, 'fonts must be bundled, not loaded from a font host'
    head = page.split('</head>')[0]
    assert 'http-equiv="Content-Security-Policy"' in head, 'hosts without header support (GitHub Pages) rely on the meta policy'
    meta = head.split('http-equiv="Content-Security-Policy" content="')[1].split('"')[0]
    assert "default-src 'none'" in meta and "script-src 'self' 'unsafe-inline'" in meta and 'frame-ancestors' not in meta
    directives = {d.split()[0]: d.split()[1:] for d in meta.split('; ')}
    remote = {k: sorted(x for x in v if x.startswith('http')) for k, v in directives.items()}
    ga = ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com']
    assert remote == {'default-src': [], 'script-src': ['https://*.googletagmanager.com'], 'style-src': [], 'font-src': [],
                      'img-src': sorted(['https://gagequery.goatcounter.com', ga[0], ga[2]]), 'connect-src': sorted(ga),
                      'worker-src': [], 'base-uri': [], 'form-action': []}, 'only the visit counter and consented Google Analytics may be remote'
    assert 'analytics-endpoint' not in head, 'a normal build has no counter; only a build given GOATCOUNTER_URL does'
    assert 'ga-measurement-id' not in head, 'a normal build has no Google Analytics; only a build given GA_MEASUREMENT_ID does'
    headers = open(need(os.path.join(ROOT, 'public', '_headers')), encoding='utf-8').read()
    assert 'googleapis' not in headers and "frame-ancestors 'none'" in headers



def test_modules_are_numbered_by_course_order(content):
    ids = [m['id'] for m in content['modules']]
    assert [m['number'] for m in content['modules']] == list(range(len(ids))), 'the number shown is the position in the course'
    assert ids[:4] == ['m00', 'm01', 'm15', 'm02'], 'Creating and Changing Tables comes straight after Getting Started'
    assert content['modules'][-1]['capstone'], 'the capstone stays last'


def test_postgresql_snippets_on_dialect_cards_really_run():
    import shutil
    if not shutil.which('node') or not os.path.isdir(os.path.join(ROOT, 'node_modules', '@electric-sql', 'pglite')):
        pytest.skip('needs node and the PGlite dev dependency (npm ci)')
    out = subprocess.run(['node', os.path.join(ROOT, 'tests', 'check_dialects.mjs')], capture_output=True, text=True, encoding='utf-8', timeout=300)
    assert out.returncode == 0, out.stderr[-2000:]
    result = json.loads(out.stdout.strip().splitlines()[-1])
    assert result['problems'] == [], result['problems']
    assert result['checked'] >= 6
