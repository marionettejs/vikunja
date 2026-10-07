# Production benchmark protocol

The checked-in harness compares this native frontend with Vue baseline `5d22d730aa35b0666d0849099c12a1e638baabc9` on the same disposable Mage backend. It does not certify complete feature/visual parity. Latest matched three-build results: [2026-10-07 measurements](rc2-final-measurements-20261007.md). Earlier measured results remain [historical](rc2-benchmark-results.md).

## Reproduce

Install dependencies in this checkout and a sibling `vikunja-vue-reference` worktree at the pinned baseline. Both use the same Node/pnpm environment. Install the Playwright Chromium browser through the frontend development setup. Build Vue using its original production settings:

```sh
cd ../vikunja-vue-reference/frontend
pnpm build
cd ../../vikunja-migration
BENCHMARK_VUE_ROOT="$(cd ../vikunja-vue-reference && pwd)" \
BENCHMARK_VUE_BUILD="$(cd ../vikunja-vue-reference/frontend/dist && pwd)" \
bash migration/audit/production-mage.sh '--config=../migration/acceptance/benchmark.config.ts'
```

The adapter preserves Mage backend setup and teardown while replacing its frontend development build/preview commands with production-mode equivalents. It does not change backend source. Run one browser suite at a time and archive `migration/acceptance/benchmark-report.json` and `benchmark-results/` before the next run.

Source census: `python3 migration/audit/source-census.py . HEAD /tmp/native-source.json`, and the same command with the reference checkout/pinned SHA. Bundle census: `python3 migration/audit/bundle-census.py frontend/dist-dev /tmp/native-bundle.json`, and the same command with the Vue production directory. The scripts preserve file manifests/hashes and distinguish source, generated code, tests, initial static JS/CSS closure, total assets and sourcemaps. Gzip sizes use level 9 and mtime 0; they are size estimates, not measured server transfer encoding.

## Measured workload and limits

The two datasets contain 50 and 500 tasks. The list displays 50 rows; Kanban has two buckets with 25 visible cards each. The canonical task contains about 10 KB of rich description and 50 comments. Both apps use the same fixture rows, API responses, viewport 1440×900, locale en-US and UTC. Real API login creates each browser context; no production account or API stubs are used.

Startup alternates app order: three warm-ups and twenty measured cold/warm iterations per app/dataset. Cold means a fresh browser context in a shared Chromium process, not a cold machine/new process. Warm means document reload. Service workers are blocked; CPU/network throttling are disabled. FCP and semantic readiness (50 rows, fonts and two animation frames) are reported separately. LCP candidates are recorded but are not a final settled LCP result.

Four interactions use three warm-ups and twenty samples: task open with description/comments, editor entry/type/discard, search results, and Kanban readiness. Durations use the runner's monotonic clock and include browser automation/network/frame waiting. Kanban readiness uses document navigation rather than SPA switching. Interactions run in app blocks, so background drift remains a limitation. They do not cover all filter/sort/page/card-move/save operations.

Retention warms three SPA list→Kanban→task-modal→Kanban→list cycles, then measures thirty cycles per app/dataset. Three forced-GC snapshots of Chromium heap/DOM/listener counters are taken at cycles 0/10/20/30. These are repeated GC samples within one run, not independent retention trials or process RSS. The final matched run captures heap snapshots at cycles0/30, with optional lossless gzip storage and verified uncompressed hashes. Instrumented CPU profiles are separate causal diagnostics; the final n20 run is untraced. Mobile and 5000-task performance measurements remain unperformed.

Raw samples and distributions distinguish median, nearest-rank p95, minimum and maximum; twenty samples provide a coarse tail estimate. API paths/methods/status/decoded bytes/cardinality are recorded without authentication headers. Any scenario with API errors or unequal visible cardinality is reported as non-comparable. Lower LOC/bundle size or a faster bounded interaction is not evidence of complete parity, maintainability or general performance superiority.
