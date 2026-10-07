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

Workspace cohesion was assessed at1103lines: it assembles existing feature ports while retaining one identity/navigation/catalog authority. No broad extraction is justified by line count. A concrete late comment-sort identity publication race was fixed with the existing request signal plus initiating user/transition checks,21focused tests passing. File size and Application count remain evidence, not targets.

ProjectListResultsApplication and ProjectGanttResultsApplication are nonvisual request owners that publish pending/loading/results through callbacks into their parent View. RC2 `Application` documentation explicitly states that `Region.empty()` releases displayed content without stopping its Application. A focused real-owner check reproduced six failures: independently destroying the root View, emptying its Region, or destroying its Region left the pending transport signal live; late loading callbacks then dereferenced the released root.

ProjectApplication now observes its selected root's `before:destroy` event and stops its two existing results children. Region ownership and the Application hierarchy are unchanged. `application-host-lifetime.test.ts` uses real ProjectApplication, table/Gantt root Views and Region, with only transport mocked; it verifies synchronous abort, false readiness and silent late results/errors after host loss, plus intact normal publication and retained restart replacement. These ten checks and seven existing project/results readiness checks pass (17/17). This bounded detached-DOM ownership check does not certify every connected browser host, unrelated feature callback or Workspace adapter cohesion.

Large admin/time-tracking/task-timing modules and residual icon/typography/mobile scroll differences remain review gates. No extra framework, feature or visual polish is introduced to resolve those gaps.

Gantt host destruction now cancels surface-owned create/position writes and closes task-record sessions using the same cleanup used by normal ProjectApplication stop. Seven RED cases and27GREEN controls cover independent destroy/Region empty/Region destroy, late acceptance/rejection and normal restarted writes. This is a concrete host-lifetime fix, not a new Application layer.

The editor View guards both installed BubbleMenu delayed predicates with its existing aborted lifetime before any DOM/editor access. A real-plugin delayed callback reproduction failed before the guard;16focused cases include live menu publication and destroyed-host suppression. Edit focus uses the installed public Tiptap command matching Vue, preserving library scheduling instead of owning another timer. Browser writer evidence and bounded followup are recorded in the parity fixes.

Task routes preserve navigation context independently of loaded task ownership, as the original Vue store does. Shell exposes its existing NavigationView project state for task-route quick creation; it adds no state owner or Application. Task header/background/move behavior still uses the loaded task project. Real-owner tests and paired supported-backend creation validate this distinction. Webhook tooltip interaction remains row-owned, disposed by its Region; framework-neutral licensed vendor CSS reproduces appearance without a Vue wrapper/runtime.
