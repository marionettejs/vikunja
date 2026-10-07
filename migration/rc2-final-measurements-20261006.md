# Fresh three-build production measurements — 2026-10-06

Current Marionette improves cold startup and list transfer in this run. It increases first task cost and search latency versus preoptimization Marionette. Against frozen Vue, sampled task/editor/Kanban operations and startup are faster, but search is slower. This compares complete implementations including correctness changes; it is not a controlled framework ranking or full parity certification.

## Inputs and protocol

- Current native `29d4c7d5578f358cccfefbf8f83e2a3fe95fd24c`, frontend `ff801880f173369332a614445c28f0a2a7391a81`.
- Earlier native `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`, frontend `a7d6970ef57cec104f6b56a5c0d2d09d33ff3474`; all immutable baseline assets hash-verified.
- Frozen Vue upstream `5d22d730aa35b0666d0849099c12a1e638baabc9`, frontend `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`;327 original production assets hash-verified. RealWorld main reverified after the run: `34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04`.
- All five Marionette runtime packages exactly5.0.0-rc.2, canonical source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`.
- Same Mage-owned isolated SQLite backend and synthetic user/project/task/comment fixtures.50/500 seeded tasks,50 visible rows/cards, rich task description and50 comments asserted. No production data.
- Chromium151.0.7922.173, Nodev24.19.0, headless1440×900/DPR1/en-US/UTC; one runner, no CPU/network throttle, service workers blocked. No concurrent review/suites/source edits during measurements.
- Three warmups, all20 measured samples retained; startup order rotates across three apps. Interaction and retention blocks follow each app in the same runner. Cold=fresh context/shared browser process, warm=document reload/context cache. First task follows list; first editor follows task; first Kanban uses document navigation. Nearest-rank p95=rank19/20.
- Two datasets pass in2032.817seconds (33.88minutes),0skipped/flaky; every app/dataset records0 API errors. Three forced-GC/frame samples per retention checkpoint,30 route cycles, snapshots at0/30. Snapshot sampling can affect later heap.

## Actual build and transfer bytes

| Scope | Vue raw / gzip9 | Earlier native raw / gzip9 | Current native raw / gzip9 |
| --- | ---: | ---: | ---: |
|Inferred initial static JS/CSS closure|1,440,713 / 435,161|2,476,522 / 670,922|705,545 / 181,127|
|All emitted assets excluding maps|7,315,058 / 2,323,808|5,629,669 / 1,918,320|5,667,937 / 1,959,307|

Current initial closure7files versus earlier2 and Vue34; current202 non-map files versus earlier137 and Vue294. Gzip9/mtime0 is a deterministic census, not configured HTTP encoding. Initial closure is inferred from static imports; actual route resources are independently measured below.

| Cold primary list | Vue | Earlier native | Current native |
| --- | ---: | ---: | ---: |
|JS/CSS resource entries|53|3|31|
|Decoded JS/CSS bytes|1,986,972|2,477,169|1,464,101|
|Transferred JS/CSS bytes|628,890|676,439|429,272|

These list values are identical in both datasets. Current list transfer429,272bytes is36.54% below earlier native and31.74% below Vue. First task adds18entries/748,001decoded/213,263transferred bytes in current native, versus0 earlier native and21entries/535,658decoded/172,543transferred bytes in Vue. Editor entry afterward adds0 assets in all builds. First-Kanban document transfer21,271current versus900earlier and15,900Vue reflects prior-context caching, not cold Kanban transfer.

## Timings

Each cell is median / p95 milliseconds, n20. Negative current/earlier median change means faster. Warm and first-use tradeoffs remain visible.

### Dataset50

| Check | Vue | Earlier native | Current native | Current / earlier median change |
| --- | ---: | ---: | ---: | ---: |
|Cold FCP|282.00 / 320.00|330.00 / 360.00|162.00 / 200.00|-50.91%|
|Cold list ready|710.35 / 828.40|606.65 / 647.40|513.90 / 568.80|-15.29%|
|Warm FCP|154.00 / 180.00|142.00 / 176.00|86.00 / 112.00|-39.44%|
|Warm list ready|441.95 / 488.30|328.85 / 356.40|326.70 / 393.00|-0.65%|
|first-task-after-list|3749.53 / 4305.78|1245.96 / 1436.69|1329.55 / 1525.21|+6.71%|
|first-editor-enter-discard|639.70 / 755.19|243.97 / 316.22|258.72 / 303.39|+6.05%|
|first-kanban-after-list|422.55 / 525.32|312.52 / 345.81|303.07 / 377.44|-3.02%|
|task-open|3290.11 / 3947.42|1146.76 / 1228.50|1228.48 / 1395.55|+7.13%|
|editor-enter-discard|617.95 / 685.67|243.54 / 290.61|234.53 / 286.95|-3.70%|
|search-results|508.58 / 560.40|575.79 / 670.59|640.01 / 702.84|+11.15%|
|kanban-ready|456.03 / 489.80|304.46 / 359.59|311.76 / 376.67|+2.40%|

### Dataset500

| Check | Vue | Earlier native | Current native | Current / earlier median change |
| --- | ---: | ---: | ---: | ---: |
|Cold FCP|282.00 / 328.00|318.00 / 368.00|162.00 / 208.00|-49.06%|
|Cold list ready|682.70 / 799.60|591.45 / 693.30|513.20 / 582.90|-13.23%|
|Warm FCP|152.00 / 168.00|142.00 / 160.00|84.00 / 120.00|-40.85%|
|Warm list ready|436.10 / 478.10|341.65 / 436.70|336.05 / 391.10|-1.64%|
|first-task-after-list|3705.20 / 4037.72|1274.62 / 1428.50|1355.58 / 1510.80|+6.35%|
|first-editor-enter-discard|623.14 / 739.72|263.06 / 311.01|249.37 / 290.55|-5.20%|
|first-kanban-after-list|446.30 / 494.91|327.85 / 356.34|304.32 / 361.67|-7.18%|
|task-open|4141.15 / 4455.86|1186.21 / 1287.91|1227.18 / 1496.06|+3.45%|
|editor-enter-discard|761.05 / 928.60|246.60 / 310.45|258.30 / 353.99|+4.74%|
|search-results|536.28 / 683.31|561.42 / 697.34|632.38 / 692.59|+12.64%|
|kanban-ready|556.32 / 645.30|308.95 / 366.94|320.68 / 405.75|+3.80%|

Compared with earlier native, current cold FCP median improves49.06–50.91% and cold readiness13.23–15.29%; warm readiness changes only−0.65/−1.64% with mixed p95. First task slows6.35–6.71% and repeated task-open3.45–7.13%; search-results slows11.15–12.64%. Compared with Vue, current cold FCP improves42.55% and cold readiness24.83–27.65%, while search-results slows17.92–25.84%. These are one local run’s elapsed medians, not device/network guarantees.

## CPU and search phases

Valid same-document CDP ScriptDuration / TaskDuration deltas, median milliseconds (n20 each). TaskDuration is reported as measured main-thread task duration; no function-level attribution. All Kanban CPU deltas are unavailable because navigation resets counters: all20 invalid iterations/app/dataset and their original raw deltas remain preserved.

| Dataset / action | Vue script / task | Earlier script / task | Current script / task |
| --- | ---: | ---: | ---: |
|50 / task-open|26.79 / 3247.34|4.49 / 1096.95|17.09 / 1176.56|
|50 / editor-enter-discard|28.04 / 587.22|34.90 / 181.03|36.22 / 170.09|
|50 / search-results|4.53 / 391.14|12.89 / 473.42|13.13 / 523.07|
|500 / task-open|31.39 / 4108.94|4.91 / 1142.83|17.32 / 1186.95|
|500 / editor-enter-discard|34.58 / 722.91|34.29 / 173.50|38.79 / 186.95|
|500 / search-results|5.75 / 428.19|12.45 / 455.88|14.17 / 513.68|

Full20-sample median/p95 CPU, input-to-request, response-to-publication, publication-to-paint and API cardinality distributions are in the machine-readable summary. Search input-to-paint median/p95:

| Dataset | Vue | Earlier native | Current native |
| --- | ---: | ---: | ---: |
|50|225.10 / 262.90|247.15 / 313.10|268.70 / 331.00|
|500|241.50 / 320.60|240.90 / 320.50|271.80 / 315.00|

Each measured search issues one matching task request in every build. Response-to-publication combines model/group/render/dispatch work, not a named-function profile. Small negative clock-offset values are preserved.

## Bounded retention

| Dataset / build | Heap MiB0→30 | Nodes0→30 | JS event listeners0→30 |
| --- | ---: | ---: | ---: |
|50 / Vue|57.15→62.48|20399→20399|3095→3095|
|50 / Earlier native|12.81→15.75|7581→7581|867→867|
|50 / Current native|12.47→15.38|7635→7635|883→883|
|500 / Vue|56.95→62.42|20497→20501|3103→3104|
|500 / Earlier native|12.67→15.46|7646→7648|871→871|
|500 / Current native|12.46→15.34|7702→7702|887→887|

Document count remains3 throughout every build/dataset. Current native has a lower observed heap/DOM/listener footprint than Vue in these captured states; all builds retain some heap growth and counts reflect different view/editor/transition/cache implementations. This does not establish framework-specific leaks or universal leak absence. Raw twelve synthetic-fixture heap snapshots remain private/external and are excluded from the review/source ZIP.

## Reproduction and evidence

Prepared serial script `/workspace/vikunja-evidence/final-quality-20261006/final-benchmark.sh` uses `BENCHMARK_ALL_REFERENCES=1`, pinned immutable builds, `BENCHMARK_FIRST_USE=1`, `BENCHMARK_SEARCH_PHASES=1`, and external heap directory. Browser command: `bash migration/audit/production-mage.sh '--config=../migration/acceptance/benchmark.config.ts'` with the recorded environment. Always use Mage and archive before rerun. Raw log/report/profiles: `/workspace/vikunja-evidence/final-quality-20261006/{benchmark-final.log,benchmark-final/}`; summary and actual measured build census alongside. The full480-case frozen run is477/480 before the final Gantt fix; final source has745unit tests,15focused Gantt browser passes and13/15 production probes. See [independent review](rc2-independent-review-20261006.md), [fix evidence](rc2-parity-fixes-20261006.md) and [remaining boundaries](rc2-remaining-parity-gaps.md). No full route/device/accessibility/licensed-backend parity certification or public push/release/deployment.
