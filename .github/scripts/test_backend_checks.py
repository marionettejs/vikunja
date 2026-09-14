import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backend_checks', pathlib.Path(__file__).with_name('backend-checks.py'))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class BackendChecksTest(unittest.TestCase):
    def test_frontend_and_migration_only(self):
        self.assertFalse(checks.requires_backend(['frontend/src/a.ts', 'frontend/pnpm-lock.yaml', 'migration/README.md']))

    def test_backend_shared_and_unknown_paths_run(self):
        for path in ['pkg/routes/api.go', 'frontend/embed.go', 'migration/schema.sql', 'go.mod', 'go.sum', 'magefile.go', 'veans/main.go', '.github/workflows/test.yml', 'new-directory/file', 'frontend-other/file']:
            with self.subTest(path=path):
                self.assertTrue(checks.requires_backend(['frontend/src/a.ts', path]))

    def test_renaming_backend_into_frontend_still_runs(self):
        self.assertTrue(checks.requires_backend(['pkg/old.go', 'frontend/new.go']))

    def test_manual_runs_full_suite(self):
        self.assertTrue(checks.run_backend('workflow_dispatch', {}))

    def test_initial_push_runs_full_suite(self):
        self.assertTrue(checks.run_backend('push', {'before': '0' * 40, 'after': 'a' * 40}))

    @patch.object(checks.subprocess, 'check_output')
    def test_pr_uses_merge_base_and_nul_separated_paths(self, command):
        command.side_effect = ['c' * 40 + '\n', b'frontend/a file.ts\0migration/README.md\0']
        self.assertFalse(checks.run_backend('pull_request', {'pull_request': {'base': {'sha': 'a' * 40}, 'head': {'sha': 'b' * 40}}}))
        self.assertEqual(command.call_args_list[0].args[0], ['git', 'merge-base', 'a' * 40, 'b' * 40])
        self.assertIn('--no-renames', command.call_args_list[1].args[0])

    @patch.object(checks.subprocess, 'check_output', return_value=b'pkg/api.go\0')
    def test_merge_group_uses_full_group_diff(self, command):
        self.assertTrue(checks.run_backend('merge_group', {'merge_group': {'base_sha': 'a' * 40, 'head_sha': 'b' * 40}}))
        self.assertEqual(command.call_count, 1)


if __name__ == '__main__':
    unittest.main()
