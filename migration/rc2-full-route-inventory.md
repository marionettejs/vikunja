# Full app route inventory

Pinned original router: `5d22d730aa35b0666d0849099c12a1e638baabc9`, extracted from `frontend/src/router/index.ts`. Route declarations include two catch-all entries, the admin container/children, legacy aliases and shared project/filter paths. Native routing has been checked against the migration entry; route existence is not proof of all feature/appearance parity.

**59 original route declarations: 59 partial, 0 unported, zero fully certified.** Current code also accepts `/projects/:projectId/0` to resolve a default view.

| Original route | Name | Native status |
| --- | --- | --- |
| `/` | `home` | Partial — saved-filter/label notices, empty/import/deletion warning and overview permissions verified |
| `/:pathMatch(.*)*` | `not-found` | Partial — deep-link/reload/404 title and nested path |
| `/:pathMatch(.*)` | `bad-not-found` | Partial — encoded-path/reload catch-all |
| `/login` | `user.login` | Partial — representative coverage; further variants unverified |
| `/get-password-reset` | `user.password-reset.request` | Partial — representative coverage; further variants unverified |
| `/password-reset` | `user.password-reset.reset` | Partial — representative coverage; further variants unverified |
| `/register` | `user.register` | Partial — representative coverage; further variants unverified |
| `/user/settings` | `user.settings` | Partial — representative coverage; further variants unverified |
| `/user/settings/avatar` | `user.settings.avatar` | Partial — actual local providers/upload/reload/error/draft/cancellation; external providers and crop visual variants open |
| `/user/settings/caldav` | `user.settings.caldav` | Partial — real backend journeys/error/cancellation checks; visual/paging variants open |
| `/user/settings/data-export` | `user.settings.data-export` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/user/settings/feeds` | `user.settings.feeds` | Partial — real backend journeys/error/cancellation checks; visual/paging variants open |
| `/user/settings/deletion` | `user.settings.deletion` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/user/settings/email-update` | `user.settings.email-update` | Partial — representative coverage; further variants unverified |
| `/user/settings/general` | `user.settings.general` | Partial — representative coverage; further variants unverified |
| `/user/settings/password-update` | `user.settings.password-update` | Partial — representative coverage; further variants unverified |
| `/user/settings/totp` | `user.settings.totp` | Partial — real backend journeys/error/cancellation checks; visual/paging variants open |
| `/user/settings/api-tokens` | `user.settings.apiTokens` | Partial — real backend journeys/error/cancellation checks; visual/paging variants open |
| `/user/settings/sessions` | `user.settings.sessions` | Partial — real backend journeys/error/cancellation checks; visual/paging variants open |
| `/user/settings/webhooks` | `user.settings.webhooks` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/user/settings/bots` | `user.settings.bots` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/user/settings/migrate` | `migrate.start` | Partial — chooser in original settings frame; controlled configured service links |
| `/migrate/csv` | `migrate.csv` | Partial — actual detect/preview/import/catalog/reload and focused mapping/error/cancellation checks; all mapping/visual variants open |
| `/migrate/:service` | `migrate.service` | Partial — actual TickTick import; credential refusal/status/reimport/teardown and original frame; external source variants open |
| `/user/export/download` | `user.export.download` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/share/:share/auth` | `link-share.auth` | Partial — representative coverage; further variants unverified |
| `/tasks/:id` | `task.detail` | Partial — attachments/reminders/repeat and priority/progress representative checks; editor regression and visual review open |
| `/tasks/by/upcoming` | `tasks.range` | Partial — ranges/presets/query flags/reload, completion, read-only denial, errors and cancellation; visual/calendar variants open |
| `/lists:pathMatch(.*)*` | `lists` | Partial — legacy path redirect preserves repeated query/hash and reload |
| `/projects` | `projects.index` | Partial — representative coverage; further variants unverified |
| `/projects/new` | `project.create` | Partial — representative coverage; further variants unverified |
| `/projects/:parentProjectId/new` | `project.createFromParent` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/settings/edit` | `project.settings.edit` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/settings/background` | `project.settings.background` | Partial — real upload/remove, brightness/private/public shell, local provider contract/cancel/retry; external provider and visual variants open |
| `/projects/:projectId/settings/duplicate` | `project.settings.duplicate` | Partial — native backend CRUD/cancellation/retry |
| `/projects/:projectId/settings/share` | `project.settings.share` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/settings/webhooks` | `project.settings.webhooks` | Partial — real backend and draft/cancellation evidence; bot re-enable backend failure retained |
| `/projects/:projectId/settings/delete` | `project.settings.delete` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/settings/archive` | `project.settings.archive` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/settings/views` | `project.settings.views` | Partial — native configuration CRUD/drafts/permissions and actual configured filter tasks; ordering persistence/error retry and saved-filter configuration verified; visual variants open, ordering and configuration variants unverified |
| `/projects/:projectId/settings/edit` | `filter.settings.edit` | Partial — native backend CRUD/cancellation/retry |
| `/projects/:projectId/settings/delete` | `filter.settings.delete` | Partial — native backend CRUD/cancellation/retry |
| `/projects/:projectId/info` | `project.info` | Partial — description dialog and safe rich links at both widths; pseudo-project/read-only/visual variants open |
| `/projects/:projectId` | `project.index` | Partial — representative coverage; further variants unverified |
| `/projects/:projectId/:viewId` | `project.view` | Partial — representative coverage; further variants unverified |
| `/teams` | `teams.index` | Partial — representative coverage; further variants unverified |
| `/teams/new` | `teams.create` | Partial — representative coverage; further variants unverified |
| `/teams/:id/edit` | `teams.edit` | Partial — representative coverage; further variants unverified |
| `/labels` | `labels.index` | Partial — representative coverage; further variants unverified |
| `/labels/new` | `labels.create` | Partial — representative coverage; further variants unverified |
| `/filters/new` | `filters.create` | Partial — native backend CRUD/cancellation/retry |
| `/auth/openid/:provider` | `openid.auth` | Partial — real isolated provider/login/TOTP/logout/deep-link and cancellation |
| `/oauth/authorize` | `oauth.authorize` | Partial — actual local PKCE callback/token identity/replay, rejection/teardown and copied anonymous login return; native app/provider variants open |
| `/about` | `about` | Partial — desktop/mobile, keyboard menu/Escape/footer/history/cleanup; appearance variants open |
| `/time-tracking` | `time-tracking` | Partial — native Views/Regions, real unlicensed denial and frontend contracts; licensed backend verification remains open |
| `/admin` | `(admin container)` | Partial — native Views/Regions, real unlicensed denial and frontend contracts; licensed backend verification remains open |
| `/admin` | `admin.overview` | Partial — native Views/Regions, real unlicensed denial and frontend contracts; licensed backend verification remains open |
| `/admin/users` | `admin.users` | Partial — native Views/Regions, real unlicensed denial and frontend contracts; licensed backend verification remains open |
| `/admin/projects` | `admin.projects` | Partial — native Views/Regions, real unlicensed denial and frontend contracts; licensed backend verification remains open |


## Certification boundary

All routes are partial. Representative backend journeys and assertions are retained in `acceptance/`; aggregate counts and remaining failures are in [the acceptance ledger](rc2-parity-ledger.md). Route recognition alone does not certify every interaction, permission, appearance, device or provider variant. Licensed admin/time tracking, Electron hosting, external mail/providers and operating-system IME remain unverified.
