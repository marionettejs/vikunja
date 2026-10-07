# Supported route and device evidence

Latest bounded continuation: [October7 unblocked parity](rc2-unblocked-parity-20261007.md) and [matched current measurements](rc2-undo-milestone-measurements-20261007.md). All59families remain partial. The earlier pinned stages below are preserved historical evidence.

Continuation of the reviewed checkpoint. The final Gantt runtime tree
`ff801880f173369332a614445c28f0a2a7391a81` now has fresh broad evidence.
Subsequent bounded hydration and creation-focus changes require their own
verification; no broad result is silently transferred to changed source. Full route declarations remain in
`rc2-full-route-inventory.md`. A route being implemented does not certify every
appearance, device, failure, accessibility or backend variant.

## Existing executed evidence

The fresh archived `continued-coverage-20261006/aggregate-final-source/report.json`
ran source `7c0543be765532f3d4dbfd83b7a40be94b1d4ba7`, frontend
`ff801880f173369332a614445c28f0a2a7391a81`: **477/480**, zero skipped/flaky,
1452.720 seconds. The three retained failures are bots re-enable backend412
and two390px rich-task list/kanban modal navigation markers. This supersedes
the earlier pre-Gantt aggregate pin; it does not certify later runtime edits.

| Route family | Native supported-backend evidence | Device/theme extent | Paired Vue work remaining |
| --- | --- | --- | --- |
| Login, registration, reset request/reset | Authentication 1/1; account entry 13/13. Registration/login and seeded token consumption/reuse rejection, validation, duplicate submission and route replacement | Reset success at1440/390; other cases default1440. No full theme axis | Registration/reset, mobile entry/error/cancel, theme variants |
| General, password, email settings | Settings10/10; controls5/5. Real payload/storage/reload, password/new login, email rejection/update/resend/cancel, retry and delayed general save | General success1440/390; desktop light/dark/system appearance. Credential cases default1440 | New paired profile retry and password/email acceptance at1440/390 × light/dark passed (48-case matrix); remaining localization/reminder/delay variants open |
| Project create/edit/archive/delete | Management11/11. Backend child creation, four views, metadata, archive/unarchive, descendant removal, permissions, retry and late writes | Overview1440/390; management defaults1440 | New paired edit/archive/delete at1440/390 × light/dark passed (48-case matrix). Parent-create, failure/focus and51-task count boundary remain open |
| Project sharing/public-share authentication | Management12/12; access12/12. User/team permissions, password links, refresh, identity collision, denied writes, cancellation | Link management/deep links1440/390; other cases default1440 | New paired management→anonymous password rejection/auth/reload→revocation at1440/390 × light/dark passed (48-case matrix). User/team/error/late responses remain open |
| Teams/labels | Organization16/16. Backend create/edit/member permissions/delete, label color/filter/delete, rejection and late publication | Create/edit and dialog focus/Escape1440/390; other cases default1440 | New paired create/edit/reload/delete at1440/390 × light/dark passed (48-case matrix). Permission/retry/delay variants and larger catalogs remain open |
| About | Within avatar-system17/17. Escape/history/cleanup and keyboard-menu/footer entry | Escape/cleanup1440/390, keyboard entry desktop | Paired focus, direct reload and dark appearance remain open |

The aggregate config defaults to1440×900. Individual width loops are evidence
only for their named cases. Native-versus-native style comparisons do not
establish Vue parity. The new paired matrix uses the unchanged frozen Vue
production assets, current native production build, same Mage/SQLite fixtures,
Chromium,1440/390×900, light/dark, and common outcomes/selectors. Screenshots
and form geometry are retained as evidence; screenshot capture alone is not a
pixel comparison or a complete accessibility audit.

## Available work versus actual access blockers

**Available, not yet fully exercised:** supported backend CRUD, seeded auth
tokens, both viewports/themes, navigation/reload, keyboard focus, controlled
failed/delayed responses, app-independent paired outcomes, and Chromium
composition. These are coverage work; they are not blocked by licensing.

**Actual access/environment blockers:** valid licensed admin/time backend,
external email/provider delivery, real Electron host, and OS/device IME.
Advertised frontend contracts and seeded tokens cannot certify those external
systems. No license bypass or backend permission changes are authorized.

## Performance investigation

The fresh n20 three-build benchmark remains the quantitative baseline in
`rc2-final-measurements-20261006.md`. Search module and feature CSS are unchanged
from published native. Similar request-publication times and a longer observed
publication-to-frame interval do not prove a debounce regression. Separate
instrumented paired task/search diagnostics are prepared: rotating order,
one warmup plus six retained samples per app, CPU profiles, resource timings,
DOM publication and Performance counters. Both six-sample diagnostics completed without API errors. Current/published
first-task medians were1433.16/1342.97ms before hydration and1290.03/1385.25ms
after; search661.13/634.59ms before and689.79/667.06ms after. The locale
getter hotspot disappeared from the current first-task top CPU samples after
reading language once per call; converted field keys are also computed once
per field. Full raw profiles and `hydration-diagnostic-comparison.json` remain
external. Instrumented, small-sample timings must not substitute for the
untraced n20 benchmark or prove a search improvement.

A separate measured cost is988toolbar buttons across52editors, with one
visible toolbar. Deferring never-used preview toolbars is under investigation;
retain the toolbar once editing begins, preserve initial empty/draft composers
and Region-owned teardown. No toolbar performance improvement is claimed yet.

Previous raw heap snapshots are losslessly gzip-compressed after checking the
decompressed SHA256 against the original. The original paths and hashes map to
gzip files in `final-quality-20261006/heaps/lossless-storage-manifest.json`.
All snapshot content and failures remain retained; decompress for heap viewers.

## Reproduction

Use the environment exports in `rc2-final-measurements-20261006.md`, then:

```bash
bash migration/audit/production-mage.sh '--config=../migration/acceptance/supported-device-paired.config.ts' > /tmp/supported-device-paired.log 2>&1
BENCHMARK_NATIVE_BASELINE_BUILD=/workspace/vikunja-evidence/optimization-20261006/baseline-production bash migration/audit/production-mage.sh '--config=../migration/acceptance/performance-cause.config.ts' > /tmp/performance-cause.log 2>&1
```

Mage owns the isolated test backend and teardown. Run browser suites serially;
archive reports/results before reruns. These commands are prepared coverage,
not a claim that the new journeys have already passed.

## Creation focus: observed defect and bounded fix

The first48paired run retained24passes/24failures. Failures include test
assumptions disproved by Vue: route-back token evaluation timing, protected
share reload requiring a fresh password, and guessed initial creation focus.
All failed reports/traces remain archived in `supported-device-before`;
backend412/403 contracts and target focus were corrected from real behavior.

A separate8/8observation run captured both apps at1440/390 for teams/labels.
Vue focuses outer **Close dialog** on desktop and Card-header **Close** on
mobile. Native incorrectly focused the name input and omitted the header
control. Commit `e8d5e8cc6` restores the original control/icon/classes, resets
only the leaked outer-close styles on that inner control, removes explicit
input focus, and keeps existing View event/cleanup ownership. The previous
native-only name-focus assertion was replaced by the strict recorded Vue
contract, with visible input/Escape/return-focus assertions retained. The corrected48paired run passed **48/48**,239.753seconds,zero skipped/flaky
(source at start `e8d5e8cc6`, later documentation-only commit `958a36b67`;
frontend unchanged). Separate strict focus comparison **8/8**,20.175seconds
with screenshots, on source `958a36b67`. Capture alone does not prove full
appearance parity: inspected mobile-dark team captures show a native-only
autofocus, omitted member avatar and wrapping Add to Team action. Those
concrete gaps now have a separate paired acceptance target under preparation.

## Preview editor toolbar cost

Commit `44eef7fb5` defers only never-used preview toolbars. A toolbar is created
synchronously when effective writable edit mode first begins; empty/restored
draft composers create it immediately. The existing Region retains it across
save/discard and destroys it with the editor View. A destroyed cached child
is recreated on later permitted editing; controls never grant permission.
No Tiptap instance, bubble menu or editor document is recreated by this change.
Real-editor RED evidence:2failed/14passed preview/readonly construction cases.
After:17/17 including pressed marks, ArrowRight focus, initial composers,
expanded-table identity, Region teardown/release and permission revocation.
Full units now **753/753 across83files**,35.05seconds, exit0. TypeScript,
ESLint and Stylelint exit0 (four inherited Axios warnings). Browser lifetime coverage **47/47**,234.160seconds,zero skipped/flaky, on
source `44eef7fb5` (later documentation/test-only commits did not change the
frontend). It includes keyboard/paste/Chromium composition, repeated comment
replacement, failed/pending saves, permissions, upload cancellation, roving
focus/link/table controls and the corrected organization focus/Escape cases.
After diagnostic **1/1**,52.055seconds,0 API errors. Current/published n6
first-task medians1129.09/1347.27ms and search481.10/607.32ms. Toolbar buttons
19/988, one visible host in both. Input-to-result median196.75/238.35ms.
These are instrumented diagnostics, including automation selector cost; no
claim that all elapsed improvement equals human perceived latency. Raw stage
summary/profiles and current loaded JS assets are archived. Fresh untraced n20
three-build measurements remain required after final correctness fixes.

Evidence storage is losslessly deduplicated for verified byte-identical
archived ZIP/images/large JSON files. Paths/content remain intact as read-only
hardlinks; original mode/mtime and SHA256 are recorded in external
`lossless-dedup-manifest.json`. Reclaimed1,216,541,433bytes; no failures or
unique artifacts were removed.

## Team member and shell appearance: bounded verified fixes

First paired initial-focus/avatar target: **4/8**,76.105seconds, only native
failed. Source `6a49773c2` then passed **8/8**,25.427seconds for both widths
and themes. It gates autofocus at>769, restores24px User avatars through
existing neutral user Views and keyed owner Regions, removes those Regions
before replacing Lit member hosts, and ports User.vue styles. The parent View
owns final child destruction; no new Application or transport is introduced.

A stronger preserved run on `13ccf9c4b`: **4/8**,46.116seconds. All native
cases exposed the hidden project-description link still displayed by CSS;
mobile also exposed wrapped Add to Team text. Native member search omitted
Multiselect's inline container/input-wrapper rules because SettingsSearchView
styles were scoped only to settings. Commit `4ce73ad1e` ports those original
single-input rules under TeamEdit, copies BaseButton/default break-spaces
markup, and respects the shell's existing hidden flag. Final target **8/8**,
26.018seconds,0skipped/flaky, including actual visible loaded images with
complete/naturalWidth checks. Mobile-dark Vue/native Add action rect
235.25/819.5625/129.75/40 and delete rect320/673.5625/37/40 match exactly;
font/whitespace/padding also match. Raw screenshot/geometry/failures remain
external. Pointer-dependent hover color is not certified by those captures.

Read-only review confirmed official RC2 Region removal restores replaced hosts
before Lit rerender, cleans children/subscriptions/tooltips and guards late
avatars. Search-result avatars, disabled/loading/multiple/open-result variants
remain explicit open work. These are available coverage, not access blockers.

## Frozen 480-case milestone result

Runtime source `4ce73ad1ea7a49978b7b8d8f1f5a2d8dd3f37ffa`, frontend
`3804ca6eb8602aa486528f294b4a6b4fdaf4c316`. Final units **753/753 across83files**,
19.36seconds, exit0; TypeScript/ESLint/Stylelint exit0. Source/dependency audit
finds zero Vue imports/SFCs/runtime/dependency/lock/tooling matches and retains
83test files. Both development and production graphs814modules/zeroVue;
all five runtime packages exact5.0.0-rc.2. Fresh480-case browser aggregate completed **477/480**,0skipped/flaky,
1405.398seconds. The three failures match the preserved Vue observations:
bot re-enablebackend412 and mobile task-detail bottom navigation from list/
Kanban. This aggregate belongs to that frozen source, before subsequent
settings/sharing appearance fixes. It is not transferred to later runtime pins.


## Settings, sharing and menu source fidelity follow-up

Common paired journeys use the same isolated supported backend and fixtures
against immutable Vue and native production builds at1440/390×light/dark.
General covers search/clear, section geometry,503 save/error/draft, edited
retry, persisted user and reload. Sharing covers search controls, real link
create, table headings, permissions, creator, card/action geometry and mobile
Close. A corrected initial comparison passed all8Vue cases and failed all8
native cases; preserved screenshots/JSON document the missing source styling.

Source-backed fixes restore single-input Multiselect styles, section/clear
spacing, Card content wrappers, source title weight/font, conditional member
wrapper overflow/margins, footer padding, BaseButton/icon markup, link table
headings, bold creator and permission icons. General failures use the existing
error notification rather than inserting a58px alert above its card; abort,
controller, live-view, identity and transition guards remain. Upcoming uses
original registered regularcalendar-days icon. The menu's accessible names
use original misc.hideMenu/misc.showMenu keys, replacing untranslated keys.
No new Application, transport or rendering framework was introduced.

The intermediate geometry run at185859756 passed16/16 but still had native
sharing card40px too tall and centered20px higher. Preserved evidence led to
restoring Card.vue's card-content.loader-container.p-0 wrapper (24px generic
content margin) and conditional overflow wrapper (16px empty paragraph margin
collapse). Commita6598bb35 passed **16/16**,77.960seconds; sampled sharing
input wrappers, header and footer rectangles/fonts match in all24width/theme/
state comparison groups, with source/backend link requests checked. This is
sampled geometry, not whole-route pixel or accessibility certification.
General sampled checkbox/input positions align; original native full inner
input width remains as described below. Focused settings/sharing checks at
185859756 passed **39/39**,97.526seconds; final menu-label/runtime checks and
untraced20-sample three-build benchmark are pending at this entry.

Preserved intermediate runs: appearance-before8/16; appearance-after16/16;
scope-before4/16 (four Vue General failures were a harness icon alias, not a
Vue defect; four Vue Sharing cases passed); scope-after12/16; scope-final16/16;
spacing-final16/16; structure-final16/16. Initial protocol observation1pass/
1fail/14skipped exposed Vue's optimistic save-store behavior. Assertions were
corrected to canonical calendar-days and the common edited-retry journey;
original reports/test sources remain available. No failures were deleted.

Intentional approved differences: retain the useful native full-width inner
General search input (outer384.5px both, inner382.5native/191.25Vue); do not
recreate Vue's accidental inherited50% clipping. Native failed-save drafts can
retry immediately; Vue requires a further edit after optimistic store update.
The common journey revises the draft so both original behaviors are exercised.
Native semantic h2 titles retain source body font and visual weight.

Evidence: /workspace/vikunja-evidence/continued-coverage-20261006/ plus named
settings-sharing-* archives/logs, capture-index.json, paired geometry summaries
and sampled-geometry-comparison.json. Read-only source review found no new
write/ownership blocker and confirmed structural diagnoses. External provider/
licensed-backend/OS-IME blockers remain distinct from available unperformed
search-result, loading/disabled, member-populated and other route variants.
All59route families remain partial, zero fully certified.


## Modal notifications: preserved failure and owned fix

The same sharing screenshots exposed a native success toast behind the
showModal dialog. Strengthened common hit-test/trial-pointer assertion
passed8Vue/4nativeGeneral cases and failed all4nativeSharing cases: **12/16**,
85.386seconds. ShellView now retains its same cached notice host/UI/Region,
places it inside the focused modal while the notice is present, follows
focus into nested dialogs, and restores/rebases it when the dialog closes.
Existing close-before-destroy contracts support queued-close restoration.
Replacement/dismiss/undo/expiry/owner destruction remove listeners/timer;
a bridge identity guards stale callbacks. No extra Application/modal registry
or MutationObserver framework was added. Read-only review found no blocker.
Public share-shell notification variants remain unperformed available work.

First AFTER **12/16**,105.604seconds, had all8native cases passing and four
Vue close-persistence failures: direct-loaded Share returns to the earlier
login document, losing its toast through full navigation. The common journey
now opens Share from the live project menu and retains hit-test, trial click,
Cancel/persist/dismiss assertions. Final **16/16**, all widths/themes, zero
skipped/flaky; duration/source pins remain in modal-notice-final/report.json.
Types/lint pass onefb37d5d5, four inherited Axios warnings. Full753units/83files
pass22.26seconds; fresh development/production graphs814modules/zeroVue, five
exactRC2 packages. The full480-case milestone will be rerun because this
changes global Shell notice placement; no success claimed before completion.

Final benchmark heap storage may use BENCHMARK_HEAP_COMPRESSION=gzip. This
is lossless synchronous storage after captured GC/counters and outside timed
interactions; uncompressed SHA256/byte size are recorded and decompressed
bytes verified after the run. It avoids needing another~960MB raw heap files
on the bounded32GB filesystem. All20samples and failures remain retained;
no heavy parallel work during measurement. Disposable compiler scratch/cache
cleanup is logged separately; it did not reclaim physical space here.


## Final frozen runtime verification and matched performance

Verification source dd53a27e72cd529fe3fb944404362de54cb70ddd; frontend
297071a8099e9ac56484c9e7e76a651ef59f9cfa (runtime efb37d5d5).
Final common modal pair **16/16**,89.240seconds; full frozen aggregate
**477/480**,1414.635seconds,0skipped/flaky. Failure set exactly matches
the preserved baseline, with no new failures. The completed run and traces
are archived as aggregate-release; gate comparison explicitly does not mean
all480pass. No runtime changes occurred during aggregate or benchmark.

Fresh matched Vue/published/current n20 benchmark **2/2**,1839.832seconds,
0skipped/flaky, all measured samples retained and API errors0 in all6partitions.
Current/published first-task medians1016.92/1250.56ms (50tasks),
979.41/1270.58ms (500tasks):18.68%/22.92% lower. Search425.25/551.44ms and
408.78/542.06ms:22.88%/24.59% lower. Cold-ready medians527.9/591.65ms and
503.2/553.8ms. Earlier measured first-task/search slowdown is addressed;
no universal speed or complete-parity claim follows. See complete p95,
CPU, heap/DOM, API, transfer and bundle evidence in
rc2-final-measurements-20261007.md. 50-task Kanban/edit-discard tail and
script-duration differences are retained, not averaged away.

Twelve heap snapshots losslessly retain1,025,144,418uncompressed bytes in
162,000,194gzip bytes; all12decompressed SHA256/sizes verified against capture
metadata. Invalid Kanban CPU deltas across document-navigation resets remain
raw and are labelled unavailable. Snapshot/GC observations are bounded-run
evidence, not leak attribution. Source/dependency/build audit stays Vue-free.

Available further work includes populated/search/loading/disabled sharing
variants, public share-shell notifications, notice queue/duplicate semantics,
more route/theme/device/accessibility cases and cold-offline entry probes.
Actual external/license/host/OS blockers remain as previously listed.
All59route families remain partial, zero fully certified.
