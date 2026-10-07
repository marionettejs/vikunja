"""Measure emitted assets, retaining per-file hashes and deterministic gzip sizes."""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('build_directory')
parser.add_argument('output')
args = parser.parse_args()
root = Path(args.build_directory).resolve()
files = {}
for path in sorted(root.rglob('*')):
    if not path.is_file():
        continue
    name = path.relative_to(root).as_posix()
    raw = path.read_bytes()
    kind = 'maps' if path.suffix == '.map' else 'js' if path.suffix == '.js' else 'css' if path.suffix == '.css' else 'fonts' if path.suffix in {'.woff', '.woff2', '.ttf'} else 'other'
    files[name] = {'kind': kind, 'raw': len(raw), 'gzip9_mtime0': len(gzip.compress(raw, compresslevel=9, mtime=0)), 'sha256': hashlib.sha256(raw).hexdigest()}
html = (root / 'index.html').read_text()
roots = [name.lstrip('/') for name in re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', html)]
initial = set(roots)
queue = list(roots)
for name in queue:
    path = root / name
    if path.suffix != '.js' or not path.exists():
        continue
    # Static ESM imports only; dynamic imports remain in the total/lazy inventory.
    for ref in re.findall(r'(?:\bfrom\s*|\bimport\s*)[\'"]([^\'"]+)[\'"]', path.read_text()):
        target = (path.parent / ref).resolve()
        if target.is_relative_to(root) and target.exists():
            key = target.relative_to(root).as_posix()
            if key not in initial:
                initial.add(key)
                queue.append(key)
totals = {}
for scope in ['all_without_maps', 'js', 'css', 'fonts', 'maps', 'initial_js_css']:
    selected = [v for k, v in files.items() if (v['kind'] != 'maps' if scope == 'all_without_maps' else k in initial if scope == 'initial_js_css' else v['kind'] == scope)]
    totals[scope] = {'files': len(selected), 'raw': sum(v['raw'] for v in selected), 'gzip9_mtime0': sum(v['gzip9_mtime0'] for v in selected)}
result = {'build': str(root), 'scope': 'All emitted files with sourcemaps separate; initial static JS/CSS closure is inferred from index.html/static ESM imports, not measured route transfer. Gzip is deterministic size, not configured server encoding.', 'roots': roots, 'initial_closure': sorted(initial), 'totals': totals, 'files': files}
Path(args.output).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(totals))
