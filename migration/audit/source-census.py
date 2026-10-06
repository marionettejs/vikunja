"""Count a pinned tracked source tree; keep tests and generated code separate."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('repository')
parser.add_argument('revision')
parser.add_argument('output')
args = parser.parse_args()
sha = subprocess.check_output(['git', 'rev-parse', args.revision], cwd=args.repository, text=True).strip()
paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', sha, '--', 'frontend/src'], cwd=args.repository, text=True).splitlines()
rows, counts = [], {}
for path in paths:
    if Path(path).suffix not in {'.ts', '.js', '.vue', '.css', '.scss'}:
        continue
    scope = 'generated' if path.startswith('frontend/src/client/generated/') else 'tests' if '.test.' in path or '.spec.' in path else 'source'
    lines = subprocess.check_output(['git', 'show', f'{sha}:{path}'], cwd=args.repository).decode().splitlines()
    row = {'path': path, 'scope': scope, 'physical_lines': len(lines), 'nonblank_lines': sum(bool(line.strip()) for line in lines)}
    rows.append(row)
    count = counts.setdefault(scope, {'files': 0, 'physical_lines': 0, 'nonblank_lines': 0})
    count['files'] += 1
    for field in ['physical_lines', 'nonblank_lines']:
        count[field] += row[field]
Path(args.output).write_text(json.dumps({'repository': args.repository, 'sha': sha, 'counts': counts, 'files': rows}, indent=2) + '\n')
print(json.dumps(counts))
