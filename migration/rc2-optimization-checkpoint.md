# Local RC2 loading optimization checkpoint

Status: local review branch `optimization/rc2-lazy-features-20261006`; not published. Starts at published `5a4e611e48b4f60b8c0547b1b1dd3a4f5ebebddf`, frontend tree `a7d6970ef57cec104f6b56a5c0d2d09d33ff3474`. Framework packages remain exact `5.0.0-rc.2`, canonical framework source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`. The official Vue baseline and historical local branches are preserved.

## Ownership and loading decisions

Root owns Session, authentication/sharing and one lazily constructed Workspace. Workspace owns the shell, catalog, core project Application and concrete optional feature Applications. Existing content/overlay Regions still own Views. Route/session revisions are checked after module readiness before constructing or starting an owner. Stopping an Application or closing a pending task invalidates its continuation; module import itself cannot be aborted.

Optional settings/admin/time tracking/import/OAuth/team/label/directory/home/management Applications load at their existing route boundaries. Core project/list readiness stays within Workspace so metadata/task loading displays retain the primary-route behavior. Table/Kanban/Gantt View constructors load during Project prepareStart; no View publishes before preparation succeeds. Task Applications load on standalone task or project-modal entry. Each constructor retains its original ports and existing owner lifetime; there is no new generic route framework or additional Application hierarchy.

Three eager backedges were removed by moving existing neutral code: feature-enabled checks are independent of admin, task time entries are independent of the routed time-tracking Application, and table preferences are independent of the table View. This preserves behavior and feature gates. Timer and shell use the same neutral feature check.

The original rich read-only/editor implementation remains intact. The list filter independently uses Tiptap/StarterKit, so that shared dependency remains on the primary project route. Existing SCSS source, foundation, theme, fonts and shared project-card styles are unchanged; Vite now emits optional feature CSS alongside chunks. Additional first-use requests and late CSS order are tradeoffs requiring browser validation. The shared native-list control stylesheet is explicitly retained at bootstrap because account/sharing surfaces use it before Workspace exists. Shared settings/search controls and project webhooks explicitly import their existing stylesheet; they cannot rely on visiting the settings Application first.

The official Records/RealWorld ownership guidance still applies: existing feature Applications coordinate lifetimes/readiness; Regions own Views; Views retain drafts/interaction; services own transport with explicit cancellation. Loading at an existing owner boundary is the only architectural deviation added in this batch. Imports prepare constructors; they do not replace the Application lifecycle.

## Verification so far

- Lint: zero errors, four inherited Axios warnings. Types: pass.
- Units: 690/690 in 74 files. Original assertions are retained; two fixtures explicitly register Workspace before inspecting it. Four new tests cover pending Root/Task import invalidation on stop or superseding destination.
- Production browser focus: first run 30/33. New test errors assumed a list link opened a modal and that mobile tabs were visible; corrected to actual Kanban modal and mobile dropdown journeys. Corrected six import/dark/editor/print checks pass at widths 1440 and 390. The other 27 existing focus/bootstrap/Gantt/visual checks passed on the initial run. Failed reports/traces are preserved externally.
- Source/dependency audit: no Vue dependencies, installed Vue packages, SFCs, imports, lock entries or tooling; all five runtime packages stay RC2. Development and production each contain 814 modules and zero Vue modules. No package/lock changes.
- Full aggregate before the CSS dependency fixes: 469/480, zero skipped/flaky, 25.0 minutes. Seven failures exposed missing shared CSS (project webhooks, OIDC buttons, project duplication); three match the recorded baseline (bot re-enable and two mobile bottom-marker checks); one resurfaced the recorded intermittent synthetic comment-fill divergence. Final focused regression: 51/52 pass in 174 seconds, with only the published bot re-enable failure. The repeated synthetic comment-fill checks pass on this run; the intermittent defect remains open. Production probes: 13/15 in 44.6 seconds; the two recorded cold-offline document failures remain. The final aggregate is 477/480 in 1414.3 seconds (23.6 minutes), zero skipped/flaky. Only the three published failures remain: bot re-enable and the two mobile rich-task bottom-marker cases. All seven prior CSS failures and the four exact comment replacement cases pass unchanged. This does not resolve the separately reproduced intermittent comment-fill defect. The aggregate exposed a missing stylesheet dependency in project webhooks: settings styling had arrived incidentally from the eager settings Application. Webhooks now imports that existing stylesheet directly. OIDC outlined-button checks exposed missing bootstrap shared native-list controls; these are now explicit in main. Duplicate-dialog traces showed the unstyled search result list participating in normal layout: closing it on pointer focus moved the submit button before pointer-up. SettingsSearchView now owns the original shared settings stylesheet. These are CSS dependency fixes; original tests remain unchanged and final focused browser regression verification: 51/52 pass; only the published bot re-enable failure remains. All seven CSS failures pass with unchanged assertions. Preserve the published suite’s known three aggregate failures and two cold-offline probe failures; these cannot be removed or relabeled as parity.

## Matched results and limits

The matched published/optimized benchmark is complete: 2/2 in934.3seconds, zero skipped/flaky. Measured runtime source8836ddf4bd70a55ed09a55461d7799fe12411cce, frontend a3a5f5e86c4f82e8b2e4bd4f3efedca4c54e816d. Three warmups, twenty samples per check/build/dataset, thirty retention cycles and snapshots0/30; all samples and failures remain preserved. [Full matched median/p95, byte, search, heap and parity report](rc2-optimization-results.md).

Static JS/CSS closure: 2,476,522raw/670,922gzip9bytes→702,011/180,652 (−71.65%/−73.07%). Actual cold primary-list decoded bytes2,477,169→1,459,725 and transfer676,439→428,333; asset entries3→30. Measured total non-map assets5,629,669/1,918,320→5,658,573/1,956,643 (+0.51%/+2.00%). The measured manifest includes a52-byte description absent in the standalone audit and changes sw.js precache/gzip2bytes; all other asset hashes and entry closure match. Both manifests/censuses are retained.

Cold FCP medians336/340ms→180/170; cold list readiness606.55/626.90→533.60/546.15 for50/500tasks. Warm list readiness342.60/353.10→337.15/357.25. First task1372.50/1332.63→1402.05/1386.37 and adds17requests/211,013transfer bytes. Task-open interaction1207.07/1186.27→1253.82/1248.85. Editor/search/Kanban medians and p95s are mixed; no all-route or search-speedup claim is supported. Search debounce remains150ms, with transport about4–5ms and scheduling/publication/frame time larger. No assignee-loop cause is established.

JS heap0→30cycles: published12.68→15.45MiB(50),12.68→15.67(500); optimized12.49→15.14,12.53→15.24. Listeners stable867/871 versus883/887; optimized nodes stable7633/7700, published7581stable/7646→7648. Snapshot self-byte growth mainly code-category growth plus browser resource/replay records. WeakMap/template/editor paths are exploratory; ephemeron reachability/dominators/source-owner attribution are not computed. These bounded observations establish neither unbounded growth nor a leak fix. Negative Kanban CPU deltas arose from navigation counter resets; the corrected summarizer marks all twenty per build/dataset unavailable and preserves the raw values. Browser suites were not rerun for this reporting correction.

The original Vue/native benchmark remains immutable. This pair compares published Marionette with optimized Marionette, not Vue. Newly reproduced mobile webhook and comment-fill defects have not been tested against Vue in this batch. Prior paired evidence records the bot412, mobile bottom markers and cold-offline document failures in both Vue and Marionette. All59routes remain partial, zero fully certified; visual gaps, documented behavior deviations, licensed backend/real host/external provider/OS IME variants and architecture gates remain open.

## Reproduce and artifacts

Workspace: `/workspace/vikunja-migration`. External evidence: `/workspace/vikunja-evidence/optimization-20261006`. Review mirror: `/workspace/Projects/VIKUNJA-RC2-REVIEW/OPTIMIZATION`.

```sh
cd frontend
pnpm lint:fix
pnpm typecheck
pnpm test:unit --run
cd ..
bash migration/audit/production-mage.sh '--config=../migration/acceptance/optimization-lazy.config.ts'
BENCHMARK_NATIVE_BASELINE_BUILD=/absolute/path/to/immutable/published-build \
  bash migration/audit/production-mage.sh '--config=../migration/acceptance/lazy-style-parity.config.ts'
BENCHMARK_NATIVE_BASELINE_BUILD=/absolute/path/to/immutable/published-build \
  bash migration/audit/production-mage.sh '--config=../migration/acceptance/comment-replacement-paired.config.ts'
bash migration/audit/production-mage.sh '--config=../migration/acceptance/playwright.config.ts'
bash migration/audit/production-mage.sh '--config=../migration/acceptance/production-probes.config.ts'
BENCHMARK_NATIVE_BASELINE_BUILD=/absolute/path/to/immutable/published-build \
BENCHMARK_FIRST_USE=1 BENCHMARK_SEARCH_PHASES=1 \
bash migration/audit/production-mage.sh '--config=../migration/acceptance/benchmark.config.ts'
```

For this prepared cloud environment, the exact environment variables, serial commands, exit codes and archival paths are in `/workspace/vikunja-evidence/optimization-20261006/verify-remaining.sh`. The full aggregate uses the checked-in isolated OIDC fixture configuration and provider on port 18765. It requires the existing Go/Mage/Chromium setup; no production credentials or data are used. Heap snapshots remain external synthetic-fixture evidence.

Use the checked-in E2E skill and one browser runner; archive each report/results directory before the next run. The optional native baseline mode verifies every saved asset against the published manifest and aborts on mismatch. Its reference is the published RC2 app; omitting that mode preserves the original pinned Vue comparison.

## Terminal status

Same-environment shell and clock succeeded at17:19:59 and17:24:45UTC despite platform disconnect notifications. One actual exec-server transport error at17:22 was followed by a successful same-workspace read-only retry; analysis then completed. No environment switch, duplicate suite, model/effort escalation or public push occurred. Serial runner36935 is terminal; all reports, raw data, censuses and eight synthetic-fixture heaps are archived externally. Final frontend remains unchanged from the measured source; later commits contain report/harness corrections only.

The original four repeated comment cases were run five times per build, twelve rounds per case, retries zero and alternating app order:38/40 in349.9seconds. Published-Marionette mobile fill failed2/5(rounds2and6); all twenty optimized cases and all keyboard cases passed. Failure beforeinput target/DOM selection is collapsed at22 with no selected text. The earlier optimized aggregate has the matching failure. No editor behavior/assertion changed; the intermittent source/harness cause remains unresolved. Vue comparison for this defect is pending.

User-visible report: Library→Projects→Vikunja RC2→Vikunja Migration Progress.md. Local review artifacts include the report, source-only zip, summary JSON and paired representative screenshots. Raw heaps and historical/private Git history are not included in the source zip.

Focused follow-up against original Vue completed2026-10-06:45/48 with three preserved failures. See [Vue comparison and diagnosis](rc2-vue-observation-comparison.md); runtime source remains unchanged.
