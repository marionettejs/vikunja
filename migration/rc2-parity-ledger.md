# Acceptance ledger

This ledger preserves the published `5a4e611e4` baseline evidence. For the local optimization, see [current remaining gaps](rc2-remaining-parity-gaps.md) and [matched results](rc2-optimization-results.md).

The published baseline frontend tree is `a7d6970ef57cec104f6b56a5c0d2d09d33ff3474`. Frozen Vue baseline is `5d22d730aa35b0666d0849099c12a1e638baabc9`. All 59 original route declarations remain partial; no whole-app certification is claimed.

| Check | Result | Boundary |
| --- | --- | --- |
| Unit tests | 686/686, 73 files | Frontend behavior covered by these tests only |
| Aggregate isolated-backend acceptance | 477/480, 24.1 minutes | Three failures retained; zero skips/flaky results |
| Production probes | 13/15, 45.4 seconds | Two cold-offline document failures retained |
| Focused logo/reader/appearance checks | Native 11/11; Vue 8/11 | Six logo and two visual cases pass both; two password-draft and reader-control behaviors differ |
| Type/style checks | Pass | Lint zero errors, four inherited warnings |
| Development/production build | 811 modules each | No Vue in source/import/dependency/lock/tooling audit or build graph; all five runtime packages exact RC2 |

## Preserved failures and unverified behavior

- Bot re-enable returns HTTP 412 in the supported isolated backend and frozen Vue. The assertion remains.
- Two 390-pixel mobile bottom-marker assertions fail in native and frozen Vue. The assertions remain.
- Cold-offline `/login` and root document loads fail with the generated Workbox precache in both versions; live-offline behavior is a separate passing check.
- Repeated synthetic Playwright `fill` previously diverged intermittently in native; the latest two aggregates pass, but the cause is not established. Keyboard/paste/Chromium composition checks pass; operating-system IME remains unverified.
- Full appearance parity is incomplete. Unmasked paired captures still show task-action icon/typography and capture-scroll differences.
- Licensed admin/time tracking require a license-enabled isolated backend. Electron requires its actual host. External mail/providers and all accessibility/device combinations remain unverified.
- Independent results-host destruction and Workspace adapter cohesion remain architecture gates; see [ownership review](rc2-architecture-review.md).

## Bounded fixes and validation

List rows now receive sortable drag ownership only from project-list. Kanban cards retain the bucket-owned creation footer as the final scroll-list item after sorting/paging; original sticky footer and task-list height rules are restored. Native scope classes, original button/header classes, overview favorite geometry and assignee styling were corrected using the frozen upstream design.

LogoView restores the original SVG, dark styling, custom light/dark URL fallback, backend/user seasonal opt-outs and hourly June switch. Logo Regions retain existing children across catalog/route publications and dispose observers/timers on destruction. The seasonal fixture explicitly enables the backend icon-change option; failed initial runs remain preserved.

The read-only webhook journey uses a fresh browser context and public reader login, checks identity before/after the deep link, asserts absent Create/Delete controls and verifies the actual API returns 403. It does not alter backend permissions. The native UI hides an unauthorized Create control that frozen Vue exposes; Vue also clears two sibling password drafts that native retains. These are explicit deviations, not concealed parity claims.

Tests preserve loading/error/cancel behavior, stale route/request protection, draft/focus retention, dialog cleanup, authentication refresh and service-worker races. Original/reference tests and new app-independent journeys remain in the repository. Intermediate failures and successful runs are distinct evidence; no assertions were weakened or deleted to report a pass.

## Full-suite fixture setup

From the repository root, run `node migration/acceptance/oidc-provider.mjs` in a separate terminal. It uses disposable keys and synthetic identities on loopback port 18765. In a disposable test checkout, link `config.yml` to `migration/acceptance/oidc.fixture.yml` (do not overwrite an existing configuration). Run:

```sh
VIKUNJA_SERVICE_ENABLEPUBLICTEAMS=true \
VIKUNJA_OUTGOINGREQUESTS_ALLOWNONROUTABLEIPS=true \
mage test:e2e '--config=../migration/acceptance/playwright.config.ts'
```

Mage builds the backend and starts an isolated SQLite test database. Stop the owned provider and remove the temporary configuration link afterward. Archive each report/results directory before another run. Production probes need the production Mage adapter in `audit/production-mage.sh`; normal Mage builds development assets. No test runs against production accounts or data.
