# RC2 ownership and feature organization

The runtime contract comes from Marionette `5.0.0-rc.2`, source `f4243b8334cafe0bd1b06eba85d87e2310cb3618`, with version-matched installed documentation. The official [Records frame example](https://github.com/marionettejs/marionette/tree/f4243b8334cafe0bd1b06eba85d87e2310cb3618/examples/records) retains a PageView, hosts its RecordsApplication through the content Region, and uses explicit start/restart/stop. Public [RealWorld source](https://github.com/marionettejs/marionette-realworld-example-app/tree/34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04) informs feature co-location and explicit readiness/lifetimes. Applications coordinate readiness and effects, Regions own Views, Views own interactions/drafts, and transport/cancellation are explicit.

| Owner | Lifetime and responsibility | Source |
| --- | --- | --- |
| VikunjaApplication | Root connection, session transitions, route dispatch, boot/errors | `frontend/src/app/application.ts` |
| SessionApplication | Config, identity, authentication refresh, profile publication | `frontend/src/app/session.ts` |
| WorkspaceApplication | Authenticated destination authority, catalog/cache, feature ports | `frontend/src/app/workspace.ts` |
| ShellApplication | Persistent navigation, search, notifications and timer lifetimes | `frontend/src/app/shell-application.ts` |
| ProjectApplication | Project/view readiness, retained task modal and results workflow | `frontend/src/features/projects/application.ts` |
| TaskApplication | Fetch/cancel readiness, task record and action lifetime | `frontend/src/features/task/application.ts` |
| Feature workflows | Authentication, sharing, settings, imports, organization and other routed domains | `frontend/src/features/` |
| Reusable Views | Editor/filter/task-list interaction and local drafts; no route authority | `frontend/src/shared/` |

Feature Applications, Views, data adapters, styles and tests are co-located. The organization change relocated 155 existing files and 444 resolved imports without adding Applications; the tree retains 28 Application declarations. Models/services/generated client/assets/styles remain neutral. Shared editor/filter/list Views are reused across actual home/project/task flows rather than becoming a new abstraction layer.

Vikunja's authenticated workspace and shell persist across project routes and stop on identity change. This follows the product's lifetime rather than copying the smaller example application's routing policy. Regions dispose their Views; Application teardown explicitly cancels requests and stops child workflows. TaskApplication performs readiness in `prepareStart` with the lifecycle signal and commits its View in `onStart`. Task field Views retain drafts, focus and editor state; TaskActionsApplication owns coordinated writes with a separate cancellation lifetime. Single-record View-local saves remain local where appropriate.

## Remaining review gates

Workspace remains 1038 lines and assembles task/editor/comment transport adapters alongside route and catalog authority. Moving those adapters into their feature owners is a bounded cohesion improvement; it must preserve one navigation authority and current cancellation/focus behavior. File size and Application count are evidence, not targets.

ProjectListResultsApplication and GanttResultsApplication are nonvisual request owners that publish pending/loading/results through callbacks into their parent View. RC2 permits this, but independent host destruction is not verified by owner-stop tests. `Region.empty()` destroys the displayed View without stopping its Application. Normal route replacement and cancellation are tested; arbitrary host loss needs a targeted acceptance check before claiming this split is fully verified.

Large admin/time-tracking/task-timing modules and residual icon/typography/mobile scroll differences remain review gates. No extra framework, feature or visual polish is introduced to resolve those gaps.
