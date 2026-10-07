# Production comparison — 2026-10-06

This bounded comparison passed both dataset cases in 17.1 minutes. The native frontend tree is `a7d6970ef57cec104f6b56a5c0d2d09d33ff3474`; frozen Vue is `5d22d730aa35b0666d0849099c12a1e638baabc9`. Subsequent documentation and portable harness-path changes leave the measured frontend tree unchanged. The measured Vue reference has byte-identical frontend and backend package trees to that official upstream baseline; its separate working-history identity is not published. Both use the same isolated backend, fixtures and browser settings. Full parity remains incomplete.

Native has fewer total assets and reaches list readiness sooner in these samples. Its initial static bundle is larger, cold FCP is slower, and search is slower. This is mixed evidence, not a framework ranking.

## Source and bundles

Tracked `frontend/src` TS/JS/Vue/CSS/SCSS files; physical and nonblank lines. Backend, dependencies/vendor, configs, external tests, JSON/translations and media are excluded. Generated API code and source-adjacent tests are separate; test counts do not compare coverage.

| Scope | Native files / physical / nonblank lines | Vue files / physical / nonblank lines |
| --- | --- | --- |
| source | 434 / 44,356 / 40,999 | 552 / 61,381 / 53,544 |
| generated | 16 / 17,414 / 15,681 | 16 / 17,414 / 15,681 |
| tests | 73 / 6,607 / 5,589 | 111 / 14,016 / 11,463 |

Handwritten source is 27.7% shorter by physical lines. Dense methods, differing test inventories and unverified features limit any maintainability inference.

| Emitted scope | Native files / raw bytes / gzip bytes | Vue files / raw bytes / gzip bytes |
| --- | --- | --- |
| js | 100 / 4,198,234 / 1,262,059 | 213 / 5,991,031 / 1,667,970 |
| css | 1 / 411,235 / 57,918 | 47 / 315,368 / 62,468 |
| initial_js_css | 2 / 2,476,522 / 670,922 | 34 / 1,440,713 / 435,161 |
| fonts | 3 / 204,972 / 205,096 | 3 / 204,972 / 205,096 |
| all_without_maps | 137 / 5,629,669 / 1,918,320 | 294 / 7,315,058 / 2,323,808 |
| maps | 33 / 1,209,281 / 296,005 | 33 / 1,209,281 / 296,005 |

The initial scope is the index/static ESM JS/CSS closure inferred by the audit script, not measured route transfer. Production settings and Workbox library inventory match; copied-library sourcemaps are separate. Vue library copying completed after runtime timings. Those files were unused with service workers blocked, and the application entry assets did not change. Gzip uses level 9/mtime 0 and does not represent configured HTTP encoding.

## Startup and interactions

All entries below are milliseconds: **median / nearest-rank p95**, twenty measured samples after three warm-ups. Minimum/maximum and every sample are in [the raw evidence directory](benchmark/results-2026-10-06/). Cold means fresh context in a shared browser process; warm means document reload. No CPU/network throttling; service workers blocked.

| Dataset | Metric | Native | Vue |
| --- | --- | --- | --- |
| 50 | cold fcp_ms | 326.00 / 364.00 | 276.00 / 340.00 |
| 50 | cold ready_ms | 594.35 / 627.30 | 676.05 / 865.50 |
| 50 | warm fcp_ms | 140.00 / 172.00 | 150.00 / 180.00 |
| 50 | warm ready_ms | 324.45 / 379.60 | 428.10 / 471.20 |
| 50 | task-open | 1150.00 / 1283.29 | 3370.22 / 3690.11 |
| 50 | editor-enter-discard | 235.59 / 276.21 | 628.28 / 739.99 |
| 50 | search-results | 537.78 / 628.35 | 415.15 / 530.66 |
| 50 | kanban-ready | 320.22 / 363.11 | 463.10 / 511.81 |
| 500 | cold fcp_ms | 320.00 / 364.00 | 284.00 / 312.00 |
| 500 | cold ready_ms | 592.80 / 687.60 | 717.35 / 776.60 |
| 500 | warm fcp_ms | 144.00 / 188.00 | 156.00 / 168.00 |
| 500 | warm ready_ms | 334.70 / 417.30 | 428.55 / 511.50 |
| 500 | task-open | 1121.59 / 1199.56 | 3363.98 / 3601.48 |
| 500 | editor-enter-discard | 230.37 / 264.48 | 614.08 / 667.31 |
| 500 | search-results | 511.75 / 597.50 | 423.05 / 513.93 |
| 500 | kanban-ready | 297.84 / 331.27 | 445.62 / 524.61 |

Readiness asserts 50 list rows, fonts and two animation frames. Both Kanban views show two buckets/50 cards; task-open asserts the rich description and 50 comments. Interaction times include automation/network/frame waiting; interactions are app-blocked, and Kanban readiness uses document navigation. LCP candidates are recorded without claiming final LCP.

## Bounded retention and API observations

Thirty SPA list→Kanban→task modal→Kanban→list cycles after three warm-ups, one run per app/dataset. Each checkpoint has three forced-GC samples. Values are checkpoint medians; MiB is browser JS heap rather than process RSS.

| Dataset / app | Heap MiB, cycle 0 → 30 | DOM nodes, 0 → 30 | Listeners, 0 → 30 |
| --- | --- | --- | --- |
| 50 / native-rc2 | 12.85 → 15.54 | 7581 → 7581 | 867 → 867 |
| 50 / vue-upstream | 56.84 → 71.01 | 20403 → 24773 | 3096 → 3738 |
| 500 / native-rc2 | 12.44 → 14.45 | 7646 → 7648 | 871 → 871 |
| 500 / vue-upstream | 57.12 → 64.01 | 20501 → 20497 | 3104 → 3103 |

Documents remained at three. Native DOM/listener counts were bounded in this run, while heap still grew about 2–3 MiB. Vue’s 50-task final checkpoint had higher DOM/listener counts than its earlier checkpoints; the 500-task run did not. No retaining-path/heap-snapshot or independent repeat establishes a leak or its cause.

| Dataset | Native / Vue API responses | Native / Vue decoded bytes | HTTP errors / unavailable bodies |
| --- | --- | --- | --- |
| 50 | 1115 / 1234 | 10,551,857 / 10,539,829 | 0 / 0 |
| 500 | 1115 / 1232 | 10,553,985 / 10,540,353 | 0 / 0 |

Returned array cardinality distributions match across apps for each dataset; raw request paths/methods/status/bytes/cardinality are retained without authentication headers. Request counts differ because application request behavior differs. All fixture data is synthetic.

## Environment and limits

Linux 6.18.44 x86_64/glibc 2.41, AMD EPYC 9V74, container limit four CPU equivalents/16 GiB; five logical CPUs reported. Node 24.19.0, pnpm CLI 11.19.0 for both builds (package metadata declares 11.25.0), Chromium 151.0.7922.173, headless, 1440×900, DPR 1, en-US/UTC. The CLI difference is recorded rather than hidden.

No mobile, CPU traces, final LCP, 5000-task dataset, OS IME, licensed-backend certification or full appearance review is included. Three GC samples within a run are not independent trials. Benchmark passes cannot replace the retained failures and review gates in [the acceptance ledger](rc2-parity-ledger.md). Reproduction and measurement definitions are in [the protocol](rc2-benchmark-protocol.md).
