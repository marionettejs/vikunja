Current reviewed source and fresh three-build comparison: [final measurements](rc2-final-measurements-20261006.md). This earlier report retains its exact historical source pins and raw evidence.

# Historical matched RC2 loading optimization results

The local optimization improves cold paint and list readiness in this run. It shifts work to first task entry, adds asset requests, and does not demonstrate a general warm-speed or leak improvement. No public push, release or deployment is authorized.

## Pinned inputs and protocol

- Published Marionette: `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`, frontend `a7d6970ef57cec104f6b56a5c0d2d09d33ff3474`; every saved baseline asset is hash-verified against its original manifest.
- Measured optimization: `8836ddf4bd70a55ed09a55461d7799fe12411cce`, frontend `a3a5f5e86c4f82e8b2e4bd4f3efedca4c54e816d`. Later report-only commits retain this frontend.
- All five runtime packages: exact `5.0.0-rc.2`; canonical source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`.
- Same isolated Mage/SQLite backend; 50/500 seeded tasks, fifty visible list rows/cards, rich task description and fifty comments asserted. No production accounts/data.
- Chromium151.0.7922.173, Node24.19.0; headless1440×900/DPR1/en-US/UTC, no CPU/network throttling, service workers blocked. AMD EPYC9V74,4-CPU cgroup,16GiB. Three warmups and all twenty measured samples retained. Startup order alternates per iteration; interaction/retention app blocks retain the existing protocol. One browser runner.
- Cold means fresh context in a shared browser process; warm means document reload with context cache. First task follows cold/warm list; first editor follows task read (the unchanged reader already uses Tiptap); first Kanban uses document navigation. p95 is nearest rank19of20. This single local matched run is not a cross-device or network-latency guarantee.
- Benchmark2/2 passes,934.3seconds,zero skipped/flaky. Original Vue/native benchmark is unchanged; this new pair compares two Marionette revisions.

## Build and actual route bytes

| Scope | Published raw / gzip9 bytes | Measured optimized raw / gzip9 bytes | Change raw / gzip |
| --- | ---: | ---: | ---: |
| Inferred index/static-import JS/CSS closure | 2,476,522 / 670,922 | 702,011 / 180,652 | -71.65% / -73.07% |
| All emitted non-map assets | 5,629,669 / 1,918,320 | 5,658,573 / 1,956,643 | +0.51% / +2.00% |

Closure files grow2→7; total files137→200 (JS100→149,CSS1→15). Fonts and sourcemaps are unchanged. Gzip9/mtime0 is deterministic census, not a promise about deployment encoding. The measured Mage build differs from the standalone module-audit build only in manifest.webmanifest’s52-byte description field and its sw.js precache hash (raw SW size equal, gzip2bytes smaller). Every other emitted file hash and the entry closure match exactly. The measured totals above include that difference; the earlier standalone audit totals remain in final-bundle.json.

Cold primary-list ResourceTiming (same values in both datasets): decoded JS/CSS2,477,169→1,459,725bytes (−41.07%); transfer676,439→428,333bytes (−36.68%); entries3→30. This is the route’s actual observed asset evidence, distinct from the smaller static closure. First task adds17entries/743,166decoded/211,013transfer bytes in the optimization; published adds zero. Entering the editor afterward adds zero assets in either build. First Kanban document uses34entries/20,971transfer bytes versus3/900; prior-context caches influence those figures.

## Matched timings

Each cell is median / p95 milliseconds, n20. Elapsed-median change is relative to published; lower is faster.

| Dataset | Check | Published | Optimized | Median change |
| --- | --- | ---: | ---: | ---: |
| 50 | Cold FCP | 336.00 / 380.00 | 180.00 / 204.00 | -46.43% |
| 50 | Cold list ready | 606.55 / 715.80 | 533.60 / 631.30 | -12.03% |
| 50 | Warm FCP | 146.00 / 168.00 | 88.00 / 104.00 | -39.73% |
| 50 | Warm list ready | 342.60 / 428.20 | 337.15 / 392.70 | -1.59% |
| 50 | First use first-editor-enter-discard | 256.76 / 314.64 | 251.89 / 323.89 | -1.90% |
| 50 | First use first-kanban-after-list | 330.29 / 427.07 | 307.26 / 344.63 | -6.97% |
| 50 | First use first-task-after-list | 1372.50 / 1491.76 | 1402.05 / 1640.02 | +2.15% |
| 50 | Interaction editor-enter-discard | 252.06 / 325.52 | 259.56 / 294.70 | +2.98% |
| 50 | Interaction kanban-ready | 320.09 / 406.35 | 326.87 / 395.20 | +2.12% |
| 50 | Interaction search-results | 615.79 / 722.94 | 654.51 / 691.11 | +6.29% |
| 50 | Interaction task-open | 1207.07 / 1400.49 | 1253.82 / 1481.12 | +3.87% |
| 500 | Cold FCP | 340.00 / 396.00 | 170.00 / 196.00 | -50.00% |
| 500 | Cold list ready | 626.90 / 677.10 | 546.15 / 585.40 | -12.88% |
| 500 | Warm FCP | 150.00 / 180.00 | 94.00 / 108.00 | -37.33% |
| 500 | Warm list ready | 353.10 / 436.30 | 357.25 / 389.50 | +1.18% |
| 500 | First use first-editor-enter-discard | 251.25 / 328.15 | 256.56 / 344.52 | +2.11% |
| 500 | First use first-kanban-after-list | 329.35 / 377.22 | 322.82 / 391.90 | -1.98% |
| 500 | First use first-task-after-list | 1332.63 / 1461.33 | 1386.37 / 1516.49 | +4.03% |
| 500 | Interaction editor-enter-discard | 258.74 / 371.70 | 244.83 / 292.69 | -5.38% |
| 500 | Interaction kanban-ready | 327.30 / 392.05 | 304.93 / 362.66 | -6.83% |
| 500 | Interaction search-results | 616.32 / 755.99 | 580.36 / 710.27 | -5.83% |
| 500 | Interaction task-open | 1186.27 / 1390.80 | 1248.85 / 1362.29 | +5.28% |

Cold FCP falls46–50%, cold list readiness12–13%. Warm list readiness is approximately unchanged (−1.6%/+1.2%). First task is slower by30/54ms; task-open interactions are slower by47/63ms. Editor, search and Kanban results vary by dataset and percentile. Do not describe this as an all-route speedup.

## Search and counter limits

| Dataset / build | Input→request | Request→last response | Last response→publication | Publication→two-frame mark | Input→two-frame mark |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 / optimized | 175.11 / 200.77 | 5.34 / 11.24 | 10.75 / 38.75 | 95.05 / 105.30 | 277.50 / 315.00 |
| 50 / published | 170.07 / 204.67 | 4.41 / 5.17 | 16.73 / 60.75 | 85.00 / 135.90 | 273.20 / 326.10 |
| 500 / optimized | 165.01 / 200.08 | 4.47 / 10.88 | 12.47 / 57.38 | 83.80 / 107.20 | 252.85 / 312.70 |
| 500 / published | 177.56 / 200.43 | 4.57 / 6.60 | 14.73 / 54.95 | 90.15 / 102.30 | 266.85 / 315.60 |

Search keeps the same150ms debounce. One matching search request occurs per sample; transport is about4–5ms, while debounce/scheduling and publication/frame work dominate the marked interval. These marks combine model/group/render/dispatch work; two requestAnimationFrames are a scheduling marker, not proof of physical screen presentation. The assignee-lookup hypothesis is not established by this fixture (no assignees). Search elapsed medians move in opposite directions; no general search gain is established.

Same-document task-open script-duration median is5.14→17.89ms(50) and4.83→18.05ms(500), consistent with deferred module work entering the action interval, without isolating exact functions. Kanban CPU counters reset on its document navigation: all twenty before/after deltas per build/dataset are explicitly unavailable in the corrected summarizer. Negative original values and raw counters are preserved; elapsed Kanban timing remains valid. No CPU gain is inferred from reset counters.

Each build records1,414API responses per dataset, zero HTTP errors, zero unavailable bodies, identical response bytes per dataset and identical array-cardinality histograms. Timings therefore compare the same asserted fixture content.

## Retention and heap analysis

| Dataset / build | Triple-GC JS heap MiB at0→10→20→30 | Documents0→30 | Nodes0→30 | Listeners0→30 | Snapshot self bytes0→30 | Detached native nodes0→30 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 50 / optimized | 12.49→14.27→15.14→15.14 | 3→3 | 7633→7633 | 883→883 | 22,026,566→25,120,066 | 1024→1374 |
| 50 / published | 12.68→14.45→15.26→15.45 | 3→3 | 7581→7581 | 867→867 | 22,775,366→26,062,323 | 1570→1371 |
| 500 / optimized | 12.53→14.31→15.19→15.24 | 3→3 | 7700→7700 | 887→887 | 22,193,623→25,246,779 | 1580→1385 |
| 500 / published | 12.68→14.91→15.38→15.67 | 3→3 | 7646→7648 | 871→871 | 22,815,739→26,287,315 | 1580→1385 |

Both builds grow roughly2.6–3.0MiB during this bounded run. Optimized counters plateau near cycle20; this is not proof of long-term bounds or a leak fix. Optimized steady node/listener counts are52/54nodes and16listeners above published, stable across cycles. Published500gains two nodes; listeners remain stable in both builds.

Snapshot self-byte growth is3.05–3.47MB; code-category growth accounts for2.35–2.74MB (about76–81%). Browser NetworkResourcesData grows360objects/103,680self bytes and XHRReplayData210/36,960 in every pair. Exploratory paths include module/code roots, current document/layout, Lit template caches and WeakMap-associated parts/editor nodes in both builds. Paths exclude explicit weak edges but do not implement WeakMap ephemeron reachability or dominators; minified names are not source-attributed owners. New surviving objects include replacement objects for the current UI, not necessarily accumulation. Detached counts finish similarly in both builds and vary in direction. There is no demonstrated Application/View leak cause or fix.

JSHeapUsedSize, snapshot self bytes and dominator retained size are different measures; the last is not computed. Snapshots0/30 follow triple-GC samples and can perturb later heap. Thirty cycles and one run are insufficient to establish unbounded growth. Raw synthetic-fixture heaps remain outside the repository/review zip.

## Remaining parity gaps

- Proven differences against frozen Vue: unmasked captures still show task-action icon/typography and capture-scroll differences. Native preserves sibling password drafts that Vue clears and hides unauthorized webhook Create controls Vue exposes; these documented behavior deviations remain review decisions.
- Prior paired Vue/Marionette evidence records bot re-enable412, the two390px bottom-marker failures and cold-offline login/root document failures in both. Final optimized aggregate477/480 and probes13/15 retain those assertions; live-offline is separately passing.
- Mobile webhook blank root is confirmed in published and optimized Marionette; Vue was not tested for this new finding. It is an existing Marionette defect, not proven shared with Vue. No runtime fix was made in this optimization batch. Both mobile style cases remain failed despite equal sampled values.
- Comment-fill is an unresolved synthetic input/source interaction: two of five published-Marionette mobile fill trials fail with collapsed selection; all twenty optimized cases pass, but the pre-CSS optimized aggregate also failed similarly. Vue was not tested for this defect in this batch. Keyboard cases pass; no resolution or source cause is established.
- All59original route declarations are implemented but partial, zero fully certified. Licensed admin/time tracking on a supported licensed backend, real Electron host, external providers/mail/avatar variants, OS IME, full device/accessibility/appearance coverage remain unverified. Independent results-host destruction and Workspace cohesion remain architecture gates.

## Evidence and reproduction

Workspace `/workspace/vikunja-migration`, local branch `optimization/rc2-lazy-features-20261006`. Evidence root `/workspace/vikunja-evidence/optimization-20261006`: `benchmark-final/original-report.json`, both `profile-raw-*.json`, `benchmark-summary.json`, preserved `benchmark-summary-first.json`, `baseline-bundle.json`, `measured-bundle.json`, `final-bundle.json`, `heap-categories.json`, all eight `heaps/*.heapsnapshot`, `environment.json`, `verification-exits.txt`, `aggregate-final/summary.json`, `production-probes-final/summary.json`, `style-final/summary.json`, `comment-paired/summary.json`. Failures and prior attempts remain archived separately.

Use the checked-in E2E skill and production Mage adapter, one browser runner. The exact prepared-environment variables and serial commands are in external `verify-remaining.sh`; this run is terminal, do not overlap another runner. Isolated OIDC fixture setup is documented in rc2-parity-ledger.md.

```sh
BENCHMARK_NATIVE_BASELINE_BUILD=/workspace/vikunja-evidence/optimization-20261006/baseline-production \
BENCHMARK_FIRST_USE=1 BENCHMARK_SEARCH_PHASES=1 \
BENCHMARK_HEAP_DIRECTORY=/absolute/path/to/new/heaps \
bash migration/audit/production-mage.sh '--config=../migration/acceptance/benchmark.config.ts'
python3 migration/benchmark/summarize-optimization.py RAW_DIRECTORY OUTPUT_JSON
python3 migration/audit/bundle-census.py BUILD_DIRECTORY OUTPUT_JSON
python3 /workspace/vikunja-evidence/optimization-20261006/analyze-matched-heaps.py HEAP_DIRECTORY
```

Terminal benchmark934.3sec; final aggregate1414.3sec; probes44.6sec; style100.4sec; repeated edits349.9sec. No overlapping suites or model/effort escalation. Source/dependency audit remains Vue-free and814modules in both builds, all runtime packages RC2. Units690/690, types pass, lint zero errors/four inherited warnings. These checks do not certify whole-app parity.

Focused follow-up against original Vue completed2026-10-06:45/48 with three preserved failures. See [Vue comparison and diagnosis](rc2-vue-observation-comparison.md); runtime source remains unchanged.
