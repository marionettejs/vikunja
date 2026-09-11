# Marionette migration record

This is an experimental migration of Vikunja's full frontend to published
`marionette@5.0.0-beta.2`. The baseline is
[`go-vikunja/vikunja` at `5d22d730aa35b0666d0849099c12a1e638baabc9`](https://github.com/go-vikunja/vikunja/tree/5d22d730aa35b0666d0849099c12a1e638baabc9).
The application still uses Vue for its shell, routing and existing features. The
About dialog's version-content block now uses a Marionette View hosted by a
Marionette Region. The surrounding modal, card, buttons and navigation remain Vue;
this is the first partial integration, not a completed feature migration. See
[Architecture and Foundation](./architecture.md) for the configured stack and adapter contracts.

## Completion criteria

The completed frontend must have no Vue runtime, Vue-dependent wrappers, or Vue
build tooling in its dependencies or production bundle. Existing application
behavior, accessibility, translations, permissions, licensed features, API and
data contracts must be preserved. Framework-neutral libraries may remain.

The original Playwright specs, support code, fixtures, configuration and assertions
are frozen. Passing tests through an unmigrated Vue feature is baseline evidence,
not proof that Marionette implements it. Each feature's implementation owner and
verification status will be tracked as migration proceeds.

Features without adequate automated coverage still require explicit acceptance
evidence. This includes relevant PWA, desktop integration, localization and
accessibility behavior. Missing coverage does not remove a feature from scope.
Any proposed scope reduction needs a maintainer decision.

## Screen migration policy

Migrate complete screens or coherent route workflows. Keep temporary Vue
coexistence at the router/shell boundary; Marionette owns the migrated screen's
layout, child Views, editing, state coordination and teardown. Avoid per-component
hosts, projected models, callback bridges and nested Vue widgets. Prepare reusable
services and Views in reviewable pieces, then activate the complete screen and
remove its obsolete Vue implementation. The next target is task detail with all
existing rich-text, permission, licensed and navigation behavior preserved.

PR #5's title bridge is held unmerged as an interoperability experiment. Its
standalone View and acceptance evidence can be reused without adopting the bridge.
Record interoperability effort separately from Marionette application development.

## Domain-model preparation

`TaskModel` and its model imports can be bundled for the browser without loading
Vue, Pinia, the router or Vue components, including with tree-shaking disabled.
Avatar cache behavior lives in a separate UI helper, while locale metadata and
browser-language selection live outside the Vue translation runtime. Importing
the quick-add setting directly also avoids loading the parser and auth store.

This is preparation for complete-screen ownership. The avatar helper still uses
Vue, and task services/stores, live translations, shared caches and realtime still
need ownership work. No route has switched implementations in this preparation.
Gemini Flash Low performed the two extractions; Codex verified preserved behavior
and corrected the remaining quick-add import discovered by dependency tracing.

## Task-payload preparation

`helpers/taskPayload.ts` now provides the existing task serialization without
loading Vue, HTTP services or stores. `TaskService.processModel` delegates to it;
request dispatch, cache invalidation and state ownership remain with their current
owners. The helper preserves existing payload behavior, including reminder-object
mutation. It is not a pure, immutable serializer.

Gemini Flash Low produced the extraction in one bounded run (40,904 input and
3,281 output tokens reported; 12.43 seconds wrapper elapsed). Codex materialized
the output, corrected date-to-wire TypeScript annotations after validation found
nine distinct new diagnostics, and verified the result. This is assisted work,
not evidence of unaided model performance or a migrated screen.

Local validation: 20 existing task-service tests and the full 1,585-test unit suite
passed. Eight additional baseline comparisons matched both output and input effects,
including nested tasks, reminders, attachments and emoji reactions. Four unchanged
original task browser cases passed through Mage, including description autosave on
navigation; the frontend build passed. A browser bundle with tree-shaking disabled
had seven inputs and no Vue or service imports. Typechecking still fails with 816
distinct diagnostic lines versus 820 at baseline and no new location-normalized
diagnostic counts. Lint reported zero errors and 15 existing warnings. All 101
frozen browser-test/support/configuration hashes remained unchanged; the full
original browser suite remains a PR CI check.

## Kanban transition preparation

The existing Kanban store now delegates bucket-task algorithms to a neutral helper.
This prepares reusable workspace behavior while keeping one active state owner;
it does not migrate the board or task-detail screen.

Gemini Flash Low produced the helper and store delegates (20,548 input and 2,082
output tokens reported). Codex corrected guessed type-import paths and removed
an added guard that changed behavior. The supplied source bundle had accidentally
truncated one function; this coordinator error contributed incomplete context and
is recorded separately from agent performance. Codex also authored five additional
public-store cases for done/undone placement, default-bucket fallback, missing view
and missing loaded target.

The existing full suite passed 1,585 tests before those five cases were added;
the expanded focused task/Kanban suites then passed 26 tests. Twelve baseline
comparisons matched values, mutations and retained identities. Typechecking still
has 816 distinct diagnostic lines: two existing diagnostics moved from the store
to the helper. This is preserved baseline debt, not a clean typecheck. No original
browser tests were modified. The Mage frontend build passed; 19 of 20 original
Kanban browser cases passed, including drag, recurring-task relocation and deletion.
The settings-count case failed after its settings helper requested double-slash
URLs that returned 404. `magefile.go` supplies `API_URL` with a trailing slash;
`frontend/tests/support/updateUserSettings.ts` appends `/user` and
`/user/settings/general`, producing `/api/v1//user` and
`/api/v1//user/settings/general`. Both requests returned 404 in the full and
isolated local runs, so the setting was never enabled. The original Vue baseline
also exhibited this local harness defect. No frozen helper was modified to hide it.
All six original browser-test shards passed in PR CI at `1ed836e07`, where the
workflow does not supply Mage's `API_URL` override.

## Native record preparation

`marionette/data/TaskRecords.ts` owns one native `@mnjs/data` Model per persisted
task ID. It is not instantiated by any application route. Future native list and
detail consumers can borrow the same record through multiple Collections while
keeping drafts and view-specific membership/order separate.

Inputs must already be normalized patches that preserve which fields were supplied.
Omitted fields retain their values; explicit null/undefined and nested references
follow native Model semantics. This owner does not parse HTTP responses, fill defaults,
deep-clone values or serialize requests. Borrowers must not mutate records or nested
values, change their IDs or destroy them. The owner destroys removed records and all
remaining records at teardown; subsequent writes are rejected. Borrower Collections
remain caller-owned.

Before activation, transport must preserve response-field presence and detach request
inputs where serialization mutates reminders. Passing parsed tasks through the old
`TaskModel` constructor is not a cloning operation: a verified one-hour recurrence
became `minutes: NaN` on reparsing. No partial native screen or parallel Vue store is
activated by this preparation.

Gemini Flash Low produced the owner and seven tests. Codex corrected named type
imports and invalid date/attachment fixtures, removed unnecessary casts, and
strengthened explicit-undefined and multi-record teardown assertions. The full
suite passed 1,597 tests across 116 files; lint had zero errors and 15 existing
warnings. Typechecking retains 816 baseline diagnostics with none added. Browser
flows were not rerun because this module has no application consumer yet; these
results prove its tested data contracts, not a migrated user workflow.

## First integration and acceptance

The temporary Vue host owns one Region and replaces its child when the supplied
view factory changes. About computes translated plain text before creating the
Marionette View; version and locale changes replace that snapshot. The host exists
because Vue still owns the active application shell and routes. Remove it when
Marionette owns all routes and shared UI and no Vue consumers remain.

Colocated unit tests cover attachment, replacement, cleanup, literal text and
actual About version/locale updates. Additional browser checks exercise the About
menu entry, displayed versions, and footer/Escape back-navigation. They import the
original fixtures without modifying the frozen suite. With the normal local
prerequisites from AGENTS.md, run them through Mage:

```sh
mage test:e2e '--config=../migration/acceptance/playwright.config.mts'
```

These checks cover the current About and task-title integrations; they do not establish full-app
migration parity or coverage of every previously untested feature.

## Screen migration policy

Migrate complete screens or coherent route workflows. Keep temporary Vue
coexistence at the router/shell boundary, with Marionette owning everything
inside the migrated screen. Avoid per-component hosts, state projections and
callback bridges. Prepare reusable services and Views in reviewable pieces,
then activate the complete screen and remove its obsolete Vue implementation.
The next target is the complete task-detail screen, including its rich editor
and existing interactions. See [ownership boundaries](./architecture.md#coexistence-and-state-writer-boundary).

## Task-title experiment (PR #5, unmerged)

The component-level integration is held from automatic merge following the
decision to reduce interoperability. Its View and acceptance tests remain useful
for the full screen; its Vue bridge is not the template for future migration work.

In this experiment, Marionette owns the task title's contenteditable heading, keyboard/blur/input
handling, draft retention and unsaved-navigation listener. A native data Model
projects the current title, write permission and translated label. The temporary
Vue Heading still owns surrounding controls, translations and the canonical task
store save request; this does not complete the task-detail feature migration.

The editor stays mounted when an updated task object has the same ID. This matters
when a save response arrives while the next draft is being typed: the response
must not replace the heading, draft, focus or selection. Changing task ID replaces
the editor. Unmounting releases the Region/View and its subscriptions, then the
projection Model; late saves cannot update the removed heading's UI.

Validation includes 19 focused unit/integration tests and six supplemental
browser cases covering desktop/mobile save-and-reload, Escape/empty input,
failed-save retry, a delayed save response during a newer draft, and read-only
shares. Locale changes, permission revocation, task replacement and teardown are
covered by integration tests. Composition-key guards use synthetic events;
physical IME input and screen-reader interaction have not been manually verified.

This was an assisted agent result. Gemini Flash Low needed corrections for
`template: false` initialization, native Model/instance typing, Region detach
ownership, test mocks, asynchronous cleanup and factory identity. Codex supplied
the relevant public contracts, repaired remaining issues and authored browser
acceptance. JSON-only code output with mechanical file materialization avoided
the CLI's earlier file-tool permission failures. These outcomes are case-study
observations, not a controlled cost or model-quality comparison.

## Agent development case study

Gemini and Claude implement bounded tasks through Antigravity CLI. Codex
coordinates, prepares the environment and independently reviews and verifies
results. Bounded Spark CLI support reviews are recorded separately from Antigravity
implementation. This is a supervised case study, not a controlled ranking of models or
frameworks, and it does not imply that every change received human review.

Records distinguish the requested and actual model, documentation revision,
prompt, initial result, validation, repair attempts, elapsed time, reported token
usage and coordinator or human interventions. Documentation gaps and supplemental
guidance are recorded separately from tool failures, quota interruptions and
application defects. Unknown measurements remain unknown.

Record Vue interoperability work separately from Marionette application work.
Bridge complexity and coordinator corrections must not be presented as the
effort required to build a standalone Marionette screen. Evaluate the complete
screen after cutover against the frozen tests and supplemental acceptance.

Working plans and raw run files live in the ignored `plans/` directory. Reviewed
summaries belong in this directory and PR descriptions. Public records must omit
account identifiers, credentials and private configuration. Raw local logs are
not automatically suitable for publication.

## Fork automation

The fork retains the upstream test workflow and dependency review. Its CI runs
for pull requests, merge groups, main updates and manual requests. Inherited
release, preview publication and upstream-specific integration workflows are
removed. No deployment or package publication is part of this migration workflow.
