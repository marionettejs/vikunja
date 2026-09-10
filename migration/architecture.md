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

During coexistence between Vue and Marionette:
- **Single State Writer Rule**: For any shared domain entity or query cache, exactly one system acts as the source of truth and state writer at any given time.
- **Service Persistence Boundary**: Domain persistence and API communication remain coordinated through existing API client services. `@mnjs/data` models and collections manage observable in-memory state and event dispatch; they do not perform implicit HTTP synchronization or database mutations.

## Attachment Monitoring and Region Ownership

Factory identity must follow the entity ID, not the identity of a replaceable
task object. Heading derives a primitive computed task ID before deriving its
factory; title, locale and permission updates change the projection in place.

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
