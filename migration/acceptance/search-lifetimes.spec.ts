import type {Page, Route} from '@playwright/test'
import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

const headers = token => ({Authorization: 'Bearer ' + token})
const navigate = (page: Page, path: string) => page.evaluate(path => {
	history.pushState({}, '', path)
	window.dispatchEvent(new PopStateEvent('popstate', {state: history.state}))
}, path)
async function search(page: Page) {
	await expect(page.getByRole('button', {name: 'Open the search/quick action bar', exact: true})).toBeVisible()
	await page.keyboard.press('Control+k')
	const dialog = page.getByRole('dialog')
	const input = dialog.locator('input').first()
	await expect(input).toBeFocused()
	return {dialog, input}
}
async function command(page: Page, name: string) {
	const controls = await search(page)
	await controls.input.fill(name); await controls.input.press('End')
	await controls.dialog.getByRole('button', {name: new RegExp(name)}).click()
	return controls
}
function hold(matcher: (route: Route) => boolean) {
	let release!: () => void, ready!: () => void, finish!: () => void
	const gate = new Promise<void>(done => release = done)
	const started = new Promise<void>(done => ready = done)
	const settled = new Promise<void>(done => finish = done)
	return {release, started, settled, handler: async (route: Route) => {
		if (!matcher(route)) return route.continue()
		const response = await route.fetch()
		ready(); await gate
		await route.fulfill({response}).catch(() => {})
		finish()
	}}
}
test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await UserFactory.create(1, {id: 2, username: 'lifetime-owner'}, false)
	await ProjectFactory.create(4, {title: id => ['Source', 'Destination', 'Later', 'Archived'][id - 1], is_archived: id => id === 4})
	for (let id = 1; id <= 4; id++) await createDefaultViews(id, (id - 1) * 4 + 1)
	await TaskFactory.create(2, {title: id => 'Lifetime task ' + id, project_id: 1, hex_color: '1973ff', description: 'Keep the description'})
	await UserProjectFactory.create(0)
})

for (const width of [1440, 390]) test('reader task and sidebar controls deny writes ' + width, async ({authenticatedPage: page, apiContext, userToken}, info) => {
	await ProjectFactory.create(1, {id: 1, title: 'Source', owner_id: 2}, true)
	await UserProjectFactory.create(1, {project_id: 1, user_id: 1, permission: 0})
	await page.setViewportSize({width, height: 900})
	const writes: string[] = []
	page.on('request', r => {if (r.method() !== 'GET' && /\/api\/(?:v1\/tasks\/1|v1\/projects\/1|v2\/projects\/1\/tasks)/.test(r.url())) writes.push(r.url())})
	await page.goto('/tasks/1'); await expect(page.locator('.task-view h1')).toContainText('Lifetime task 1')
	await expect(page.locator('.task-view').getByRole('button', {name: 'Move', exact: true})).toHaveCount(0)
	await expect(page.locator('.task-view').getByRole('button', {name: 'Set Color', exact: true})).toHaveCount(0)
	const color = page.locator('.task-view input[type=color]')
	if (await color.count()) await expect(color).toBeDisabled()
	const row = page.locator('.menu-container [data-project-id="1"]').first()
	await expect(row).toBeVisible()
	await expect(row.getByRole('button', {name: 'Mark this project as favorite', exact: true})).toHaveCount(0)
	await expect(row.locator('.handle')).toHaveCount(0)
	await page.screenshot({path: info.outputPath('reader-' + width + '.png')})
	expect(writes).toEqual([])
	const denied = await apiContext.post('tasks/1', {headers: headers(userToken), data: {id: 1, project_id: 1, title: 'Forbidden'}})
	expect(denied.status()).toBe(403)
})

test('move picker excludes actual reader and archived destinations', async ({authenticatedPage: page}) => {
	// Owner differs only for this destination; source remains writable.
	await ProjectFactory.create(4, {title: id => ['Source', 'Destination', 'Later', 'Archived'][id - 1], owner_id: id => id === 2 ? 2 : 1, is_archived: id => id === 4})
	await UserProjectFactory.create(1, {project_id: 2, user_id: 1, permission: 0})
	await page.goto('/tasks/1')
	await page.locator('.task-view').getByRole('button', {name: 'Move', exact: true}).click()
	const input = page.locator('.task-view .multiselect input').last()
	await input.fill('Destination'); await input.press('End')
	await expect(page.getByRole('option').filter({hasText: 'Destination'})).toHaveCount(0)
	await input.fill('Archived'); await input.press('End')
	await expect(page.getByRole('option').filter({hasText: 'Archived'})).toHaveCount(0)
	await input.fill('Later'); await input.press('End')
	await expect(page.getByRole('option').filter({hasText: 'Later'})).toBeVisible()
})

test('reader quick create is denied by backend and retains the draft', async ({authenticatedPage: page, apiContext, userToken}) => {
	await ProjectFactory.create(1, {id: 1, title: 'Source', owner_id: 2})
	await UserProjectFactory.create(1, {project_id: 1, user_id: 1, permission: 0})
	await page.goto('/projects/1/1'); await expect(page.locator('.tasks')).toBeVisible()
	const {dialog, input} = await command(page, 'New task')
	await input.fill('Reader draft'); await input.press('Enter')
	await expect(dialog.getByRole('alert')).toBeVisible()
	await expect(input).toHaveValue('Reader draft'); await expect(input).toBeFocused()
	const tasks = await apiContext.get('tasks', {headers: headers(userToken), params: {s: 'Reader draft'}})
	expect(await tasks.json()).toEqual([])
})

test('closed search cannot publish into reopened dialog and restores scroll', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	const delayed = hold(route => new URL(route.request().url()).searchParams.get('s') === 'Lifetime task 1')
	await page.route('**/tasks?*', delayed.handler)
	const first = await search(page); await first.input.fill('Lifetime task 1'); await first.input.press('End'); await delayed.started
	await first.input.press('Escape'); await expect(first.dialog).toHaveCount(0)
	expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
	const second = await search(page); await second.input.fill('Lifetime task 2'); await second.input.press('End')
	await expect(second.dialog.getByRole('button').filter({hasText: 'Lifetime task 2'})).toBeVisible()
	delayed.release(); await delayed.settled
	await expect(second.input).toHaveValue('Lifetime task 2'); await expect(second.input).toBeFocused()
	await expect(second.dialog.getByRole('button').filter({hasText: 'Lifetime task 1'})).toHaveCount(0)
})

test('route change aborts quick creation publication and leaves the next route', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/projects/1/1')
	const delayed = hold(route => route.request().method() === 'PUT')
	await page.route('**/teams', delayed.handler)
	const {input} = await command(page, 'New team'); await input.fill('Accepted before navigation'); await input.press('Enter'); await delayed.started
	await navigate(page, '/projects/2/5'); await expect(page.getByPlaceholder('Add a task…')).toBeVisible()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	delayed.release(); await delayed.settled
	await expect(page).toHaveURL(/\/projects\/2\/5$/)
	expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
	const teams = await apiContext.get('teams', {headers: headers(userToken)})
	expect((await teams.json()).some(team => team.name === 'Accepted before navigation')).toBe(true)
})

test('repeated create submits once and preserves a later creation draft', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/projects/1/1'); let writes = 0
	const delayed = hold(route => {if (route.request().method() !== 'PUT') return false; writes++; return true})
	await page.route('**/teams', delayed.handler)
	const {dialog, input} = await command(page, 'New team'); await input.fill('First team'); await input.press('Enter'); await delayed.started
	await input.press('Enter'); await input.fill('Later team draft'); await input.focus()
	delayed.release(); await delayed.settled
	await expect(input).toHaveValue('Later team draft'); await expect(input).toBeFocused(); expect(writes).toBe(1)
	await page.unroute('**/teams'); await input.press('Enter'); await expect(dialog).toHaveCount(0)
	const teams = await apiContext.get('teams', {headers: headers(userToken)})
	expect((await teams.json()).map(team => team.name).sort()).toEqual(['First team', 'Later team draft'])
})

for (const field of ['color', 'move']) test('task navigation cancels accepted delayed ' + field + ' publication', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/tasks/1'); await expect(page.locator('.task-view h1')).toHaveText('Lifetime task 1')
	const delayed = hold(route => route.request().method() === 'POST')
	await page.route('**/tasks/1', delayed.handler)
	await page.locator('.task-view').getByRole('button', {name: field === 'color' ? 'Set Color' : 'Move', exact: true}).click()
	if (field === 'color') await page.locator('.task-view input[type=color]').fill('#ff4136')
	else {const input = page.locator('.task-view .multiselect input').last(); await input.fill('Destination'); await input.press('End'); await page.getByRole('option').filter({hasText: 'Destination'}).click()}
	await delayed.started; await navigate(page, '/tasks/2'); await expect(page.locator('.task-view h1')).toHaveText('Lifetime task 2')
	const title = page.locator('.task-view h1'); await title.fill('Next task draft'); await title.focus()
	delayed.release(); await delayed.settled
	await expect(title).toHaveText('Next task draft'); await expect(title).toBeFocused(); await expect(page).toHaveURL(/\/tasks\/2$/)
	const original = await apiContext.get('tasks/1', {headers: headers(userToken)})
	expect(await original.json()).toMatchObject(field === 'color' ? {hex_color: 'ff4136'} : {project_id: 2})
})

test('modal close and reopen cannot publish the previous move response', async ({authenticatedPage: page}) => {
	await BucketFactory.create(1, {id: 1, title: 'Backlog', project_view_id: 4})
	await TaskBucketFactory.create(2, {task_id: id => id, bucket_id: 1, project_view_id: 4})
	await page.goto('/projects/1/4'); await page.locator('.kanban .task').filter({hasText: 'Lifetime task 1'}).click()
	await page.locator('.task-view').getByRole('button', {name: 'Move', exact: true}).click()
	const delayed = hold(route => route.request().method() === 'POST'); await page.route('**/tasks/1', delayed.handler)
	const input = page.locator('.task-view .multiselect input').last(); await input.fill('Destination'); await input.press('End'); await page.getByRole('option').filter({hasText: 'Destination'}).click(); await delayed.started
	await page.getByRole('dialog').press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
	await page.locator('.kanban .task').filter({hasText: 'Lifetime task 2'}).click(); await expect(page.locator('.task-view h1')).toHaveText('Lifetime task 2')
	delayed.release(); await delayed.settled; await expect(page.locator('.task-view h1')).toHaveText('Lifetime task 2')
	await expect(page.locator('.task-view .subtitle')).toContainText('Source')
})

test('sidebar favorites are repeatable and failed writes retain accepted state', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/projects/1/1'); const row = page.locator('.menu-container').getByRole('navigation', {name: 'Projects', exact: true}).locator('[data-project-id="1"]').first()
	await row.getByRole('button', {name: 'Mark this project as favorite', exact: true}).click()
	await expect(row.getByRole('button', {name: 'Remove this project from favorites', exact: true})).toBeVisible()
	await row.getByRole('button', {name: 'Remove this project from favorites', exact: true}).click()
	await expect(row.getByRole('button', {name: 'Mark this project as favorite', exact: true})).toBeVisible()
	await page.route('**/projects/1', route => route.request().method() === 'POST' ? route.fulfill({status: 503, json: {message: 'Favorite unavailable'}}) : route.continue())
	await row.getByRole('button', {name: 'Mark this project as favorite', exact: true}).click()
	await expect(row.getByRole('alert')).toContainText('Favorite unavailable')
	const project = await apiContext.get('projects/1', {headers: headers(userToken)}); expect((await project.json()).is_favorite).toBe(false)
	await page.unroute('**/projects/1'); await row.getByRole('button', {name: 'Mark this project as favorite', exact: true}).click()
	await expect(row.getByRole('button', {name: 'Remove this project from favorites', exact: true})).toBeVisible()
})

test('outsider search and sidebar do not expose private projects or tasks', async ({authenticatedPage: page, apiContext, userToken}) => {
	await ProjectFactory.create(1, {id: 1, title: 'Private source', owner_id: 2})
	await page.goto('/projects'); await expect(page.getByRole('button', {name: 'Open the search/quick action bar', exact: true})).toBeVisible()
	await expect(page.locator('.menu-container').getByRole('link', {name: 'Private source', exact: true})).toHaveCount(0)
	const {dialog, input} = await search(page); await input.fill('Lifetime task'); await input.press('End')
	await expect(dialog.getByText('No results', {exact: true})).toBeVisible()
	await expect(dialog.getByRole('button').filter({hasText: 'Lifetime task'})).toHaveCount(0)
	const response = await apiContext.get('tasks/1', {headers: headers(userToken)})
	expect(response.status()).toBe(403)
})

test('revoked permission rejects a move and retains its selected draft', async ({authenticatedPage: page, apiContext, userToken}) => {
	await ProjectFactory.create(4, {title: id => ['Source', 'Destination', 'Later', 'Archived'][id - 1], owner_id: id => id === 1 ? 2 : 1})
	await UserProjectFactory.create(1, {project_id: 1, user_id: 1, permission: 1})
	await page.goto('/tasks/1'); await page.locator('.task-view').getByRole('button', {name: 'Move', exact: true}).click()
	const input = page.locator('.task-view .multiselect input').last(); await input.fill('Destination'); await input.press('End')
	await expect(page.getByRole('option').filter({hasText: 'Destination'})).toBeVisible()
	await UserProjectFactory.create(1, {project_id: 1, user_id: 1, permission: 0})
	const denied = page.waitForResponse(r => /\/tasks\/1$/.test(r.url()) && r.request().method() === 'POST')
	await page.getByRole('option').filter({hasText: 'Destination'}).click(); expect((await denied).status()).toBe(403)
	await expect(page.locator('.task-view').getByRole('alert')).toBeVisible(); await expect(input).toHaveValue('Destination'); await expect(input).toBeFocused()
	const task = await apiContext.get('tasks/1', {headers: headers(userToken)}); expect((await task.json()).project_id).toBe(1)
	await page.reload(); await expect(page.locator('.task-view h1')).toHaveText('Lifetime task 1'); await expect(page.locator('.task-view').getByRole('button', {name: 'Move', exact: true})).toHaveCount(0)
})

test('sidebar accepted delayed favorite survives navigation without redirecting', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/projects/1/1'); const delayed = hold(route => route.request().method() === 'POST'); await page.route('**/projects/1', delayed.handler)
	const row = page.locator('.menu-container').getByRole('navigation', {name: 'Projects', exact: true}).locator('[data-project-id="1"]').first()
	await row.getByRole('button', {name: 'Mark this project as favorite', exact: true}).click(); await delayed.started
	await expect(row.getByRole('button', {name: 'Mark this project as favorite', exact: true})).toBeDisabled()
	await page.locator('.menu-container').getByRole('link', {name: 'Destination', exact: true}).click(); await expect(page).toHaveURL(/\/projects\/2\/5$/)
	delayed.release(); await delayed.settled; await expect(page).toHaveURL(/\/projects\/2\/5$/)
	await expect(row.getByRole('button', {name: 'Remove this project from favorites', exact: true})).toBeVisible()
	const project = await apiContext.get('projects/1', {headers: headers(userToken)}); expect((await project.json()).is_favorite).toBe(true)
})

test('sidebar reparent failure rolls back and retry persists the hierarchy', async ({authenticatedPage: page, apiContext, userToken}) => {
	await ProjectFactory.create(4, {title: id => ['Source', 'Destination', 'Later', 'Archived'][id - 1], parent_project_id: id => id === 3 ? 2 : 0, is_archived: id => id === 4})
	await page.goto('/projects/1/1')
	const nav = page.locator('.menu-container'), source = nav.locator('[data-project-id="1"]').first(), child = nav.locator('[data-project-id="3"]').first()
	await page.route('**/projects/1', route => route.request().method() === 'POST' ? route.fulfill({status: 503, json: {message: 'Reparent unavailable'}}) : route.continue())
	async function drag() {
		await source.hover(); const from = (await source.locator('.handle').boundingBox())!, to = (await child.boundingBox())!
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(from.x + 15, from.y + 10, {steps: 5}); await page.mouse.move(to.x + to.width - 60, to.y + to.height * .75, {steps: 30}); await expect(nav.locator('[data-project-id="2"]').first().getByRole('link', {name: 'Source', exact: true})).toBeVisible(); await page.mouse.up()
	}
	await drag(); await expect(source.getByRole('alert')).toContainText('Reparent unavailable')
	expect((await (await apiContext.get('projects/1', {headers: headers(userToken)})).json()).parent_project_id).toBe(0)
	await page.unroute('**/projects/1'); await drag()
	await expect.poll(async () => (await (await apiContext.get('projects/1', {headers: headers(userToken)})).json()).parent_project_id).toBe(2)
	await page.reload(); await expect(nav.locator('[data-project-id="2"]').first().getByRole('link', {name: 'Source', exact: true})).toBeVisible()
})
