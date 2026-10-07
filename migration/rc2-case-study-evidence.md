# Local RC2 migration evidence and decisions

This is a review checkpoint, not full Vikunja parity certification. Workspace `/workspace/vikunja-migration`, branch `optimization/rc2-lazy-features-20261006`. Final measured source `29d4c7d5578f358cccfefbf8f83e2a3fe95fd24c`, frontend `ff801880f173369332a614445c28f0a2a7391a81`; subsequent notes retain that frontend. Public branches, saved Marionette source repositories and production accounts remain unchanged.

## Inputs and ownership

Frozen original Vue is upstream `5d22d730aa35b0666d0849099c12a1e638baabc9`, frontend `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`;327 immutable production assets hash-verified by paired runners. All five Marionette runtime packages are exactly5.0.0-rc.2, source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`. Official Records frame and RealWorld `34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04` inform ownership; see [architecture](rc2-architecture-review.md). Applications coordinate readiness/effects; Regions own Views; Views retain interaction/drafts. Existing owners receive bounded fixes where actual failing evidence demands them.

The persistent authenticated Workspace/Shell differs from smaller examples because Vikunja retains sidebar/search/task-modal context across feature routes. Results owners explicitly stop when independently destroyed host Views lose their Region. Lazy modules use existing cancellation/readiness authority, rather than adding an Application per component. Framework-neutral models/services/generated client/assets/styles are reused. Licensed tooltip CSS preserves original vendor attribution without retaining the Vue runtime.

## Verification and concrete defects

| Evidence | Result and boundary |
| --- | --- |
| Current full unit suite |745/745 across82files, exit0; TypeScript, ESLint and Stylelint exit0. Four inherited Axios warnings remain.|
| Current source and both bundle graphs |No direct/installed/lock/import/tooling Vue matches; no Vue modules among814 modules in either development or production graph. Exact RC2 installed and manifest pins checked.|
| Task-action geometry/appearance/print |8/8 paired1440/390×light/dark;19buttons' sampled icon/font/layout/print fields match. Time-tracking advertisement is a frontend fixture, not a valid licensed backend.|
| Heading/sidebar/tooltip residual checks |16/16; original heading icon cascade, task-route persistent navigation and row-owned hover/cleanup verified.|
| Quick creation and tooltip anchor geometry |12/12; real supported backend task/project payload/storage/redirects match. Desktop/mobile avatar and tooltip rectangles/styles exactly equal.|
| Representative unchanged journeys |Native33/33, Vue31/33. Original Vue late deletion navigation and background shortcut publication failures preserved as explicit guarded deviations.|
| Editor focus critical writer |Actual installed ProseMirror20ms timer identified from failing trace; public Tiptap focus command aligns scheduling with Vue. After native20/20, Vue19/20 mobile fill trials plus12 keyboard/paste/Chromium composition cases; bounded race evidence only.|
| Admin/time frontend contracts |Native12/12, Vue10/12; duplicate accepted admin PATCH after partial rejection retained as Vue failure. Actual licensed backend remains unavailable.|

Original failed assertions/logs/traces remain external. Harness corrections preserve outcomes, including original generic tooltip selector, keyup search, one-task PUT versus native supported bulk POST and original nested project creation redirect. A proposed redirect suppression based on an incomplete component read was rejected and never merged. Assertions were not weakened or removed.

Known reviewed deviations preserve newer password drafts after accepted export/deletion cancellation, avoid duplicate accepted partial admin writes, hide reader webhook writes denied by the backend, and suppress stale navigation/unrelated keyboard writes behind dialogs. These are explicit decisions under draft/focus/cleanup requirements, not identical Vue behavior.

## Reproduction and raw evidence

All browser journeys run through the checked-in [Mage E2E skill](../.agents/skills/run-e2e-tests/SKILL.md), with an isolated SQLite backend, synthetic fixtures and one browser runner. Save logs and archive results before reuse. Prepared Cloud variables and serial final commands are in `/workspace/vikunja-evidence/final-quality-20261006/{post-review/verify.sh,final-benchmark.sh}`. Paired focused config is `migration/acceptance/final-context-paired.config.ts`; full native matrix is `migration/acceptance/playwright.config.ts`; production/auth/service-worker probes use `production-probes.config.ts`. Raw causal and paired evidence is under `/workspace/vikunja-evidence/webhook-selection-fix-20261006/`; current unit/type/style/build audits under `/workspace/vikunja-evidence/final-quality-20261006/`.

All59 original route declarations remain implemented/partial, zero fully certified. Full device/accessibility/visual/error combinations, real OS IME/Electron, external provider variants and supported licensed backend interactions remain open. Broad frozen matrix477/480 at frontend `5cf8d00238a925009746ce99cf958dafc033d137` before the final reviewer-found Gantt fix; final source745/745 units,15/15 Gantt browser checks and13/15 production probes. Fresh three-build measurements pass2/2 datasets with all20 samples/check and0 API errors, documenting cold-start gains and slower first task/search against earlier native; see [fresh measurements](rc2-final-measurements-20261006.md) and [independent correctness review](rc2-independent-review-20261006.md). Historical results remain explicitly pinned in [optimization results](rc2-optimization-results.md). No claim of overall completion follows from compiling, passing sampled journeys or Vue-free audits.
