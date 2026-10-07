import {resolve} from 'node:path'
import base from './playwright.config'
export default {
	...base,
	testDir: resolve(import.meta.dirname, '../..'),
	testMatch: ['**/frontend/tests/e2e/project/project-view-list.spec.ts', '**/frontend/tests/e2e/project/sort-persistence.spec.ts', '**/frontend/tests/e2e/project/filter-persistence.spec.ts', '**/frontend/tests/e2e/filters/filter-autocomplete.spec.ts', '**/frontend/tests/e2e/task/drag-to-project.spec.ts', '**/migration/acceptance/list-ui.spec.ts'],
}
