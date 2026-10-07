# Fresh matched Vue / published native / current RC2 measurements

Captured after the bounded completion Undo correctness fix. Source `afcac46a058f62522c1c79fa265482db2875ab5d`; frontend `eea122d071da1656b23f8483c6a9558f1c44e701`. Local cloud measurements; no deployment or production data.

All twenty measured samples are retained per app, workload and dataset. Three warmups; same isolated backend/fixtures, 1440×900 DPR1, en-US/UTC, headless Chromium, service workers blocked, no CPU/network throttling. Startup rotates app order; interactions/retention run serial app blocks. Durations include automation, API and frame waits. Nearest-rank p95 at n20 is a coarse tail estimate. This run does not certify complete route/feature/appearance parity.

Vue upstream: `5d22d730aa35b0666d0849099c12a1e638baabc9`, frontend `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`; immutable verified production build. Published native: `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`. Runtime packages are exact Marionette/@mnjs 5.0.0-rc.2, source f4243b8334cafe0bd1b06eba85d87e2310cb3618.

## Dataset 50

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 256.00 / 280.00 | 304.00 / 324.00 | 144.00 / 168.00 | -52.63% |
| Cold list ready | 637.50 / 699.40 | 551.25 / 612.10 | 485.50 / 520.00 | -11.93% |
| Warm list ready | 391.95 / 455.50 | 307.40 / 337.70 | 296.70 / 360.50 | -3.48% |
| First task | 3379.97 / 3937.01 | 1180.29 / 1277.10 | 969.18 / 1099.80 | -17.89% |
| First editor | 574.55 / 623.69 | 225.38 / 271.67 | 223.74 / 262.66 | -0.73% |
| First Kanban | 370.01 / 445.98 | 296.47 / 330.08 | 294.99 / 342.95 | -0.50% |
| Repeated task open | 3247.90 / 3710.06 | 1075.13 / 1195.32 | 828.19 / 911.98 | -22.97% |
| Edit/discard | 602.43 / 724.54 | 212.46 / 251.37 | 202.44 / 229.45 | -4.72% |
| Search results | 499.91 / 591.72 | 525.25 / 574.53 | 407.59 / 443.47 | -22.40% |
| Kanban ready | 437.53 / 542.88 | 294.64 / 334.06 | 294.37 / 355.32 | -0.09% |
| Search input to publication | 205.20 / 220.00 | 207.95 / 223.70 | 161.05 / 173.40 | -22.55% |
| Search publication to paint | 15.75 / 56.90 | 16.90 / 85.90 | 22.80 / 27.80 | +34.91% |
| Search input to paint | 226.75 / 263.30 | 227.05 / 257.20 | 186.20 / 194.60 | -17.99% |

Earlier n20 current/published first-task medians were 1016.92/1250.56ms; search 425.25/551.44ms. Those older values remain historical. Alternating instrumented n10 attribution is retained separately; profiler timing does not replace this uninstrumented n20 run.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.86 → 62.56 | 12.85 → 15.77 | 12.53 → 13.97 |
| DOM nodes | 20403.00 → 20399.00 | 7581.00 → 7581.00 | 6970.00 → 6970.00 |
| Listeners | 3096.00 → 3095.00 | 867.00 → 867.00 | 769.00 → 769.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1468637.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 430607.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1583 | 1414 | 1414 |
| Decoded bytes | 12702271 | 12691147 | 12691147 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 28.49 / 3214.90 | 4.47 / 1033.91 | 15.39 / 789.01 |
| Edit/discard | 27.53 / 555.78 | 31.33 / 154.23 | 34.55 / 129.20 |
| Search | 4.62 / 390.66 | 11.21 / 421.01 | 10.01 / 305.72 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Dataset 500

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 260.00 / 300.00 | 302.00 / 348.00 | 156.00 / 184.00 | -48.34% |
| Cold list ready | 660.70 / 747.80 | 561.20 / 627.30 | 490.75 / 563.90 | -12.55% |
| Warm list ready | 417.45 / 447.30 | 323.30 / 354.40 | 299.95 / 384.80 | -7.22% |
| First task | 3405.11 / 3807.41 | 1225.45 / 1313.32 | 997.93 / 1067.94 | -18.57% |
| First editor | 569.73 / 672.89 | 235.08 / 267.62 | 215.85 / 241.06 | -8.18% |
| First Kanban | 422.65 / 463.62 | 310.98 / 342.99 | 295.76 / 329.06 | -4.89% |
| Repeated task open | 3322.96 / 3577.57 | 1120.22 / 1223.32 | 928.88 / 1027.65 | -17.08% |
| Edit/discard | 591.43 / 677.58 | 225.31 / 256.45 | 230.12 / 289.69 | +2.13% |
| Search results | 460.76 / 544.63 | 542.65 / 644.56 | 455.27 / 556.42 | -16.10% |
| Kanban ready | 445.29 / 490.63 | 285.59 / 323.96 | 316.02 / 410.70 | +10.66% |
| Search input to publication | 200.15 / 228.50 | 208.65 / 220.60 | 179.70 / 215.50 | -13.87% |
| Search publication to paint | 12.20 / 51.30 | 18.90 / 94.60 | 24.40 / 31.40 | +29.10% |
| Search input to paint | 212.35 / 254.50 | 224.80 / 277.00 | 202.55 / 239.80 | -9.90% |

Earlier n20 current/published first-task medians were 979.41/1270.58ms; search 408.78/542.06ms. Those older values remain historical. Alternating instrumented n10 attribution is retained separately; profiler timing does not replace this uninstrumented n20 run.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.40 → 70.32 | 12.41 → 15.48 | 12.51 → 15.23 |
| DOM nodes | 20497.00 → 24920.00 | 7646.00 → 7648.00 | 7037.00 → 7037.00 |
| Listeners | 3103.00 → 3750.00 | 871.00 → 871.00 | 773.00 → 773.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1468637.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 430607.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1581 | 1414 | 1414 |
| Decoded bytes | 12701353 | 12691305 | 12691305 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 23.98 / 3283.79 | 4.42 / 1068.41 | 17.44 / 872.37 |
| Edit/discard | 28.12 / 553.80 | 31.32 / 148.00 | 38.99 / 158.68 |
| Search | 4.58 / 373.06 | 11.73 / 436.69 | 11.48 / 347.86 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Interpretation and verification boundary

Current first-task medians are969.18/997.93ms versus published1180.29/1225.45ms for50/500tasks; search407.59/455.27ms versus525.25/542.65ms. These are matched local observations, not universal speed claims or causal attribution to the Undo fix.

Slower results remain explicit:500-task Kanban median316.02ms versus285.59ms (+10.66%), p95410.70ms versus323.96ms (+26.77%);500-task editor median230.12ms versus225.31ms (+2.13%), p95289.69ms versus256.45ms (+12.96%). Warm-ready p95 is higher in both datasets (360.5/384.8ms versus337.7/354.4ms).50-task Kanban p95 is355.32ms versus334.06ms. No samples or outliers were dropped. Task-open script counters can rise while total main-thread task duration falls; navigation-reset Kanban CPU deltas remain unavailable.

Retention counters are bounded30-cycle observations. Current DOM/listener counts remain flat; forced-GC heap medians grow1.44/2.72MiB versus published2.92/3.07MiB. This does not prove leak freedom or diagnose retainers.12raw snapshots total lossless gzip161813557bytes, verified against decompressed size/SHA. Actual browser151.0.7922.173, Node24.19.0. Startup rotates app order; interaction app blocks are serial, not randomized independent replicate trials. API phase windows in the older benchmark harness can include preparatory next-list requests; retained aggregate API totals are not function-level causality. Instrumented n10 attribution is separately pinned to the previousb19frontend.

Same frontend verification:775/775units88files;24/24Undo and40/40notice pairs;477/480aggregate1297.803sec,zero skipped/flaky, exact three preserved baseline failures/newFailures=[]. Both817module graphs zeroVue; all five runtime packages exactRC2; source/dependency/import/lock/SFC/tooling audits clear. Served202nonmapfiles5680640raw/1962429gzipbytes; initial staticJS/CSSclosure709773raw/182341gzipbytes. Actual cold JS/CSStransfer430607bytes versus published676439 andVue628890. Census estimates and network transfer are separate quantities.

All59route families remain partial; zero fully certified. Performance/build audits do not certify whole-app functionality or appearance. Licensed backend/external delivery/Electron/OSIME remain actual blockers; broader available variants remain unperformed.

## Reproduce and audit

Use `migration/audit/production-mage.sh` through Mage; it owns production build/preview, isolated SQLite fixtures/backend and teardown. Current cloud helper reproduces the matched run with these settings:

```sh
BENCHMARK_ALL_REFERENCES=1 \
BENCHMARK_VUE_BUILD=/workspace/vikunja-evidence/publication-benchmark/vue-production \
BENCHMARK_NATIVE_BASELINE_BUILD=/workspace/vikunja-evidence/optimization-20261006/baseline-production \
BENCHMARK_FIRST_USE=1 BENCHMARK_SEARCH_PHASES=1 \
BENCHMARK_HEAP_COMPRESSION=gzip BENCHMARK_HEAP_DIRECTORY=/tmp/vikunja-benchmark-heaps \
bash migration/audit/production-mage.sh '--config=../migration/acceptance/benchmark.config.ts'
```

Node24/pnpm11.25, Go1.27/Mage/C SQLite toolchain and Chromium required. Preserve verified reference build manifests; the original Vue checkout dist placeholders are not a valid production reference. Archive reports/results before reruns. Do not run heavy parallel work or change runtime during measurement.

Evidence root: `/workspace/vikunja-evidence/overnight-20261007/current-undo/benchmark/`. `inputs.json`, `run/profile-raw-0.json`, `run/profile-raw-1.json`, `summary.json`, `heap-verification-manifest.json`, build/source audits and served-build census preserve pins, samples, API requests and byte accounting. Full route ledger remains partial for all 59 families; see `rc2-supported-route-device-coverage.md`.
