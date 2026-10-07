import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

async function secondProject() {
	await ProjectFactory.create(1, {id: 2, title: 'Second project'}, false)
	await createDefaultViews(2, 5)
	await TaskFactory.create(1, {id: 2, title: 'Second project task', project_id: 2}, false)
}

test.beforeEach(async ({authenticatedPage: page}) => {
	await ProjectFactory.create(1, {title: 'First project'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'First project task'})
})

test('project readiness replacement keeps navigation and rejects the delayed previous destination', async ({authenticatedPage: page}, testInfo) => {
	await secondProject()
	let release!: () => void
	let settled!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settled = resolve })
	const requests: string[] = []
	page.on('request', request => { if (request.method() === 'GET') requests.push(new URL(request.url()).pathname) })
	await page.route('**/projects/1', async route => {
		if (route.request().method() !== 'GET') return route.continue()
		const response = await route.fetch()
		await held
		await route.fulfill({response}).catch(() => {})
		settled()
	})
	await page.goto('/projects/1/1')
	const nextProject = page.getByRole('link', {name: 'Second project', exact: true})
	await expect(nextProject).toBeVisible()
	const node = await nextProject.elementHandle()
	await page.screenshot({path: testInfo.outputPath('project-loading.png'), animations: 'disabled'})
	await nextProject.click()
	await expect(page.locator('.tasks .task .tasktext')).toContainText('Second project task')
	release()
	await delivered
	await expect(page).toHaveURL(/\/projects\/2\/5/)
	await expect(page.locator('.tasks .task .tasktext')).toContainText('Second project task')
	expect(await nextProject.evaluate((element, previous) => element === previous, node)).toBe(true)
	await testInfo.attach('get-requests', {body: JSON.stringify(requests), contentType: 'application/json'})
})

test('task readiness replacement cannot publish the delayed task into the new project', async ({authenticatedPage: page}) => {
	await secondProject()
	let release!: () => void
	let settled!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settled = resolve })
	await page.route('**/tasks/1?**', async route => {
		if (route.request().method() !== 'GET') return route.continue()
		const response = await route.fetch()
		await held
		await route.fulfill({response}).catch(() => {})
		settled()
	})
	await page.goto('/tasks/1')
	await page.getByRole('link', {name: 'Second project', exact: true}).click()
	// The Vue reference has a five-second route-leave guard while task readiness is pending.
	await expect(page).toHaveURL(/\/projects\/2\/5/, {timeout: 10000})
	await expect(page.locator('.tasks .task .tasktext')).toContainText('Second project task')
	await page.locator('.tasks .task .tasktext').click()
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText('Second project task')
	release()
	await delivered
	await expect(title).toHaveText('Second project task')
	await expect(page.locator('.task-view nav.subtitle')).toContainText('Second project')
})

test('sorting reloads results while preserving the task-entry draft and controls', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	await expect(page.locator('.tasks .task .tasktext')).toContainText('First project task')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep this entry draft')
	const node = await entry.elementHandle()
	await page.getByRole('button', {name: 'Sort', exact: true}).click()
	await page.getByRole('combobox', {name: 'Sort by'}).selectOption('title:asc')
	await page.getByRole('button', {name: 'Apply sort', exact: true}).click()
	await expect(page).toHaveURL(/sort=title/)
	await expect(page.locator('.tasks .task .tasktext')).toContainText('First project task')
	await expect(entry).toHaveValue('Keep this entry draft')
	expect(await entry.evaluate((element, previous) => element === previous, node)).toBe(true)
})

test('logout destroys a pending title editor before its response returns', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText('First project task')
	let release!: () => void
	let settled!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settled = resolve })
	await page.route('**/tasks/1', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		await held
		await route.fulfill({response}).catch(() => {})
		settled()
	})
	await title.fill('Pending old-session title')
	await title.press('Enter')
	await expect(page.locator('.heading')).toContainText('Saving…')
	await page.locator('.username-dropdown-trigger').click()
	await page.getByText('Logout', {exact: true}).click()
	await expect(page).toHaveURL(/\/login/)
	release()
	await delivered
	await expect(title).toHaveCount(0)
	await expect(page.locator('.heading')).toHaveCount(0)
	await expect(page.getByRole('button', {name: 'Login', exact: true})).toBeVisible()
})


test('read-only shared task title cannot acquire editing focus or publish a write', async ({authenticatedPage: page, currentUser}) => {
	const [owner] = await UserFactory.create(1, {id: 2}, false)
	await ProjectFactory.create(1, {id: 2, title: 'Read-only project', owner_id: owner.id}, false)
	await createDefaultViews(2, 5)
	await UserProjectFactory.create(1, {project_id: 2, user_id: currentUser.id, permission: 0})
	await TaskFactory.create(1, {id: 2, title: 'Read-only task', project_id: 2, created_by_id: owner.id}, false)
	const writes: string[] = []
	page.on('request', request => { if (request.method() === 'POST' && /\/tasks\/2$/.test(new URL(request.url()).pathname)) writes.push(request.postData() ?? '') })
	await page.goto('/tasks/2')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText('Read-only task')
	await expect(title).not.toHaveAttribute('contenteditable')
	await expect(title).not.toHaveAttribute('tabindex')
	await title.click()
	await expect(title).not.toBeFocused()
	expect(writes).toEqual([])
})

test('a missing task readiness response reaches the original not-found destination', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/99999')
	await expect(page.getByRole('heading', {name: 'Not found', exact: true})).toBeVisible()
	await expect(page.getByRole('link', {name: 'First project', exact: true})).toBeVisible()
	await expect(page.locator('.task-view h1.title.input')).toHaveCount(0)
})
