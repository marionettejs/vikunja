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
