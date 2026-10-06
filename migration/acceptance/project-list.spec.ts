import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'List checkpoint'})
	await createDefaultViews(1)
	await TaskFactory.create(70, {title: (id: number) => `Task ${String(id).padStart(3, '0')}`, priority: (id: number) => id > 50 ? 4 : 1})
	await Factory.seed('task_positions', Array.from({length: 70}, (_, i) => ({task_id: i + 1, project_view_id: 1, position: (i + 1) * 65536})))
})

async function sort(page: import('@playwright/test').Page, value: string) {
	await page.getByRole('button', {name: 'Sort', exact: true}).click()
	await page.getByRole('combobox', {name: 'Sort by'}).selectOption(value)
	await page.getByRole('button', {name: 'Apply sort', exact: true}).click()
}

test('list deep links preserve sort/filter/search/page API semantics and reload', async ({authenticatedPage: page}, info) => {
	const requests: string[] = []
	page.on('request', request => { if (/\/views\/1\/tasks\?/.test(request.url())) requests.push(request.url()) })
	await page.goto('/projects/1/1?sort=title:desc&filter=priority%20%3E%3D%204&s=Task')
	const rows = page.locator('.tasks .task-link')
	await expect(rows.first()).toHaveText('Task 070')
	await expect(rows).toHaveCount(20)
	await page.reload()
	await expect(rows.first()).toHaveText('Task 070')
	const query = new URL(requests.at(-1)!).searchParams
	expect(query.getAll('sort_by[]')).toEqual(['title'])
	expect(query.getAll('order_by[]')).toEqual(['desc'])
	expect(query.get('filter')).toBe('priority >= 4')
	expect(query.get('s')).toBe('Task')
	expect(query.getAll('expand[]')).toEqual(['subtasks', 'comment_count', 'is_unread'])
	await info.attach('list-requests', {body: JSON.stringify(requests), contentType: 'application/json'})
})

test('pagination retains the entry draft and supports keyboard row selection', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1?sort=title:asc&page=2')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 051')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep page draft')
	const original = await entry.elementHandle()
	await page.getByLabel('Goto page 1', {exact: true}).click()
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 001')
	await expect(entry).toHaveValue('Keep page draft')
	expect(await entry.evaluate((node, previous) => node === previous, original)).toBe(true)
	await page.locator('#main-content').focus()
	await page.keyboard.press('j')
	await expect(page.locator('.tasks .single-task').first()).toBeFocused()
	await page.keyboard.press('j')
	await expect(page.locator('.tasks .single-task').nth(1)).toBeFocused()
	await page.keyboard.press('k')
	await expect(page.locator('.tasks .single-task').first()).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page.locator('.task-view h1.title.input')).toHaveText('Task 001')
})

test('list failure retains controls and an existing sort action retries successfully', async ({authenticatedPage: page}) => {
	let fail = true
	await page.route('**/projects/1/views/1/tasks?**', route => fail ? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture list failure'})}) : route.continue())
	await page.goto('/projects/1/1')
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture list failure')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep failure draft')
	fail = false
	await sort(page, 'title:desc')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 070')
	await expect(entry).toHaveValue('Keep failure draft')
})

test('rapid sort replacement rejects an earlier delayed list response and retains controls', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 001')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep rapid query draft')
	const node = await entry.elementHandle()
	let release!: () => void
	let settle!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settle = resolve })
	await page.route('**/projects/1/views/1/tasks?**', async route => {
		if (new URL(route.request().url()).searchParams.getAll('order_by[]')[0] !== 'asc') return route.continue()
		const response = await route.fetch()
		await held
		await route.fulfill({response}).catch(() => {})
		settle()
	})
	await sort(page, 'title:asc')
	await expect(page).toHaveURL(/sort=title:asc/)
	await sort(page, 'title:desc')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 070')
	release()
	await delivered
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 070')
	await expect(entry).toHaveValue('Keep rapid query draft')
	expect(await entry.evaluate((element, previous) => element === previous, node)).toBe(true)
})

test('filter editor applies native-compatible query state and keeps task-entry draft', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task-link')).toHaveCount(50)
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep filter draft')
	await page.getByRole('button', {name: 'Filters', exact: true}).click()
	await page.locator('.filter-popup .filter-input .ProseMirror').fill('priority >= 4')
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect(page.locator('.tasks .task-link')).toHaveCount(20)
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 051')
	await expect(entry).toHaveValue('Keep filter draft')
	await expect(page).toHaveURL(/filter=/)
})

test('include-unset filter state is submitted and survives a later sort', async ({authenticatedPage: page}) => {
	const requests: string[] = []
	page.on('request', request => { if (/\/views\/1\/tasks\?/.test(request.url())) requests.push(request.url()) })
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task-link')).toHaveCount(50)
	await page.getByRole('button', {name: 'Filters', exact: true}).click()
	await page.getByText("Include Tasks which don't have a value set", {exact: true}).click()
	await expect(page.getByRole('checkbox', {name: "Include Tasks which don't have a value set"})).toBeChecked()
	await page.getByRole('button', {name: 'Show results', exact: true}).click()
	await expect.poll(() => new URL(requests.at(-1)!).searchParams.get('filter_include_nulls')).toBe('true')
	await sort(page, 'title:desc')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 070')
	expect(new URL(requests.at(-1)!).searchParams.get('filter_include_nulls')).toBe('true')
})

test('same-project readiness failure recovers through the existing sort control', async ({authenticatedPage: page}) => {
	let releaseCatalog!: () => void
	const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
	await page.route('**/api/v1/projects?**', async route => { await catalogGate; await route.continue() })
	let fail = true
	await page.route('**/projects/1', route => route.request().method() === 'GET' && fail
		? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture project readiness failure'})}) : route.continue())
	await page.goto('/projects/1/1')
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture project readiness failure')
	releaseCatalog()
	fail = false
	await sort(page, 'title:desc')
	await expect(page.locator('.tasks .task-link').first()).toHaveText('Task 070')
})

test('late list failure after leaving the project cannot publish an error or replace the new results', async ({authenticatedPage: page}) => {
	await ProjectFactory.create(1, {id: 2, title: 'Destination project'}, false)
	await createDefaultViews(2, 5)
	await TaskFactory.create(1, {id: 71, title: 'Destination task', project_id: 2}, false)
	let release!: () => void
	let settle!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settle = resolve })
	await page.route('**/projects/1/views/1/tasks?**', async route => {
		await held
		await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Obsolete list failure'})}).catch(() => {})
		settle()
	})
	await page.goto('/projects/1/1')
	await page.getByRole('link', {name: 'Destination project', exact: true}).click()
	await expect(page.locator('.tasks .task-link')).toHaveText('Destination task')
	release()
	await delivered
	await expect(page.locator('.vue-notification.error')).toHaveCount(0)
	await expect(page.locator('.tasks .task-link')).toHaveText('Destination task')
})

async function reorder(page: import('@playwright/test').Page) {
	const rows = page.locator('ul.tasks > div')
	const first = await rows.nth(0).boundingBox()
	const third = await rows.nth(2).boundingBox()
	if (!first || !third) throw new Error('Missing reorder rows')
	await page.mouse.move(first.x + 20, first.y + first.height / 2)
	await page.mouse.down()
	await page.mouse.move(third.x + 20, third.y + third.height - 2, {steps: 20})
	await page.mouse.up()
}

test('within-list reorder persists its view position across reload', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task-link')).toHaveCount(50)
	const saved = page.waitForResponse(response => /\/tasks\/1\/position$/.test(response.url()) && response.request().method() === 'POST')
	await reorder(page)
	const response = await saved
	expect(response.ok()).toBe(true)
	const beforeReload = await page.locator('.tasks .task-link').allTextContents()
	expect(beforeReload.indexOf('Task 001')).toBeGreaterThan(0)
	await page.reload()
	await expect(page.locator('.tasks .task-link')).toHaveText(beforeReload)
	await info.attach('position-request', {body: response.request().postData() ?? '', contentType: 'application/json'})
})

test('failed within-list reorder reports the error and reload reflects persisted backend order', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task-link')).toHaveCount(50)
	const before = await page.locator('.tasks .task-link').allTextContents()
	await page.route('**/tasks/1/position', route => route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture position failure'})}))
	await reorder(page)
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture position failure')
	await page.reload()
	await expect(page.locator('.tasks .task-link')).toHaveText(before)
})
