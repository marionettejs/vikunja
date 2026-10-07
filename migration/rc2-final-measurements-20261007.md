# Fresh matched Vue / published native / current RC2 measurements

Captured after final modal correctness checks. Source `dd53a27e72cd529fe3fb944404362de54cb70ddd`; frontend `297071a8099e9ac56484c9e7e76a651ef59f9cfa`. Local cloud measurements; no deployment or production data.

All twenty measured samples are retained per app, workload and dataset. Three warmups; same isolated backend/fixtures, 1440×900 DPR1, en-US/UTC, headless Chromium, service workers blocked, no CPU/network throttling. Startup rotates app order; interactions/retention run serial app blocks. Durations include automation, API and frame waits. Nearest-rank p95 at n20 is a coarse tail estimate. This run does not certify complete route/feature/appearance parity.

Vue upstream: `5d22d730aa35b0666d0849099c12a1e638baabc9`, frontend `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`; immutable verified production build. Published native: `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`. Current runtime packages are exact Marionette/@mnjs 5.0.0-rc.2, source f4243b8334cafe0bd1b06eba85d87e2310cb3618.

Recorded browser `151.0.7922.173` and Node `v24.19.0`. Benchmark **2/2**, 1839.832 seconds, zero skipped/flaky; all six app/dataset partitions have zero API errors and zero unavailable response bodies.

## Dataset 50

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 276.00 / 320.00 | 326.00 / 352.00 | 158.00 / 184.00 | -51.53% |
| Cold list ready | 707.55 / 807.20 | 591.65 / 677.50 | 527.90 / 563.70 | -10.77% |
| Warm list ready | 429.15 / 493.80 | 326.30 / 386.60 | 321.55 / 373.90 | -1.46% |
| First task | 3716.87 / 4456.92 | 1250.56 / 1441.32 | 1016.92 / 1140.25 | -18.68% |
| First editor | 606.03 / 739.62 | 235.89 / 291.71 | 237.74 / 288.93 | +0.78% |
| First Kanban | 415.73 / 490.84 | 312.79 / 381.80 | 309.58 / 362.87 | -1.03% |
| Repeated task open | 3259.08 / 3494.61 | 1087.10 / 1326.72 | 870.03 / 960.61 | -19.97% |
| Edit/discard | 582.81 / 632.22 | 225.91 / 274.22 | 223.02 / 297.42 | -1.28% |
| Search results | 459.90 / 561.85 | 551.44 / 641.28 | 425.25 / 543.25 | -22.88% |
| Kanban ready | 455.85 / 490.52 | 288.97 / 341.61 | 293.56 / 406.24 | +1.59% |
| Search input to publication | 199.90 / 239.90 | 210.55 / 238.70 | 170.25 / 206.60 | -19.14% |
| Search publication to paint | 13.35 / 61.00 | 22.65 / 94.20 | 23.80 / 35.10 | +5.08% |
| Search input to paint | 220.35 / 284.80 | 233.85 / 285.30 | 192.85 / 255.00 | -17.53% |

Earlier n20 current/published first-task medians were 1329.55/1245.96ms; search 640.01/575.79ms. The fresh comparison above addresses that observed slowdown; instrumented n6 diagnostics are retained separately and do not replace these samples.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.80 → 62.87 | 12.60 → 15.37 | 12.40 → 15.23 |
| DOM nodes | 20399.00 → 20399.00 | 7579.00 → 7581.00 | 6963.00 → 6963.00 |
| Listeners | 3095.00 → 3095.00 | 867.00 → 867.00 | 769.00 → 769.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1464838.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 429533.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1581 | 1414 | 1414 |
| Decoded bytes | 12727991 | 12717943 | 12717943 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 25.28 / 3217.55 | 4.30 / 1042.68 | 16.62 / 812.53 |
| Edit/discard | 27.24 / 536.47 | 30.20 / 154.52 | 35.37 / 148.30 |
| Search | 4.71 / 370.67 | 11.51 / 448.07 | 11.09 / 320.45 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Dataset 500

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 266.00 / 328.00 | 304.00 / 336.00 | 156.00 / 184.00 | -48.68% |
| Cold list ready | 685.80 / 838.50 | 553.80 / 619.20 | 503.20 / 533.10 | -9.14% |
| Warm list ready | 410.00 / 510.80 | 323.90 / 367.70 | 305.00 / 330.60 | -5.84% |
| First task | 3401.16 / 3819.79 | 1270.58 / 1396.50 | 979.41 / 1113.89 | -22.92% |
| First editor | 563.84 / 640.11 | 244.98 / 279.75 | 219.92 / 259.76 | -10.23% |
| First Kanban | 398.47 / 481.06 | 312.63 / 362.10 | 296.10 / 361.73 | -5.29% |
| Repeated task open | 3330.57 / 3721.85 | 1110.98 / 1220.57 | 853.49 / 899.91 | -23.18% |
| Edit/discard | 608.41 / 739.12 | 215.96 / 260.40 | 209.79 / 227.90 | -2.86% |
| Search results | 498.53 / 573.99 | 542.06 / 688.33 | 408.78 / 423.36 | -24.59% |
| Kanban ready | 440.84 / 504.36 | 301.65 / 374.23 | 292.01 / 359.75 | -3.20% |
| Search input to publication | 202.00 / 248.20 | 205.00 / 239.40 | 160.60 / 175.60 | -21.66% |
| Search publication to paint | 12.20 / 56.40 | 25.30 / 96.30 | 21.45 / 28.10 | -15.22% |
| Search input to paint | 218.60 / 264.30 | 243.05 / 298.40 | 183.50 / 197.40 | -24.50% |

Earlier n20 current/published first-task medians were 1355.58/1274.62ms; search 632.38/561.42ms. The fresh comparison above addresses that observed slowdown; instrumented n6 diagnostics are retained separately and do not replace these samples.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.29 → 62.88 | 12.68 → 15.50 | 12.39 → 14.04 |
| DOM nodes | 20497.00 → 20501.00 | 7646.00 → 7648.00 | 7030.00 → 7030.00 |
| Listeners | 3103.00 → 3104.00 | 871.00 → 871.00 | 773.00 → 773.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1464838.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 429533.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1581 | 1414 | 1414 |
| Decoded bytes | 12726293 | 12715717 | 12715717 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 29.01 / 3282.66 | 4.43 / 1069.22 | 15.56 / 806.80 |
| Edit/discard | 27.58 / 552.77 | 31.22 / 148.27 | 35.61 / 138.85 |
| Search | 4.47 / 386.52 | 12.26 / 444.83 | 9.98 / 299.89 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Bundle and verification scope

Current served production build: 202 non-map files,
5,675,647 raw bytes / 1,960,961 deterministic gzip bytes.
Initial static JS/CSS closure: 7 files,
705,599 raw / 181,150 gzip bytes.
These census estimates differ from actual cold-route transfer above. Both
development/production module graphs contain 814 modules and zero Vue;
source, installed dependencies, lockfile, SFC and import audits find zero Vue.
All five current runtime packages are exactly 5.0.0-rc.2.

The first-task/search regression is improved in this matched run. This is not
a universal speed claim: 50-task Kanban median is +1.59% and p95 +18.92%
against published native; edit/discard p95 is also higher in that dataset.
Task-open script duration rises while main-thread task duration falls. All
values and outliers remain in the evidence. Independent repeat trials and
other workloads/devices remain unperformed.

Frozen functional milestone on the same frontend: **477/480**, zero
skipped/flaky, 1414.635 seconds. Exact preserved baseline failures: bot
re-enable backend412 and two mobile task bottom-navigation journeys. Current
units **753/753 across83files**, paired modal/settings/sharing **16/16**.
Full route/feature/appearance certification remains open for all59families;
performance and a Vue-free bundle do not constitute migration completion.

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

Evidence root: `/workspace/vikunja-evidence/continued-coverage-20261006/benchmark-release/`. `inputs.json`, `run/profile-raw-0.json`, `run/profile-raw-1.json`, `benchmark-summary.json`, `heap-verification-manifest.json`, build/source audits and served-build census preserve pins, samples, API requests and byte accounting. Full route ledger remains partial for all 59 families; see `rc2-supported-route-device-coverage.md`.
