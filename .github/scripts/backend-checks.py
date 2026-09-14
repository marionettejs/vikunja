"""Skip backend-only CI only when every changed path is frontend-owned."""
import json
import os
import re
import subprocess


def requires_backend(paths):
    return any(
        not path.startswith(('frontend/', 'migration/'))
        or path.endswith(('.go', '.sql', '/go.mod', '/go.sum'))
        for path in paths
    )


def revisions(event_name, event):
    if event_name == 'pull_request':
        pr = event['pull_request']
        return pr['base']['sha'], pr['head']['sha'], True
    if event_name == 'merge_group':
        group = event['merge_group']
        return group['base_sha'], group['head_sha'], False
    if event_name == 'push':
        return event['before'], event['after'], False
    return None


def run_backend(event_name, event):
    pair = revisions(event_name, event)
    if pair is None:
        return True
    base, head, merge_base = pair
    if any(not re.fullmatch(r'[0-9a-f]{40}', sha) or sha == '0' * 40 for sha in (base, head)):
        return True
    if merge_base:
        base = subprocess.check_output(['git', 'merge-base', base, head], text=True).strip()
    changed = subprocess.check_output([
        'git', 'diff', '--name-only', '--no-renames', '-z', base, head, '--',
    ]).decode('utf-8', errors='surrogateescape').split('\0')
    return requires_backend(path for path in changed if path)


if __name__ == '__main__':
    try:
        with open(os.environ['GITHUB_EVENT_PATH']) as source:
            event = json.load(source)
        required = run_backend(os.environ['GITHUB_EVENT_NAME'], event)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f'Change detection unavailable; running backend checks: {type(error).__name__}')
        required = True
    value = str(required).lower()
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'backend={value}\n')
    print(f'Run backend-only checks: {value}')
