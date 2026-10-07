# Focused original Vue comparison — 2026-10-06

The mobile webhook blank screen is confirmed as a Marionette regression against frozen original Vue. Comment replacement still fails intermittently with synthetic `fill()` in Marionette; Vue did not reproduce it in this bounded sample. No runtime fix was made, and no public push occurred.

## Pinned inputs and execution

- Original Vue upstream `5d22d730aa35b0666d0849099c12a1e638baabc9`; reference checkout `f1be3d4ec684665c5fe5e544a7c2e3150aa5e04a` retains exactly its frontend tree `7c15706aa02e31bd19448040c6b3f8c9da10ecc9`. Configuration verifies all327 immutable production assets against the original bundle manifest. The checkout's zero-byte dist placeholder is not served.
- Marionette report HEAD `1342edd8ac2f89075d0bae73bf58255f568eebf7`, frontend `a3a5f5e86c4f82e8b2e4bd4f3efedca4c54e816d`, unchanged from the loading benchmark. Exact5.0.0-rc.2 packages; canonical source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`.
- One Mage-owned supported backend, isolated SQLite fixtures, same authenticated user/project/task and browser. Chromium151.0.7922.173;1440/390×900, DPR1, en-US, UTC, light/dark webhook variants. One worker, zero retries. No production data.
- Run started17:38:08UTC,471.18seconds: **45/48 passed,3 failed,0 skipped/flaky**. Full480-case suite was not restarted. API/preview servers were torn down. Original unchanged comment assertions were reused.

| Cases | Vue | Marionette |
| --- | --- | --- |
| Comment replacement, five trials × fill/keyboard ×1440/390, twelve rounds/case |20/20 |19/20 |
| Webhook visibility ×1440/390 ×light/dark |4/4 |2/4 |

## Webhook diagnosis and supported fix recommendation

Both390px Marionette cases fail the original Target URL visibility and Create webhook control assertions. Frozen Vue passes all four cases. Every captured project/webhook/events response is200 in both apps. This is not a missing API response or authentication failure.

The retained `shared/editor/editor.scss:1410` mobile/print rule hides `#app` when a non-task modal is open. Vue's `components/misc/Modal.vue` teleports the dialog to body: on mobile, `#app` is hidden but the dialog remains390×900 outside it; Target URL is294×40. Marionette's Region owns the webhook dialog inside `#app`, so both dialog and input rectangles are zero. Existing project-sharing modal exceptions omit the generic `native-project-dialog` class.

A **temporary page-only diagnostic**, applied after preserving both failed assertions, used:

```css
body:has(#app dialog[open].native-project-dialog) #app {display:block!important}
```

This restored the390×900 dialog,310×40 Target URL, Create control visibility, focus, and exact keyboard entry in both themes. Both desktop cases also retained working controls. No webhook was created. Original failures remain failures; the diagnostic is not shipped source.

Recommend a scoped root-preserving override for Region-owned project dialogs in their existing modal stylesheet/exception rule. This fits the current Region ownership and needs no Teleport wrapper, new Application, or global framework. Review mobile and print behavior, close/focus return, and sibling project dialogs before accepting a runtime patch. The diagnosis establishes visibility, not full appearance parity: inspected paired captures show native centered labels/help text, different button/checkbox styling and padding; desktop Target URL widths558px native vs958px Vue. These remain visual gaps even after the diagnostic CSS.

## Comment selection investigation

Only Marionette mobile `fill()` trial2 failed, at accepted round4. Expected `Accepted replacement 4`; actual editable text `Accepted replacement 3Accepted replacement 4`. Immediately before insertion, the attached `beforeinput` event has `anchor=focus=22`, empty selected text, and previous text `Accepted replacement 3`. The preceding discard replacement selected the full22characters. The exact-content assertion stops before Save, preserving the error without publishing this bad value.

All twenty Vue cases pass, including five mobile fill trials; nineteen Marionette cases pass, including all ten keyboard replacement cases. This reproduces only in Marionette in the current matched sample. It does not establish that Vue can never fail, or that normal human typing/IME corrupts saved comments. Classification remains **unresolved synthetic-input/editor-selection interaction**, rather than a resolved harness fault or proven general human-input defect. Keep the failing fill assertion and independent keyboard control.

Native edit entry already uses synchronous `editor.view.focus()`; Vue uses Tiptap `commands.focus()`. An assumed delayed-focus fix is unsupported. DOM timelines prove selection collapse but do not identify the writer or editor transaction causing it. Recommend targeted editor/model/selection tracing before a runtime change; no causal editor patch is justified by this run alone.

## Evidence and reproduction

Workspace `/workspace/vikunja-migration`; raw saved log `/workspace/vikunja-evidence/vue-observations-20261006/paired.log`; archived JSON report, traces, screenshots, input events and before/after geometry under `/workspace/vikunja-evidence/vue-observations-20261006/paired`. Vue/native mobile screenshots are retained without masking. This evidence supplements, rather than changes, the earlier aggregate477/480 and loading benchmark.

```bash
cd /workspace/vikunja-migration
export MAGEFILE_CACHE=/tmp/vikunja-mage-cache GOCACHE=/tmp/vikunja-gocache GOPATH=/tmp/vikunja-gopath
export XDG_DATA_HOME=/tmp/vikunja-xdg XDG_CACHE_HOME=/tmp/vikunja-cache
export PATH=/tmp/vikunja-go127/go/bin:/tmp/vikunja-gopath/bin:$PATH
export VIKUNJA_E2E_SKIP_BUILD=true VIKUNJA_E2E_FRONTEND_PORT=18768
export VIKUNJA_SERVICE_ENABLEPUBLICTEAMS=true VIKUNJA_OUTGOINGREQUESTS_ALLOWNONROUTABLEIPS=true
bash migration/audit/production-mage.sh '--config=../migration/acceptance/vue-observation-parity.config.ts' > /tmp/vue-observation-parity.log 2>&1
```

Requires the pinned immutable Vue build and installed tools at the recorded paths. The adapter invokes Mage, which owns backend fixtures and teardown. Expected exit is failure while the three preserved parity assertions remain unresolved.
