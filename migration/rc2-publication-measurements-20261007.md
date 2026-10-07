# Fresh matched Vue / published native / current RC2 measurements

Captured after the final source-backed Close contrast, placeholder and inactive view-link fixes. Source `3581ed1a672a1c56df8bf78ca2b56dca14e3c67b`; frontend `50662d98588496fcc100d19b9b0412a84ed9ab05`. Local cloud measurements; no deployment or production data.

All twenty measured samples are retained per app, workload and dataset. Three warmups; same isolated backend/fixtures, 1440×900 DPR1, en-US/UTC, headless Chromium, service workers blocked, no CPU/network throttling. Startup rotates app order; interactions/retention run serial app blocks. Durations include automation, API and frame waits. Nearest-rank p95 at n20 is a coarse tail estimate. This run does not certify complete route/feature/appearance parity.

Vue upstream: `5d22d730aa35b0666d0849099c12a1e638baabc9`, frontend `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`; immutable verified production build. Published native: `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`. Runtime packages are exact Marionette/@mnjs 5.0.0-rc.2, source f4243b8334cafe0bd1b06eba85d87e2310cb3618.

## Dataset 50

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 262.00 / 312.00 | 328.00 / 380.00 | 164.00 / 192.00 | -50.00% |
| Cold list ready | 671.85 / 717.70 | 573.30 / 670.40 | 520.65 / 592.20 | -9.18% |
| Warm list ready | 406.50 / 484.30 | 329.50 / 373.40 | 310.20 / 357.50 | -5.86% |
| First task | 3625.85 / 4090.44 | 1251.61 / 1473.55 | 999.72 / 1138.08 | -20.13% |
| First editor | 604.88 / 872.99 | 242.45 / 318.49 | 225.36 / 275.65 | -7.05% |
| First Kanban | 434.84 / 480.75 | 313.71 / 361.11 | 297.27 / 374.26 | -5.24% |
| Repeated task open | 3428.80 / 3927.30 | 1128.28 / 1227.88 | 846.11 / 944.60 | -25.01% |
| Edit/discard | 619.58 / 706.04 | 227.44 / 257.89 | 225.73 / 244.59 | -0.75% |
| Search results | 475.65 / 570.51 | 523.78 / 622.52 | 441.33 / 505.11 | -15.74% |
| Kanban ready | 470.54 / 532.81 | 298.13 / 329.19 | 305.29 / 346.61 | +2.40% |
| Search input to publication | 202.55 / 226.20 | 208.50 / 228.00 | 174.45 / 227.00 | -16.33% |
| Search publication to paint | 11.85 / 53.10 | 19.75 / 93.30 | 22.15 / 29.00 | +12.15% |
| Search input to paint | 216.20 / 254.20 | 232.70 / 276.50 | 194.45 / 236.30 | -16.44% |

Earlier n20 current/published first-task medians were 1016.92/1250.56ms; search 425.25/551.44ms. Those older values remain historical. Alternating instrumented n10 attribution is retained separately; profiler timing does not replace this uninstrumented n20 run.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.27 → 62.76 | 12.87 → 15.57 | 12.44 → 15.25 |
| DOM nodes | 20403.00 → 20403.00 | 7581.00 → 7581.00 | 6970.00 → 6970.00 |
| Listeners | 3096.00 → 3096.00 | 867.00 → 867.00 | 769.00 → 769.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1468769.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 430612.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1579 | 1414 | 1414 |
| Decoded bytes | 12700119 | 12691147 | 12691147 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 28.89 / 3385.32 | 4.49 / 1086.10 | 15.56 / 807.92 |
| Edit/discard | 28.59 / 588.56 | 32.75 / 163.11 | 38.11 / 153.33 |
| Search | 4.71 / 384.92 | 11.31 / 434.48 | 11.50 / 335.12 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Dataset 500

List and Kanban each show 50 tasks/cards; canonical task contains rich description and 50 comments. Values below are **median / p95 milliseconds**.

| Workload | Vue | Published native | Current native | Current vs published median |
| --- | ---: | ---: | ---: | ---: |
| Cold FCP | 296.00 / 368.00 | 334.00 / 372.00 | 164.00 / 188.00 | -50.90% |
| Cold list ready | 738.95 / 874.20 | 611.55 / 650.70 | 527.35 / 569.80 | -13.77% |
| Warm list ready | 437.85 / 471.80 | 340.60 / 377.10 | 320.15 / 378.40 | -6.00% |
| First task | 3719.43 / 4035.43 | 1295.65 / 1386.40 | 1035.77 / 1125.70 | -20.06% |
| First editor | 623.21 / 793.88 | 254.69 / 299.83 | 250.42 / 277.63 | -1.68% |
| First Kanban | 410.10 / 529.42 | 334.87 / 368.59 | 322.96 / 360.57 | -3.56% |
| Repeated task open | 3597.61 / 4270.05 | 1176.10 / 1307.19 | 909.35 / 960.07 | -22.68% |
| Edit/discard | 703.96 / 772.99 | 242.12 / 337.25 | 231.30 / 307.56 | -4.47% |
| Search results | 493.14 / 621.96 | 613.56 / 670.16 | 432.41 / 473.97 | -29.52% |
| Kanban ready | 497.24 / 624.24 | 320.70 / 371.55 | 301.27 / 376.17 | -6.06% |
| Search input to publication | 208.45 / 269.30 | 195.85 / 238.00 | 173.15 / 193.00 | -11.59% |
| Search publication to paint | 12.75 / 22.10 | 86.90 / 109.60 | 24.45 / 30.90 | -71.86% |
| Search input to paint | 221.25 / 326.20 | 262.65 / 307.40 | 194.80 / 213.90 | -25.83% |

Earlier n20 current/published first-task medians were 979.41/1270.58ms; search 408.78/542.06ms. Those older values remain historical. Alternating instrumented n10 attribution is retained separately; profiler timing does not replace this uninstrumented n20 run.

| Retention (cycle0 → 30, forced GC) | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS heap MiB | 57.09 → 65.85 | 12.50 → 14.41 | 12.47 → 15.33 |
| DOM nodes | 20501.00 → 20497.00 | 7646.00 → 7648.00 | 7037.00 → 7037.00 |
| Listeners | 3104.00 → 3103.00 | 871.00 → 871.00 | 773.00 → 773.00 |
| Documents | 3.00 → 3.00 | 3.00 → 3.00 | 3.00 → 3.00 |

Retention uses thirty warmed SPA route cycles and three GC/frame counter samples at each 0/10/20/30 checkpoint. These are bounded observations in one run, not leak attribution or process RSS. Twelve raw heap snapshots across both datasets are retained losslessly compressed; uncompressed sizes/hashes and verification manifest accompany them. Compression occurs after captured counters, outside timed interactions.

| Cold list resource timing median | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| JS/CSS requests | 53.0 | 3.0 | 31.0 |
| JS/CSS decoded bytes | 1986972.0 | 2477169.0 | 1468769.0 |
| JS/CSS transferred bytes | 628890.0 | 676439.0 | 430612.0 |

| API evidence | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Responses | 1579 | 1414 | 1414 |
| Decoded bytes | 12700277 | 12691305 | 12691305 |
| Unavailable response bodies | 0 | 0 | 0 |
| HTTP errors | 0 | 0 | 0 |

| Interaction CPU script / main-thread task median ms | Vue | Published native | Current native |
| --- | ---: | ---: | ---: |
| Task open | 28.73 / 3551.30 | 4.99 / 1122.57 | 17.01 / 858.27 |
| Edit/discard | 30.98 / 660.91 | 35.30 / 175.00 | 40.29 / 162.57 |
| Search | 5.24 / 387.02 | 12.80 / 503.70 | 10.80 / 324.16 |

Kanban CPU counters span document navigation/reset and are unavailable. Invalid raw deltas remain in the profiles; elapsed semantic readiness is still reported. API response-to-publication marks combine model/group/render/dispatch work and are not function attribution.

## Slower observations retained

All slower timed workload observations relative to the matched published native build remain explicit. These are bounded samples, not causal regressions or universal performance conclusions. The CPU tables also retain higher native task-open/edit script duration; the 500-task current heap endpoint is 15.33 MiB versus 14.41 MiB for published native.

| Dataset | Workload | Median delta | p95 delta |
| ---: | --- | ---: | ---: |
| 50 | First Kanban | -5.24% | +3.64% |
| 50 | Kanban ready | +2.40% | +5.29% |
| 50 | Search publication to paint | +12.15% | -68.92% |
| 500 | Warm list ready | -6.00% | +0.34% |
| 500 | Kanban ready | -6.06% | +1.24% |

All 12 raw heaps are losslessly compressed (163255860 bytes) and independently decompressed size/SHA verified. Retention counters do not establish leak freedom. Actual browser version is in the raw profiles; synthetic Chrome153 user-agent strings in backend logs are not the browser version.

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

Node24/pnpm11.25 is the repository requirement; this Cloud run used Node24.19.0 and installed pnpm11.19.0. Go1.27/Mage/C SQLite toolchain and Chromium are required. Preserve verified reference build manifests; the original Vue checkout dist placeholders are not a valid production reference. Archive reports/results before reruns. Do not run heavy parallel work or change runtime during measurement.

Evidence root: `/workspace/vikunja-evidence/final-acceptance-20261007/frozen/benchmark/`. `inputs.json`, `run/profile-raw-0.json`, `run/profile-raw-1.json`, `summary.json`, `heap-verification-manifest.json`, build/source audits and served-build census preserve pins, samples, API requests and byte accounting. Full route ledger remains partial for all 59 families; see `rc2-supported-route-device-coverage.md`.

## Subsequent runtime follow-up

The six-reference UI correction changes the frontend to `c2b439e84fcfdd7864ab7189015c239b014b472a` (runtime commit `d9823e439d93cd47f10978f7cba05c2a37104f34`). **This report was not rerun for that tree**; its tables and raw samples still measure frontend `50662d98588496fcc100d19b9b0412a84ed9ab05`. See [the separate fixes and focused verification](rc2-translation-labels-20261007.md).

The later admin recovery/notification ARIA+fade follow-up has runtime96d0b895/frontend `e820902d675fb296ad925ac357c69872ace99fd1` with separate [verification and inherited-failure classification](rc2-ui-recovery-20261007.md). This benchmark remains on frontend50662; it was **not rerun for that follow-up**.
