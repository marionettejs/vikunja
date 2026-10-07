# Scoped native recovery and presentation fixes — October 7

Current validated source `3efa6ffe6a194fe09e411554bdd4998fa6f02145`; frontend `e820902d675fb296ad925ac357c69872ace99fd1`. Admin runtime `a3b04099786e07b57a28e31853e3aca720097c7f`; fade runtime `96d0b8957311825e527603176cdbd2280bb1ba6e`. Base public main `5a4bb2d8d281c2bac81b08d8fffe4b7bd90c30dd`. No backend, dependency, CSS, workflow, credential or settings changes. Framework inputs remain exact Marionette/@mnjs5.0.0-rc.2, official Records/app-frame f4243b83 and RealWorld34ceaa; ownership stays with existing Applications/Regions/Views.

## Corrections and ownership

- Admin overview and the shared users/projects directory clear stale Retry at the next request start. Loading/error/retry now follow existing TimeEntries behavior: hidden Retry while pending; show it on failure; leave it hidden after success. Search/page state, request revision/cancellation guards, rows and permissions unchanged.
- Notification rows no longer introduce nested assertive alerts under the existing polite status owner. This matches pinned Vue Notification.vue. Inline error alerts remain. DOM parity is verified; real screen-reader announcement equivalence is not claimed.
- Native notification entry/exit opacity now follows source speed300ms/ease. The3600ms original expiry deadline remains; removal finishes after the300ms leave. Native DOM animations are held on the existing Entry, with cancellation promises consumed and callbacks cleared before owner teardown. No extra Application or animation framework. Active rows count toward dedup/max2; departing DOM stays inside its existing modal host until completion, like Vue TransitionGroup. This verifies opacity/duration, not every TransitionGroup move trajectory.
- Undo checks active membership before invoking its callback, retaining native single-use behavior throughout leave, expiry and eviction. A real backend double-click sends exactly one accepted reversal at both widths. Later draft retention, accepted-write idempotence, reader permission controls and existing route/dialog cancellation improvements remain.

## Verification and exact pins

| Acceptance | Evidence |
| --- | --- |
| Admin recovery/loading/keyboard retry/repeated failure |6/6native cases: overview/users/projects at1440/390. Explicit frontend feature/transport contracts, not a valid licensed backend. |
| Notification polite owner markup |4/4Vue/native cases, success and controlled503error at both widths. |
| Opacity entry/click exit/automatic expiry |8/8Vue/native cases at both widths; actual accepted task writes, frame opacity samples and300ms animation timing. |
| Single-use Undo |2/2native double-click journeys, actual backend payload/state;3new owner units cover depart/republication, destroy/cancel and repeat/expired/evicted handlers. |
| Earlier six reference fixes |16/16current cases, including paired silent clipboard success. Unmasked time-list rejection now targets per_page250 rather than the shell timer; original outcome assertions retained/strengthened. |
| Queue/modal/session regression |40/40paired cases across both widths/light+dark, same fixtures/backend. |
| Mobile comment marker observation |4/4paired cases; original large wheel passes the marker, one ordinary upward wheel reaches it in Vue and native. Original failure assertions retained separately. |
| Retained original scroll cases |2/4: desktop passes; both390assertions still fail. No upstream behavior or assertions changed to obtain green aggregates. |

Final browser run **82/84**, 441.457s, zero skipped/flaky; exact two inherited390marker failures above. Browser source `96d0b8957311825e527603176cdbd2280bb1ba6e`, frontend `e313c4eabdf1a976dbb5fb2c32a7063b5724e9eb`; pinned immutable Vue frontend7c15706/upstream5d22 and327verified production assets. Current `3efa6ffe6a194fe09e411554bdd4998fa6f02145` differs only in three unit-test animation completion/type adapters. **All shipped frontend sources, backend, lock/dependencies and build inputs are byte-identical to the browser-tested runtime.** The final full units run on current source passed **778/778 across88files**,23.41s. Typecheck and lint passed (four inherited warnings); development/production graphs817modules each, zeroVue; source/installed/lock/tooling auditzeroVue; five runtime packages exact5.0.0-rc.2.

Independent read-only review found and required the departing-Undo guard; its before test fails, corrected test passes. Review then found no further concrete blocker. First full unit run774/778 and type-adapter error logs remain preserved; final outcomes are reported separately. Existing owner unit assertions remain after explicitly finishing DOM animations; no expected messages, counts, teardown outcomes or original failed assertions were deleted.

Evidence `/workspace/vikunja-evidence/ui-recovery-20261007/`: before4/14, first-after14/18(two banner test-adapter errors preserved), pre-fade milestone72/74, fade-before4/8(Vue4pass/native4fail), before/after owner units and final84report/traces/frame samples/screenshots. Test-source snapshots accompany stages. All browser runs use Mage-owned isolated SQLite/API and no production data.

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend test:unit --run
bash migration/audit/production-mage.sh '--config=../migration/acceptance/ui-recovery-final.config.ts'
```

Use the Cloud cache/Go/Mage and fixture prerequisites from prior notes, pinned Vue production build for paired projects. The last command intentionally retains two known failures. No work ran on Paul's Mac; actual executor commands continued despite disconnect callbacks.

## Inherited outcomes versus remaining limits

Confirmed failures shared with Vue are left unchanged by Paul's explicit instruction: backend bot re-enable412, the two mobile marker assertions, and historical cold-offline document probes. New paired marker geometry clarifies the latter assertions: source/native markers sit12–16px above the viewport after the20000wheel because task actions follow them on mobile; a−400wheel reaches y384–388. This is shared overscroll/test-expectation behavior, not an unreachable native section. Older bot/API failures are not frontend permission fixes and no backend changes are authorized. Full aggregate477/480 evidence remains pinned to its old source; it was not rerun here.

These are separate from unavailable valid-licensed admin/time backend, external delivery/providers, Electron host and OS/device IME verification. Broader available route/device/accessibility variants remain partial, not a list of demonstrated bugs. All59route families remain partial/zero fully certified. Native menu return-focus behavior and retained drafts/idempotence/reader controls are intentional improvements; no upstream loss or failing behavior is copied. No unrelated CI remediation, deployment, tag/release/npm or security changes.

Published performance tables still measure source3581ed1a/frontend50662d98588496fcc100d19b9b0412a84ed9ab05. **No benchmarks were rerun for either UI follow-up.** Same original single-host n20 caveats, initial50rendered rows/cards in both dataset sizes, and slower measurements versus older native remain. A case study may present this bounded evidence with pins/limits; it cannot turn sampled verification into100%certification. No case study is written here.
