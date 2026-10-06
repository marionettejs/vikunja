import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'Basic task fields'})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: index => index === 1 ? 'Alpha task' : 'Beta task', priority: 2, percent_done: 0.3})
})
function progress(page) { return page.locator('.details .column').filter({has: page.locator('.detail-title', {hasText: 'Progress'})}).locator('select') }

for (const width of [1440, 390]) {
test(`priority and progress preserve selected values, keyboard focus, real writes and reload at ${width}`, async ({authenticatedPage: page}, info) => {
	await page.setViewportSize({width, height: 900})
	await page.goto('/tasks/1')
	const priority = page.getByRole('combobox', {name: 'Priority', exact: true})
	await expect(priority).toHaveValue('2')
	await expect(progress(page)).toHaveValue('0.3')
	const save = page.waitForResponse(response => /\/api\/v[12]\/tasks\/1$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
	await priority.focus(); await priority.selectOption('4')
	const response = await save
	expect(response.ok()).toBe(true)
	expect(response.request().postDataJSON().priority).toBe(4)
	await expect(priority).toBeFocused()
	await expect(priority).toHaveValue('4')
	const progressSave = page.waitForResponse(response => /\/api\/v[12]\/tasks\/1$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
	await progress(page).selectOption('0.7')
	await expect(progress(page)).toHaveValue('0.7')
	expect((await progressSave).ok()).toBe(true)
	await expect(page.locator('.notification-content').filter({hasText: 'The task was saved successfully.'}).first()).toBeVisible()
	await page.screenshot({path: info.outputPath('task-select-fields.png'), animations: 'disabled'})
	await page.reload()
	await expect(priority).toHaveValue('4')
	await expect(progress(page)).toHaveValue('0.7')
})
}

test('failed priority save retains the selected value and permits retry', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const priority = page.getByRole('combobox', {name: 'Priority', exact: true})
	await page.route('**/api/*/tasks/1', async route => {
		if (route.request().method() === 'POST') await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Select checkpoint failure'})})
		else await route.continue()
	})
	await priority.selectOption('4')
	await expect(priority).toHaveValue('4')
	await expect(page.getByText('Select checkpoint failure', {exact: true})).toBeVisible()
	await page.unroute('**/api/*/tasks/1')
	const save = page.waitForResponse(response => /\/api\/v[12]\/tasks\/1$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
	await priority.selectOption('3')
	expect((await save).ok()).toBe(true)
	await page.reload()
	await expect(priority).toHaveValue('3')
})


test('read-only shared task keeps both selects disabled and sends no write', async ({authenticatedPage: page, currentUser}) => {
	const [owner] = await UserFactory.create(1, {id: 2}, false)
	await ProjectFactory.create(1, {id: 2, title: 'Read-only project', owner_id: owner.id}, false)
	await createDefaultViews(2, 5)
	await UserProjectFactory.create(1, {project_id: 2, user_id: currentUser.id, permission: 0})
	await TaskFactory.create(1, {id: 3, title: 'Read-only task', due_date: '2026-10-20T12:30:00Z', priority: 3, percent_done: 0.4, project_id: 2, created_by_id: owner.id}, false)
	const writes: string[] = []
	page.on('request', request => { if (request.method() === 'POST' && /\/tasks\/3$/.test(new URL(request.url()).pathname)) writes.push(request.postData() ?? '') })
	await page.goto('/tasks/3')
	await expect(page.getByRole('combobox', {name: 'Priority', exact: true})).toBeDisabled()
	await expect(progress(page)).toBeDisabled()
	await expect(progress(page)).toHaveValue('0.4')
	await expect(page.locator('.details .datepicker .show')).toBeDisabled()
	await expect(page.getByRole('button', {name: 'Remove due date', exact: true})).toHaveCount(0)
	expect(writes).toEqual([])
})

test('leaving a pending priority write cannot publish a success notification into the next task', async ({authenticatedPage: page}) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	let requested = false
	await page.route('**/api/*/tasks/1', async route => {
		if (route.request().method() !== 'POST') { await route.continue(); return }
		const response = await route.fetch()
		requested = true
		await gate
		try { await route.fulfill({response}) } catch { /* The native owner intentionally aborts delivery. */ }
	})
	await page.goto('/tasks/1')
	await page.getByRole('combobox', {name: 'Priority', exact: true}).selectOption('4')
	await expect.poll(() => requested).toBe(true)
	await page.getByRole('navigation', {name: 'Breadcrumb'}).getByRole('link', {name: 'Basic task fields', exact: true}).click()
	await page.getByRole('link', {name: 'Beta task', exact: true}).click()
	await expect(page.locator('h1')).toContainText('Beta task')
	release()
	await page.waitForTimeout(350)
	await expect(page.getByText('The task was saved successfully.', {exact: true})).toHaveCount(0)
	await expect(page.getByRole('combobox', {name: 'Priority', exact: true})).toHaveValue('2')
})
