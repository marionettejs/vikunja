"""Summarize a matched published/native run without modifying or discarding samples."""
import argparse
import collections
import json
import math
import statistics
from pathlib import Path
from urllib.parse import parse_qs, urlparse

parser = argparse.ArgumentParser()
parser.add_argument('raw_directory')
parser.add_argument('output')
args = parser.parse_args()


def distribution(values):
    values = sorted(values)
    if not values:
        return {'n': 0}
    return {'n': len(values), 'median': round(statistics.median(values), 2),
            'p95': round(values[math.ceil(.95 * len(values)) - 1], 2),
            'min': round(min(values), 2), 'max': round(max(values), 2)}


def assets(resources):
    script_style = [r for r in resources if urlparse(r['name']).path.endswith(('.js', '.css'))]
    return {'js_css_requests': len(script_style),
            'js_css_decoded_bytes': sum(r['decodedBodySize'] for r in script_style),
            'js_css_transfer_bytes': sum(r['transferSize'] for r in script_style)}


result = {'protocol': 'Three warmups; all twenty measured samples retained. Nearest-rank p95. '
          'API response timing and input/publication marks use epoch milliseconds. Response-to-publication '
          'combines model/group/render/dispatch work, not function attribution. Small clock offsets remain visible. '
          'First-use asset entries are cleared before the action; Kanban uses document navigation. '
          'Heap counters are bounded-run observations, not leak attribution.', 'datasets': []}
for path in sorted(Path(args.raw_directory).glob('profile-raw-*.json')):
    data = json.loads(path.read_text())
    dataset = {'size': data['size'], 'source': data['source'], 'environment': data['environment'],
               'startup': {}, 'interactions': {}, 'first_use': {}, 'search_phases': {}, 'retention': {}, 'api': {}}
    for app in (a['name'] for a in data['apps']):
        startup = {}
        for cache in ['cold', 'warm']:
            rows = [x for x in data['samples'] if x['app'] == app and x['cache'] == cache and x['iteration'] >= 0]
            if len(rows) != 20:
                raise ValueError(f'{path}: {app} {cache} has {len(rows)} measured startup samples')
            startup[cache] = {
                'fcp_ms': distribution([next(p['start'] for p in x['timing']['paints'] if p['name'] == 'first-contentful-paint') for x in rows]),
                'ready_ms': distribution([x['timing']['ready'] for x in rows])}
            if cache == 'cold':
                transfers = [assets(x['timing'].get('resources', [])) for x in rows]
                startup[cache]['assets'] = {key: distribution([x[key] for x in transfers]) for key in transfers[0]}
        dataset['startup'][app] = startup
        for field, output_field in [('interactions', 'interactions'), ('firstUse', 'first_use')]:
            dataset[output_field][app] = {}
            for name in sorted({x['name'] for x in data.get(field, [])}):
                rows = [x for x in data[field] if x['app'] == app and x['name'] == name and x['iteration'] >= 0]
                if len(rows) != 20:
                    raise ValueError(f'{path}: {app} {name} has {len(rows)} measured samples')
                record = {'elapsed_ms': distribution([x['elapsed'] for x in rows])}
                if field == 'firstUse':
                    transfers = [assets(x['resources']) for x in rows]
                    record['assets'] = {key: distribution([x[key] for x in transfers]) for key in transfers[0]}
                elif all('before' in x for x in rows):
                    invalid = [x['iteration'] for x in rows if x['before']['metrics'].get('NavigationStart') != x['counters']['metrics'].get('NavigationStart')
                               or any(x['counters']['metrics'][key] < x['before']['metrics'][key] for key in ['ScriptDuration', 'TaskDuration'])]
                    if invalid:
                        record['cpu_counters'] = {'status': 'unavailable across document navigation or counter reset',
                                                  'invalid_iterations': invalid, 'raw_deltas_preserved_in_profile': True}
                    else:
                        record['script_ms'] = distribution([(x['counters']['metrics']['ScriptDuration'] - x['before']['metrics']['ScriptDuration']) * 1000 for x in rows])
                        record['main_thread_task_ms'] = distribution([(x['counters']['metrics']['TaskDuration'] - x['before']['metrics']['TaskDuration']) * 1000 for x in rows])
                dataset[output_field][app][name] = record
        phases = []
        for row in data.get('searchPhases', []):
            if row['app'] != app or row['iteration'] < 0:
                continue
            marks = row['phase']
            requests = [x for x in data['requests'] if x['app'] == app and x['phase'] == f"search-results:{row['iteration']}"
                        and parse_qs(urlparse(x['path']).query).get('s') == ['Bench task 0001']
                        and x.get('timing', {}).get('responseEnd', -1) >= 0]
            phase = {'input_to_publication_ms': marks['published'] - marks['input'],
                     'publication_to_paint_ms': marks['painted'] - marks['published'],
                     'input_to_paint_ms': marks['painted'] - marks['input'], 'search_requests': len(requests)}
            if requests:
                start = min(x['timing']['startTime'] + max(0, x['timing']['requestStart']) for x in requests)
                end = max(x['timing']['startTime'] + x['timing']['responseEnd'] for x in requests)
                phase.update(input_to_request_ms=start - marks['origin'] - marks['input'],
                             request_to_last_response_ms=end - start,
                             last_response_to_publication_ms=marks['origin'] + marks['published'] - end)
            phases.append(phase)
        dataset['search_phases'][app] = {key: distribution([x[key] for x in phases if key in x]) for key in sorted({k for x in phases for k in x})}
        dataset['retention'][app] = []
        for cycle in sorted({x['cycle'] for x in data['retention']}):
            rows = [x for x in data['retention'] if x['app'] == app and x['cycle'] == cycle]
            dataset['retention'][app].append({'cycle': cycle,
                'heap_mib': distribution([x['counters']['metrics']['JSHeapUsedSize'] / 1048576 for x in rows]),
                **{key: distribution([x['counters']['dom'][key] for x in rows]) for key in ['documents', 'nodes', 'jsEventListeners']}})
        requests = [x for x in data['requests'] if x['app'] == app]
        dataset['api'][app] = {'responses': len(requests), 'errors': [x for x in requests if x['status'] >= 400],
                              'decoded_bytes': sum(x.get('decodedBodyBytes', 0) for x in requests),
                              'body_unavailable': sum(bool(x.get('bodyUnavailable')) for x in requests),
                              'array_cardinalities': dict(collections.Counter(x['cardinality'] for x in requests if 'cardinality' in x))}
    result['datasets'].append(dataset)
Path(args.output).write_text(json.dumps(result, indent=2) + '\n')
print(args.output)
