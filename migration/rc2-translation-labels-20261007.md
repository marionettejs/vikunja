# Six visible translation references — 2026-10-07 follow-up

Runtime commit `d9823e439d93cd47f10978f7cba05c2a37104f34`; frontend tree `c2b439e84fcfdd7864ab7189015c239b014b472a`. Parent published main `5fca3cbdc45a1b5c3d1d2f4fb6efef84226384fd`. Nine runtime files, nine insertions/ten deletions; existing locale assets and CSS unchanged.

| Visible context | Invalid reference | Existing replacement / upstream behavior |
| --- | --- | --- |
| Kanban completed task | task.done | task.attributes.done → Done |
| View filter bucket removal | project.kanban.deleteBucket | project.kanban.deleteHeaderBucket → Delete the bucket |
| Task move project input | input.projectSearch.placeholder | project.search → Type to search for a project… |
| Malformed duplicate response / null avatar canvas | misc.error | error.error → Error |
| Admin, import status, time entries retries | misc.retry | sharing.retry → Retry |
| Attachment clipboard success | misc.copied | Remove the extra notice; original Vue useCopyToClipboard succeeds silently |

The clipboard operation remains intact. No request/ownership/lifetime/CSS/workflow/backend changes. Independent read-only review found no blocker for this bounded patch. Admin/time browser coverage uses explicit frontend contracts; it does not verify a licensed backend or install a license.

## Verification

- Frontend lint passed (four inherited warnings); typecheck passed; 775/775 unit cases across 88 files in 20.09 seconds.
- Source audit passed with zero Vue. Existing Marionette and four @mnjs runtime dependencies remain exact5.0.0-rc.2.
- Focused Mage/browser suite: **14/16 passed, two failed**, zero skipped/flaky, 55.409 seconds. Both1440×900 and390×900. All six reference fixes are exercised in rendered UI; attachment copy also passes against the immutable original Vue production build at both widths. Actual isolated backend attachment upload/clipboard URL assertions remain intact.
- Two retained failures: admin overview Retry remains visible after successful retry at both widths. Both overview/users source load paths predate this patch and fail to hide Retry on recovery. Additional users/time cases assert translated labels, HTTP200 recovery and hidden error; time retry hides. Admin users Retry persistence is an additional source-backed open finding. This patch does not fix either admin behavior or declare the entire suite successful.
- First run10/14 remains archived with its failures: avatar test initially looked for a global notification instead of its actual inline alert; mobile upload was intercepted by the visible install banner. The second run12/16 preserved two additional test-fixture failures: generic time-entry rejection was consumed by the shell timer request. The third run targets the entries-list request (per_page250), preserving the error/recovery assertions. Second/third runs use the inline Error alert and closes that banner through its ordinary button. No force clicks, removed assertions or changed failure outcomes; original admin recovery assertion is retained.

Evidence: `/workspace/vikunja-evidence/translation-labels-20261007/` (inputs, lint/types/units/audit, immutable first/second/third reports, traces, screenshots and test source). Reproduce using the pinned Vue production build and isolated Mage runner:

```sh
bash migration/audit/production-mage.sh '--config=../migration/acceptance/translation-labels.config.ts'
```

## Measurement provenance and case-study readiness

The published benchmark measures source `3581ed1a672a1c56df8bf78ca2b56dca14e3c67b`, frontend `50662d98588496fcc100d19b9b0412a84ed9ab05`, against pinned Vue upstream5d22/frontend7c157 and older published native5a4e. **Benchmarks were not rerun for this new c2b439 frontend.** The earlier24 paired surface,40 notice and477/480 aggregate results also describe the earlier frontend50662; current evidence above is separate.

A transparent public engineering case study can describe the architecture, bounded parity evidence and measured performance with these revision pins and limits. A100%-parity or production replacement claim is not supported: all59 route families remain partial, zero fully certified; known bot/mobile rich-task and admin recovery visibility defects remain; licensed backend, external delivery/provider, Electron and OS/device IME verification remain incomplete. Single-host n20 timings and bounded forced-GC retention are disclosed measurement limits, not universal performance or leak claims. The500-task dataset initially renders50 rows/cards. Some measurements regress versus older native. Inherited GitHub CI remediation remains stopped by user instruction; no workflows, tags, releases or deployments are part of this follow-up. No case study is written or published here.
