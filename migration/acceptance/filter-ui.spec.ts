import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {LabelFactory} from '../../frontend/tests/factories/labels'
import {LabelTaskFactory} from '../../frontend/tests/factories/label_task'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

async function openFilter(page) {
	await page.getByRole('button', {name: 'Filters', exact: true}).click()
	await expect(page.locator('.filter-input .ProseMirror')).toBeFocused()
	return page.locator('.filter-input .ProseMirror')
}

test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'Filter checkpoint'})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: index => index === 1 ? 'Alpha task' : 'Beta task', due_date: '2040-06-17T12:00:00Z'})
	await LabelFactory.create(3, {title: index => ['Release One', 'Release Two', 'Blocked'][index - 1], hex_color: 'eedd00', description: ''})
	await LabelTaskFactory.create(1)
	await Factory.seed('task_positions', [{task_id: 1, project_view_id: 1, position: 65536}, {task_id: 2, project_view_id: 1, position: 131072}])
})

test('filter cancel, simple search, reset and reload preserve list entry draft and focus', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Unsubmitted task')
	let editor = await openFilter(page)
	await editor.fill('Beta')
	await page.keyboard.press('Escape')
	await expect(page.locator('dialog[open]')).toHaveCount(1)
	await page.getByRole('button', {name: 'Close dialog', exact: true}).focus()
	await page.keyboard.press('Escape')
	await expect(page.locator('dialog[open]')).toHaveCount(0)
	await expect(page.getByRole('button', {name: 'Filters', exact: true})).toBeFocused()
	await expect(page).toHaveURL(/\/projects\/1\/1$/)
	await expect(entry).toHaveValue('Unsubmitted task')
	editor = await openFilter(page)
	await expect(editor).toHaveText('')
	await editor.fill('Alpha')
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect(page).toHaveURL(/s=Alpha/)
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task'])
	await expect(entry).toHaveValue('Unsubmitted task')
	await page.reload()
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task'])
	await openFilter(page)
	await page.getByRole('button', {name: 'Clear Filters', exact: true}).click()
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task', 'Beta task'])
	await expect(page).not.toHaveURL(/[?&](s|filter)=/)
})

test('label autocomplete keyboard selection replaces only the last multi-value token', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill('labels in Release One, R')
	const popup = page.locator('#filter-autocomplete-popup')
	await expect(popup).toBeVisible()
	await expect(popup.getByRole('button')).toHaveCount(2)
	await editor.press('ArrowDown')
	await editor.press('Enter')
	await expect(editor).toHaveText('labels in Release One, Release Two')
	await expect(popup).toBeHidden()
	await expect(editor).toBeFocused()
	const response = page.waitForResponse(value => /\/projects\/1\/views\/1\/tasks/.test(value.url()) && value.request().method() === 'GET')
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	const result = await response
	expect(result.ok()).toBe(true)
	await info.attach('multi-value-filter-request', {body: result.url(), contentType: 'text/plain'})
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task'])
	await openFilter(page)
	await expect(editor).toHaveText('labels in Release One, Release Two')
})

test('project-scoped user suggestions retain editor focus and backend username shape', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill('assignees = migr')
	const popup = page.locator('#filter-autocomplete-popup')
	await expect(popup).toBeVisible()
	await popup.getByRole('button', {name: 'migration-reviewer', exact: true}).click()
	await expect(editor).toHaveText('assignees = migration-reviewer')
	await expect(editor).toBeFocused()
	const response = page.waitForResponse(value => /\/projects\/1\/views\/1\/tasks/.test(value.url()) && value.request().method() === 'GET')
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	const result = await response
	expect(result.ok()).toBe(true)
	expect(new URL(result.url()).searchParams.get('filter')).toBe('assignees = migration-reviewer')
	await info.attach('user-filter-request', {body: result.url(), contentType: 'text/plain'})
})

test('quoted expressions, highlighting and full help preserve apply semantics', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill("labels = 'Release One' && done = false")
	await expect(editor.locator('.field')).toHaveCount(2)
	await page.getByRole('button', {name: 'How does this work?', exact: true}).click()
	await expect(page.locator('.filter-popup .expandable')).toContainText('percentDone')
	await expect(page.locator('.filter-popup .expandable')).toContainText('createdBy')
	await expect(page.locator('.filter-popup .expandable')).toContainText('not in')
	await page.screenshot({path: info.outputPath('filter-help.png'), animations: 'disabled'})
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task'])
	await expect(page).toHaveURL(/filter=/)
})

test('date-math tokens open presets and nested help, then apply the selected value', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill("dueDate < 'now'")
	await editor.locator('.date-value').click()
	await expect(page.locator('.datepicker-with-range')).toBeVisible()
	await page.screenshot({path: info.outputPath('date-popup.png'), animations: 'disabled'})
	await page.locator('.selections').getByRole('button', {name: 'In 7 days', exact: true}).click()
	await expect(editor).toHaveText("dueDate < 'now+7d'")
	await page.getByRole('button', {name: 'Check out how it works', exact: true}).click()
	await expect(page.locator('dialog[open]')).toHaveCount(2)
	await expect(page.locator('.how-it-works-modal')).toContainText('now+24h')
	await page.keyboard.press('Escape')
	await expect(page.locator('dialog[open]')).toHaveCount(1)
	await page.keyboard.press('Escape')
	await expect(page.locator('.datepicker-with-range')).toBeHidden()
	await page.screenshot({path: info.outputPath('date-filter.png'), animations: 'disabled'})
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect(page).toHaveURL(/filter=/)
	expect(new URL(page.url()).searchParams.get('filter')).toBe("due_date < 'now+7d'")
})

test('custom filter date text and calendar remain usable inside the dialog', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill("dueDate < '2030-06-17'")
	await editor.locator('.date-value').click()
	const popup = page.locator('.datepicker-with-range')
	await popup.locator('input[type=text]').first().fill('2030-06-17')
	await popup.getByRole('button', {name: 'Open calendar', exact: true}).click()
	const calendar = page.locator('.flatpickr-calendar.open')
	await expect(calendar).toBeVisible()
	await info.attach('calendar-parent', {body: await calendar.evaluate(element => element.parentElement?.tagName ?? ''), contentType: 'text/plain'})
	await calendar.locator('.flatpickr-day[aria-label="June 18, 2030"]').click()
	await expect(editor).toHaveText("dueDate < '2030-06-18 00:00'")
	await expect(page.locator('dialog[open]')).toHaveCount(1)
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect(page).toHaveURL(/filter=/)
})

test('URL text remains plain content and external label readiness does not replace a typed draft', async ({authenticatedPage: page}) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	await page.route('**/api/*/labels*', async route => { if (route.request().method() === 'GET') await gate; await route.continue() })
	await page.goto('/projects/1/1?filter=' + encodeURIComponent('labels = 1'))
	const editor = await openFilter(page)
	await editor.fill('priority >= 2  ')
	await editor.press('End')
	release()
	await expect(editor).toHaveText('priority >= 2  ')
	await editor.press('x')
	await expect(editor).toHaveText('priority >= 2  x')
	await page.keyboard.press('Escape')
	await page.goto('/projects/1/1?s=' + encodeURIComponent('<img src=x onerror=alert(1)>'))
	await openFilter(page)
	await expect(editor).toHaveText('<img src=x onerror=alert(1)>')
	await expect(editor.locator('img')).toHaveCount(0)
})

test('closing during a delayed suggestion request cannot publish into the next task', async ({authenticatedPage: page}) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	let requested = false
	const errors: string[] = []
	page.on('pageerror', error => errors.push(error.message))
	await page.route('**/api/*/projects/1/projectusers*', async route => {
		requested = true; await gate
		await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify([{id: 1, username: 'late-result', name: 'Late result'}])}).catch(() => {})
	})
	await page.goto('/projects/1/1')
	const editor = await openFilter(page)
	await editor.fill('assignees = late')
	await expect.poll(() => requested).toBe(true)
	await page.getByRole('button', {name: 'Close dialog', exact: true}).focus()
	await page.keyboard.press('Escape')
	await expect(page.locator('dialog[open]')).toHaveCount(0)
	await page.getByRole('link', {name: 'Beta task', exact: true}).click()
	await expect(page).toHaveURL(/\/tasks\/2$/)
	await expect(page.locator('h1')).toContainText('Beta task')
	release()
	await page.waitForTimeout(350)
	await expect(page.locator('#filter-autocomplete-popup')).toHaveCount(0)
	expect(errors).toEqual([])
})

test('unknown project metadata shows the same pending frame once the catalog arrives', async ({authenticatedPage: page}, info) => {
	let releaseCatalog!: () => void, releaseMetadata!: () => void
	const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
	const metadataGate = new Promise<void>(resolve => { releaseMetadata = resolve })
	let catalogRequested = false, metadataRequested = false
	const requests: string[] = []
	page.on('request', request => { if (request.method() === 'GET' && /\/api\/v[12]\/projects/.test(request.url())) requests.push(new URL(request.url()).pathname + new URL(request.url()).search) })
	await page.route(/\/api\/v[12]\/projects(?:[/?]|$)/, async route => {
		const path = new URL(route.request().url()).pathname
		if (/\/api\/v[12]\/projects$/.test(path)) { catalogRequested = true; await catalogGate }
		if (/\/api\/v[12]\/projects\/1$/.test(path)) { metadataRequested = true; await metadataGate }
		await route.continue()
	})
	await page.goto('/projects/1/1')
	await expect.poll(() => catalogRequested && metadataRequested).toBe(true)
	await expect(page.locator('.switch-view-container')).toHaveCount(0)
	releaseCatalog()
	await expect(page.locator('.switch-view-container')).toBeVisible()
	await expect(page.locator('ul.tasks .task-link')).toHaveCount(0)
	await page.screenshot({path: info.outputPath('metadata-pending.png'), animations: 'disabled'})
	releaseMetadata()
	await expect(page.locator('ul.tasks .task-link')).toHaveText(['Alpha task', 'Beta task'])
	await info.attach('metadata-request-order', {body: JSON.stringify(requests), contentType: 'application/json'})
})
