"""Content and dataset checks that need no browser (fast; run with `npm run test:fast`)."""
import filecmp, json, os, subprocess, sys
import pytest
from conftest import BUILD, ROOT, need

DATASETS = ['sales', 'sport', 'fashion', 'politics', 'finance', 'healthcare']


def test_every_query_verified():
    report = json.load(open(need(os.path.join(BUILD, 'verify_report.json')), encoding='utf-8'))
    assert report['problems'] == [], '\n'.join(report['problems'])
    assert report['modules'] == 12 and report['datasets'] == len(DATASETS)
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
