# Architecture and Rendering/Data Foundation

The About integration and editable reference pass local unit checks. The About
integration also passes its supplemental browser checks. The editable reference
runs in happy-dom and does not establish real-browser parity for editing.

This document records the approved rendering/data stack and its intended ownership boundaries.

## Foundation Stack

- **Core Library**: `marionette@5.0.0-beta.2`
- **Data & State Layer**: `@mnjs/data@5.0.0-beta.2` (dependency-light observable `Model` and ordered `Collection`)
- **DOM Content Rendering**: `lit-html@3.3.3` via `@mnjs/adapters@5.0.0-beta.2` (`@mnjs/adapters/dom/lit-html`)

## Public Adapter Configuration

The application configures its own subclass layer under `frontend/src/marionette/index.ts` rather than mutating global runtime exports:

```ts
import {CollectionView as BaseCollectionView, View as BaseView} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {DataApi, StateApi} from '@mnjs/data'

export const View = BaseView.extend()
View.setDataApi(DataApi)
View.setStateApi(StateApi)
View.setDomApi(LitDomApi)

export const CollectionView = BaseCollectionView.extend()
CollectionView.setDataApi(DataApi)
CollectionView.setStateApi(StateApi)
```

- **`DataApi`**: Handles observable model reading, collection serialization, and ordered collection diff/move tracking. Configured on both `View` and `CollectionView`.
- **`StateApi`**: Manages view state subscription lifecycle and cleanup. Configured on both `View` and `CollectionView`.
- **`LitDomApi`**: Overlays `setContents(el, value)` to apply `lit-html` templates incrementally while retaining the View's root element (`el`). Configured specifically on `View`. It does not replace query operations or event delegation.

## Paths and Code Boundaries

- **Application Integration**: `frontend/src/marionette/index.ts` exports configured `View` and `CollectionView` base classes.
- **Production View**: `frontend/src/marionette/views/AboutVersionView.ts` converts the About version display to `lit-html` while preserving its required `lines: string[]` options contract, snapshot API, CSS classes (`p-4`), and paragraph structure.
- **Editable View**: `frontend/src/marionette/views/TaskTitleView.ts` owns native contenteditable text with `template: false`. Initialization sets its text directly because this mode suppresses render callbacks. Keeping template markers out of the editable root preserves browser selection semantics. `Heading.vue` owns its borrowed projection Model and saves through the existing task store.
- **Executable Reference**: `frontend/src/marionette/reference.test.ts` provides a test-only reference demonstrating multi-consumer coordination, draft input preservation, collection reordering, and region cleanup.
- **Acceptance and Docs**: `migration/README.md` and `migration/architecture.md`.

## Coexistence and State Writer Boundary

The migration unit is a complete screen or coherent route workflow. Marionette
owns its layout, child Views, editing, state coordination and teardown. The
remaining Vue router/shell may mount that screen through one narrow temporary
boundary. Do not add per-field or per-component hosts, model projections or
callback bridges, or embed Vue widgets inside a screen claimed as migrated.

The About integration and PR #5 title bridge are initial experiments, not patterns
to repeat. PR #5 is held from automatic merge as a component-level integration;
its reusable title View and acceptance tests inform the complete task-detail
screen. Remove each experimental bridge when its containing screen migrates,
and remove the route host when Marionette owns the router/shell.

For each shared entity/cache, choose exactly one canonical state writer. Reuse
existing service/domain code only after tracing its imports: several current
model and service modules transitively depend on Vue. Extract neutral behavior
without duplicating stores. If shared state requires extensive synchronization,
move its ownership as a unit or enlarge the cutover boundary. Native data models
provide observable state, not implicit HTTP synchronization.

Prepare services, layouts, child Views and acceptance in reviewable PRs or commits
without activating partial screens. Activate the complete replacement together
and remove its obsolete Vue path. Temporary preparation remains explicitly
incomplete; do not add permanent fallback routes or dual implementations.
Preserve rich text, permissions, licensed features, translations, route history
and all original test contracts. A difficult feature expands the work required;
it does not justify a reduced replacement.

The migration unit is a complete screen, with one temporary router/shell mount.
Do not introduce per-field projections, callback bridges or nested Vue widgets.
If shared state requires extensive synchronization, move its ownership as a unit
or enlarge the cutover boundary. Direct service calls alone do not replace the
existing task store's Kanban/Gantt updates, auth identity invalidation or realtime
behavior. Prepare neutral dependencies separately, then activate the full screen
and remove its obsolete Vue path together.

The task-model import graph is now independent of Vue runtime modules:

- `helpers/avatarCache.ts` owns the existing Vue avatar cache, version signal and
  deferred blob-URL revocation. UI consumers import it directly; `models/user.ts`
  contains model/display-name behavior and no compatibility reexports.
- `i18n/locales.ts` contains locale metadata and browser-language selection with
  no imports. `i18n/index.ts` retains Vue translation setup and live switching.
- `models/userSettings.ts` imports `PrefixMode` from its defining module, avoiding
  the quick-add barrel's parser, authentication and UI dependencies.

A standalone browser bundle of `models/task.ts` with tree-shaking disabled has
24 inputs and no Vue, Pinia, router or single-file component inputs. This establishes
the model entrypoint's dependency boundary, not framework neutrality of services
or migration of the application. The source trace and bundle metadata are local
diagnostic evidence; no inspection code enters production imports.

## Task persistence and shared workspace ownership

`helpers/taskPayload.ts` contains the existing task-to-API conversion, including
nested tasks and emoji reaction keys. `TaskService` delegates conversion while
retaining request handling, bulk batching and cache invalidation. The discarded
attachment-conversion loop is removed: it constructed an HTTP service but ignored
its returned objects. Baseline comparisons preserve actual attachment payloads.

The next ownership boundary must account for the project workspace. Task detail
can overlay a still-mounted project view; task-store saves update Kanban bucket
placement and the last-updated task observed by Gantt. Task-link pills separately
observe cache invalidation and authentication-identity versions. A replacement
must preserve those consumers under one canonical owner, without dual stores or
per-widget synchronization bridges.

Current production websocket subscribers handle notifications and timers; source
inspection did not find generic task-update propagation. Do not assume a realtime
task synchronization contract exists. This extraction does not introduce a state
owner, replace websocket subscriptions or activate a Marionette screen.

## Kanban transition preparation

`helpers/kanbanTransitions.ts` contains the existing bucket lookup, task replacement,
addition, removal and completion-driven placement algorithms. The current Kanban
store calls these functions with its owned bucket array and current view; it still
owns loading, pagination and reactive state. Task saves and Gantt observers retain
their existing coordination. No native store or screen is activated.

These functions mutate supplied state. Extraction preserves task `bucketId` changes,
bucket counts, prepend order and existing array/object identity behavior. Missing
loaded targets leave tasks visible, and reopening a completed task uses the view's
default bucket or first bucket. A bundle with tree-shaking disabled has two inputs
(the helper and shared utilities), with no Vue or services.

## Attachment Monitoring and Region Ownership

The title experiment required stable factory identity across replacement task
objects. This is recorded interoperability cost; it does not justify adding
similar projection machinery to each field. Within Marionette screens, stable
layout ownership and model updates must preserve editable child identity.

- Marionette manages element attachment and lifecycle through `Region` instances and `monitorViewEvents`.
- Keep attachment monitoring enabled on the View and its ancestors, and leave
  Region placeholders empty so Lit and a child View never own the same contents.
- `LitDomApi` integrates with Marionette attachment hooks: `Dom.notifyAttach(el)` and `Dom.notifyDetach(el)` propagate to Lit's directive connection lifecycle.
- **Region Ownership**: Region-owning layouts must remain stable. Marionette's parent view rendering destroys child views in regions before re-rendering parent template contents; incremental rendering does not preserve Region child views across parent renders.

## Safe Text vs. Rich HTML

- Lit templates automatically escape text interpolations in element content (`<p>${line}</p>`), treating strings containing characters such as `<` or `>` as literals.
- Preserve Vikunja's existing DOMPurify and rich-editor sanitization for user-authored
  HTML. A Lit HTML directive does not sanitize its input; do not treat the choice
  of rendering library as a replacement for that protection.

## Purpose of the Executable Reference

The list/detail reference in `frontend/src/marionette/reference.test.ts` is intended to exercise adapter mechanics (multi-borrower models, child view move preservation, draft isolation, region disposal). It is **not** an actual migrated task workflow or UI feature, and it remains outside production imports.

Codex supplied the stack choice, ownership boundaries and detailed repair prompts;
Antigravity Gemini Flash Low implemented the reference, and Codex corrected its
TypeScript annotations and reviewed cleanup. That assistance is part of the
case-study record, not evidence of unaided agent performance.

## Foundation validation, 2026-09-10

- `pnpm --dir frontend test:unit --run`: 115 files and 1,585 tests passed.
- `pnpm --dir frontend lint:fix`: no errors and 15 existing warnings. The repository
  configuration excludes test files from lint.
- `pnpm --dir frontend typecheck`: still fails with the same 820 distinct baseline
  diagnostic lines and no new diagnostics; this is not a clean typecheck.
- `VIKUNJA_E2E_SKIP_BUILD=true mage test:e2e '--config=../migration/acceptance/playwright.config.mts'`:
  frontend build and both About browser checks passed.
- All 101 frozen original Playwright test, support and configuration hashes
  remained unchanged. The original full browser suite is deferred to PR CI.
