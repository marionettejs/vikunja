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

These checks cover the current About integration; they do not establish full-app
migration parity or coverage of every previously untested feature.

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

Working plans and raw run files live in the ignored `plans/` directory. Reviewed
summaries belong in this directory and PR descriptions. Public records must omit
account identifiers, credentials and private configuration. Raw local logs are
not automatically suitable for publication.

## Fork automation

The fork retains the upstream test workflow and dependency review. Its CI runs
for pull requests, merge groups, main updates and manual requests. Inherited
release, preview publication and upstream-specific integration workflows are
removed. No deployment or package publication is part of this migration workflow.
