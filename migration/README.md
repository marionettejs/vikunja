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
