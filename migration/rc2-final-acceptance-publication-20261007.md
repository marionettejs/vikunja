# Final six-surface acceptance and publication integration — 2026-10-07

## Frozen tested input

Source `8de771eabc538ecfec8aef4fd44bebaf26458d82`; frontend tree `50662d98588496fcc100d19b9b0412a84ed9ab05`; runtime commit `9fe99f7ae8d12ffe4a1038569996061cc09d8578`. Vue reference frontend remains upstream `5d22d730aa35b0666d0849099c12a1e638baabc9`. Marionette and all relevant @mnjs packages are exactly 5.0.0-rc.2; official source f4243b8334cafe0bd1b06eba85d87e2310cb3618 and Records app-frame example, RealWorld 34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04. No source reference repository was modified.

## Changes and verification

A paired isolated-backend journey covers project list, task title/editor drafts, Kanban, search, General settings and project sharing at 1440/390 widths in light/dark themes. Source-backed fixes restore theme-specific desktop Close contrast, the translated My Name placeholder, and inactive project-view link color. Existing mobile header Close color, active/hover colors and View-owned drafts remain. No new Application, transport or lifecycle machinery was introduced.

- Final paired run: 24/24, 146.277 seconds, zero skipped/flaky.
- Forty-eight matched screenshot pairs with unmasked raw pixel differences, explicit dimensions and geometry/focus attachments. This has no pixel-parity threshold and is not whole-app appearance certification.
- Notice regression: 40/40, 220.827 seconds, zero skipped/flaky.
- Units: 775/775 across 88 files, 18.73 seconds. Retained nonfatal inherited socket stderr.
- Source/lockfile/installed-package audits: zero Vue runtime dependencies/imports/SFCs. Development and production graphs: 817 modules each, zero Vue; exact RC2 packages verified.
- Frontend lint, typecheck and styles passed; four inherited lint warnings remain. Theme-only follow-up style check passed. Acceptance files outside the frontend ESLint base were ignored by that command; browser assertions are their verification.

Independent read-only review sampled the six surfaces across themes/devices and the final Close/placeholder fixes; no material blocker in sampled captures. Minor comment/composer spacing and later General section offsets remain. Wider Default Project/Timezone inner inputs and draft preservation are intentional recorded deviations. Native search names its close button “Close quick actions”; Vue uses “Close dialog”. Search-return focus was recorded as TEXTAREA in both desktop themes, not generalized into a restoration guarantee. Screen-reader announcement equivalence is unverified.

Two intermediate 20/24 runs are retained: incorrect light-theme color and accessible-name expectations, then direct-child selectors that failed on both applications' wrappers. Final assertions use the same visible physical control and actual Vue theme colors; no failed evidence was deleted.

## Evidence and reproduction

Cloud workspace `/workspace/vikunja-migration`; evidence root `/workspace/vikunja-evidence/final-acceptance-20261007/`. `after/paired`, `after/captures`, `after/side-by-side`, `after/pixel-comparison-metrics.json` and `after/test-source` retain exact artifacts. `bounded-verification` contains pins, unit logs, source/build audits, 40 paired notices and completion marker.

From repository root, with local development configuration and Mage toolchain available:

```sh
pnpm --dir frontend exec vitest run --dir src
node migration/audit/vue-free-source.mjs /tmp/final-source-audit.json
node migration/audit/vue-free-build.mjs /tmp/final-build-audit
bash migration/audit/production-mage.sh '--config=../migration/acceptance/final-acceptance-paired.config.ts'
bash migration/audit/production-mage.sh '--config=../migration/acceptance/notice-regression-paired.config.ts'
```

Paired configs require the immutable Vue production path/hashes described in their checked-in configuration. Mage owns isolated SQLite backend and browser lifecycle; fixture accounts only. Use the supported-device paired configuration's environment requirements. No production account/data was used.

## Publication integration

Remote main e7d7f173e40627eb35c913752507ba61c2b895d8 is 653 commits beyond the pinned baseline. Read-only merge preview reports 337 conflicts. Newer work changes authorization, session/TOTP revocation, search scoping, generated API clients and query modules, invite/MCP/v2 endpoints, translations and UI behavior. v1 remains registered and supported for existing clients; these changes do not prove wholesale protocol incompatibility.

Publication will use the tested pinned migration, without integrating the 653 newer commits. The fork owner explicitly chose replacement of fork main. Before any replacement, preserve current main on an explicit verified backup branch. Use a clean public commit/tree and a guarded update that checks the exact expected old main SHA; preserve upstream attribution, licenses and history. Branch protection must be respected. No release, package publication or deployment is included. The separate unfinished integration worktree remains preserved and is outside this publication scope.

The previous full 477/480 aggregate and matched n20 benchmark belong to afcac46a / frontend eea122d0, documented in rc2-undo-milestone-measurements-20261007.md. They are historical after this styling change and must not be attributed to this frontend or a future integrated main. Fresh frozen-source validation has now completed on `3581ed1a672a1c56df8bf78ca2b56dca14e3c67b`, frontend `50662d98588496fcc100d19b9b0412a84ed9ab05`. See the final verification below. All 59 route families remain partial; licensed backend, external providers/delivery, Electron and OS IME require actual hosts/access. Broader available variants remain work.

## First integration checkpoint

Separate worktree `/workspace/integrate-current-main-20261007`, branch `integrate-current-main-20261007`, is in an unfinished merge against the pinned remote main. Both regular and rename-disabled merges had 336 actual conflicts. Disabling heuristic renames prevents modified Vue files being misidentified as native SCSS/TS replacements. The first resolution preserves main's four conflicting workflows and retains 74 migration model/modelType/service files as temporary supported-v1 compatibility inputs. There are 258 unresolved conflicts. No integration commit was made and no checks certify this merged worktree. Newer backend files are retained, with no model/route/license edits. The exact resolution lists are retained in `integration-first-resolution.json` under the evidence root.

The newer-main integration is paused and outside the selected publication scope. No further edits to that worktree are required. Final aggregate and matched three-build n20 measurements ran on the frozen pinned source after the UI fixes. Measured source/frontend and publication tree pins must be reported explicitly; full-route, provider and accessibility certification remain incomplete.

## Final frozen-source verification

Measured source `3581ed1a672a1c56df8bf78ca2b56dca14e3c67b`; frontend tree `50662d98588496fcc100d19b9b0412a84ed9ab05`; runtime `9fe99f7ae8d12ffe4a1038569996061cc09d8578`. Publication follow-up changes are documentation/evidence only; frontend, backend, Go/build inputs and acceptance source must remain byte-identical to this measured source. Public history uses a clean snapshot commit with sole parent old main `e7d7f173e40627eb35c913752507ba61c2b895d8`, excluding local migration-only ancestry. Verify the backup and exact old-SHA guard before moving main; no force or protection bypass is needed.

- Fresh units775/775 across88files,18.86s; notices40/40,221.759s; exactRC2 and development/production817-module zeroVue audits.
- Aggregate477/480,1333.379s; zero skipped/flaky, exact3preserved failures, no new failures. No failed assertion was weakened or removed.
- Matched3build n20:2/2,1921.428s;216summarydistributions eachn20;50/500task datasets and30SPAcycles. All6APIpartitions have zero errors/unavailable bodies.
- All12raw heaps (163255860losslessgzipbytes) verified by decompressed size/SHA. This is bounded retention evidence, not leak certification.
- Served build202nonmapfiles:5681485raw/1962473deterministicgzipbytes. Initial inferred staticJS/CSS7files:709791raw/182338gzipbytes; this is separate from measured route transfer.

Full results, slower observations, raw profiles, protocol and limits are in [the final measurement report](rc2-publication-measurements-20261007.md) and `benchmark/results-2026-10-07-publication/`. The24paired six-surface comparison is pinned to8de771eab with the same frontend tree;48unmasked screenshot pairs have no pass threshold. Historical failed harness runs and larger raw evidence remain in Cloud. All59route families remain partial, zero fully certified. Actual licensed backend, external delivery/providers, Electron and OS IME access remain blockers to those acceptance areas; broader available variants remain work.

## Publication gate — current result

The frozen source validation and matched benchmark completed. Automatic approval review rejected creating `backup/upstream-main-before-rc2-20261007` twice: it treats the original no-public-push delegation as controlling and could not accept later authorization relayed by the parent as direct user approval. No public branch was created, main was not updated, and no workaround was attempted. Current remote main remains `e7d7f173e40627eb35c913752507ba61c2b895d8`. A clean local snapshot with that sole parent is ready for review; publication still requires a verified backup followed by the exact-old-SHA guarded, non-force main update. No release, deployment, npm publish or repository setting change is part of this operation.
