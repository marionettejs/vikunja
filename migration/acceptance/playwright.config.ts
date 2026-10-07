import {resolve} from 'node:path'
import base from '../../frontend/playwright.config'
export default {
	...base,
	testDir: import.meta.dirname,
	testMatch: ['logo-parity.spec.ts','focus-parity.spec.ts','visual-review.spec.ts','input-publication.spec.ts','offline-ui.spec.ts','bootstrap.spec.ts','sidebar-task-drag.spec.ts','editor-input-contract.spec.ts','shortcut-scroll.spec.ts','task-bucket.spec.ts','pwa-controls.spec.ts','task-reactions.spec.ts','frame-visual.spec.ts','search-lifetimes.spec.ts','search-location-sidebar.spec.ts','task-actions.spec.ts','notifications.spec.ts','api-config.spec.ts','visual-parity.spec.ts','editor-cursor.spec.ts','admin-time.spec.ts','openid.spec.ts','import-oauth.spec.ts','avatar-system.spec.ts','account-admin.spec.ts','account-security.spec.ts','background-upcoming.spec.ts','project-duplicate.spec.ts','saved-filters.spec.ts','project-views.spec.ts','task-completeness.spec.ts','task-relations.spec.ts','organization.spec.ts', 'project-sharing-management.spec.ts', 'project-management.spec.ts', 'settings-controls.spec.ts', 'settings.spec.ts', 'account-entry.spec.ts', 'sharing-access.spec.ts', 'project-gantt.spec.ts', 'authentication.spec.ts', 'kanban.spec.ts', 'native-routes.spec.ts', 'project-table.spec.ts', 'task-heading.spec.ts', 'shell.spec.ts', 'project-list.spec.ts', 'list-ui.spec.ts', 'filter-ui.spec.ts', 'task-select.spec.ts', 'task-dates.spec.ts', 'task-membership.spec.ts', 'task-editor.spec.ts', 'task-comments.spec.ts'],
	outputDir: resolve(import.meta.dirname, 'results'),
	reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'report.json')}]],
	use: {...base.use, locale: 'en-US', timezoneId: 'UTC', trace: 'on', viewport: {width: 1440, height: 900}},
}
