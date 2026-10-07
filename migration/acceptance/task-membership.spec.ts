import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {LabelFactory} from '../../frontend/tests/factories/labels'
import {LabelTaskFactory} from '../../frontend/tests/factories/label_task'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {TaskAssigneeFactory} from '../../frontend/tests/factories/task_assignee'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async ({authenticatedPage: page}) => {
	// Chromium omits streamed Request bodies from CDP postData; capture the actual
	// browser fetch body before forwarding it unchanged to the fixture backend.
	await page.addInitScript(() => {
		const original = window.fetch
		window.__membershipWrites = []
		window.fetch = async (input, init) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.method === 'POST' && /\/(labels|tasks\/\d+\/labels)$/.test(new URL(request.url).pathname)) window.__membershipWrites.push({url: request.url, body: JSON.parse(await request.clone().text())})
			return original(input, init)
		}
	})
	await ProjectFactory.create(1, {title: 'Membership review'})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: index => index === 1 ? 'Alpha task' : 'Beta task', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await LabelFactory.create(2, {title: index => index === 1 ? 'Amber label' : 'Blue label', hex_color: index => index === 1 ? 'ffc107' : '2196f3', created: '2026-01-01T00:00:00Z'})
	await LabelTaskFactory.create(1, {task_id: 1, label_id: 1})
	await UserFactory.create(2, {id: index => 100 + index, username: index => `member-${index}`, name: index => `Member ${index}`}, false)
	await UserProjectFactory.create(2, {project_id: 1, user_id: index => 100 + index})
	await TaskAssigneeFactory.create(1, {task_id: 1, user_id: 101})
})
const labels = page => page.locator('.task-view .details.labels-list .multiselect')
const users = page => page.locator('.task-view .column.assignees .multiselect')
const relation = (page, kind, method) => page.waitForResponse(response => new URL(response.url()).pathname.match(new RegExp(`/api/v[12]/tasks/1/${kind}(?:/\\d+)?$`)) && response.request().method() === method)
for (const width of [1440, 390]) {
	test(`membership keyboard, request bodies, removal and reload at ${width}`, async ({authenticatedPage: page}, info) => {
		await page.setViewportSize({width, height: 900})
		await page.goto('/tasks/1')
		await expect(labels(page).locator('.input-wrapper')).toContainText('Amber label')
		await expect(users(page).locator('.assignee')).toHaveCount(1)
		await page.waitForLoadState('networkidle')
		await page.screenshot({path: info.outputPath('membership-selected.png'), animations: 'disabled'})
		await users(page).locator('.assignee .avatar').hover()
		await expect(page.locator('.v-popper--theme-tooltip.v-popper__popper--shown').filter({hasText: 'Member 1'})).toBeInViewport()
		await page.screenshot({path: info.outputPath('membership-avatar-tooltip.png'), animations: 'disabled'})
		await page.locator('h1').hover()
		await expect(page.locator('.v-popper--theme-tooltip.v-popper__popper--shown').filter({hasText: 'Member 1'})).toHaveCount(0)
		const input = labels(page).locator('input')
		await page.getByRole('button', {name: 'Add Labels', exact: true}).click()
		await expect(input).toBeFocused()
		await input.fill('Blue')
		await input.press('End')
		await expect(labels(page).getByRole('option').filter({hasText: 'Blue label'})).toBeVisible()
		await page.screenshot({path: info.outputPath('membership-label-lookup.png'), animations: 'disabled'})
		await input.press('ArrowDown')
		const adding = relation(page, 'labels', 'POST')
		await page.keyboard.press('Enter')
		const added = await adding
		expect(added.ok()).toBe(true)
		expect(await page.evaluate(() => window.__membershipWrites.find(write => /tasks\/1\/labels$/.test(write.url)).body)).toEqual({label_id: 2})
		await expect(input).toBeFocused()
		await expect(labels(page).locator('.input-wrapper')).toContainText('Blue label')
		const removing = relation(page, 'labels', 'DELETE')
		await labels(page).locator('.input-wrapper .tag').filter({hasText: 'Blue label'}).locator('button').click()
		expect((await removing).ok()).toBe(true)
		const userInput = users(page).locator('input')
		await userInput.click()
		const lookup = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/projects/1/projectusers' && new URL(response.url()).searchParams.get('s') === 'member-2')
		await userInput.fill('member-2')
		await userInput.press('End')
		expect((await lookup).ok()).toBe(true)
		await expect(users(page).getByRole('option')).toHaveCount(1)
		await expect(users(page).getByRole('option').filter({hasText: 'Member 2'})).toBeVisible()
		await page.screenshot({path: info.outputPath('membership-user-lookup.png'), animations: 'disabled'})
		await userInput.press('ArrowDown')
		const assigning = relation(page, 'assignees', 'PUT')
		await page.keyboard.press('Enter')
		const assigned = await assigning
		expect(assigned.ok()).toBe(true)
		expect(assigned.request().postDataJSON().user_id).toBe(102)
		await expect(userInput).toBeFocused()
		await page.reload()
		await expect(users(page).locator('.assignee')).toHaveCount(2)
		await expect(labels(page).locator('.input-wrapper')).not.toContainText('Blue label')
		const unassigning = relation(page, 'assignees', 'DELETE')
		await users(page).getByRole('button', {name: 'Remove Member 2 as assignee'}).click()
		expect((await unassigning).ok()).toBe(true)
		await page.reload()
		await expect(users(page).locator('.assignee')).toHaveCount(1)
	})
}

test('create a label through the existing label and task-relation endpoints', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	await labels(page).locator('input').fill('Created membership label')
	const creating = page.waitForResponse(response => /\/api\/v2\/labels$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
	const adding = relation(page, 'labels', 'POST')
	await labels(page).getByRole('option').filter({hasText: 'Add this as new label'}).click()
	const created = await creating
	expect(created.ok()).toBe(true)
	const body = await page.evaluate(() => window.__membershipWrites.find(write => /\/api\/v2\/labels$/.test(write.url)).body)
	expect(body.title).toBe('Created membership label')
	expect(body.hex_color).toMatch(/^[0-9a-f]{6}$/i)
	expect((await adding).ok()).toBe(true)
	await page.reload()
	await expect(labels(page).locator('.input-wrapper')).toContainText('Created membership label')
})

test('read-only task renders labels and assignees without edit or relation requests', async ({authenticatedPage: page, currentUser}, info) => {
	await UserFactory.create(1, {id: 201, username: 'readonly-owner'}, false)
	await ProjectFactory.create(1, {id: 2, title: 'Readonly membership', owner_id: 201}, false)
	await createDefaultViews(2, 5)
	await UserProjectFactory.create(1, {id: 3, project_id: 2, user_id: currentUser.id, permission: 0}, false)
	await TaskFactory.create(1, {id: 3, project_id: 2, title: 'Readonly task', created_by_id: 201}, false)
	await LabelTaskFactory.create(1, {id: 2, task_id: 3, label_id: 1}, false)
	await TaskAssigneeFactory.create(1, {id: 2, task_id: 3, user_id: 101}, false)
	const writes: string[] = []
	page.on('request', request => { if (['POST', 'PUT', 'DELETE'].includes(request.method()) && /\/tasks\/3\/(labels|assignees)/.test(new URL(request.url()).pathname)) writes.push(request.url()) })
	await page.goto('/tasks/3')
	const taskLabels = page.locator('.task-view .details.labels-list'), taskUsers = page.locator('.task-view .column.assignees')
	await expect(taskLabels).toContainText('Amber label')
	await expect(taskUsers.locator('.assignee')).toHaveCount(1)
	await expect(taskLabels.getByRole('combobox')).toHaveCount(0)
	await expect(taskUsers.getByRole('combobox')).toHaveCount(0)
	await expect(taskLabels.locator('.delete')).toHaveCount(0)
	await expect(taskUsers.locator('.remove-assignee')).toHaveCount(0)
	await page.waitForLoadState('networkidle')
	await page.screenshot({path: info.outputPath('membership-readonly.png'), animations: 'disabled'})
	expect(writes).toEqual([])
})

test('link share may select existing labels but cannot create new labels', async ({authenticatedPage: page}, info) => {
	const {LinkShareFactory} = await import('../../frontend/tests/factories/link_sharing')
	await LabelTaskFactory.create(1, {id: 3, task_id: 2, label_id: 2}, false)
	const [share] = await LinkShareFactory.create(1, {project_id: 1, permission: 1, hash: 'membership-review-share'})
	const writes: string[] = []
	page.on('request', request => { if (request.method() === 'POST' && /\/api\/v2\/labels$/.test(new URL(request.url()).pathname)) writes.push(request.url()) })
	await page.goto(`/tasks/1#share-auth-token=${share.hash}`)
	await expect(labels(page).locator('input')).toBeVisible()
	await labels(page).locator('input').fill('Nonexistent membership label')
	await labels(page).locator('input').press('End')
	await expect(labels(page).locator('.search-results .search-result-hint')).toContainText("New labels can't be created from a shared link")
	await expect(labels(page).locator('.is-create-option')).toHaveCount(0)
	await page.screenshot({path: info.outputPath('membership-link-share.png'), animations: 'disabled'})
	await labels(page).locator('input').fill('Blue')
	await labels(page).locator('input').press('End')
	const adding = relation(page, 'labels', 'POST')
	await labels(page).getByRole('option').filter({hasText: 'Blue label'}).click()
	expect((await adding).ok()).toBe(true)
	await expect(labels(page).locator('.input-wrapper')).toContainText('Blue label')
	expect(writes).toEqual([])
})

test('a delayed relation response cannot notify or assign into the next task', async ({authenticatedPage: page}) => {
	let release!: () => void, requested = false
	const gate = new Promise<void>(done => { release = done })
	await page.route('**/api/v2/tasks/1/labels', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch(); requested = true; await gate
		try { await route.fulfill({response}) } catch { /* Owner may abort response delivery. */ }
	})
	await page.goto('/tasks/1')
	await labels(page).locator('input').fill('Blue')
	await labels(page).locator('input').press('End')
	await labels(page).getByRole('option').filter({hasText: 'Blue label'}).click()
	await expect.poll(() => requested).toBe(true)
	await page.getByRole('navigation', {name: 'Breadcrumb'}).getByRole('link', {name: 'Membership review', exact: true}).click()
	await page.getByRole('link', {name: 'Beta task', exact: true}).click()
	await expect(page.locator('h1')).toContainText('Beta task')
	release()
	await page.waitForTimeout(350)
	await expect(page.getByText('The label has been added successfully.', {exact: true})).toHaveCount(0)
	await expect(page.locator('.task-view .details.labels-list')).toHaveCount(0)
})

test('delayed project lookup shows loading and Escape keeps the query without reopening results', async ({authenticatedPage: page}, info) => {
	let release!: () => void, requested = false
	const gate = new Promise<void>(done => { release = done })
	await page.route('**/api/v1/projects/1/projectusers?*', async route => {
		if (new URL(route.request().url()).searchParams.get('s') !== 'member-2') return route.continue()
		const response = await route.fetch(); requested = true; await gate
		try { await route.fulfill({response}) } catch { /* Native lookup is cancelled on Escape. */ }
	})
	await page.goto('/tasks/1')
	const input = users(page).locator('input')
	await page.getByRole('button', {name: 'Assign to User', exact: true}).click()
	await expect(input).toBeFocused()
	await expect(input).toHaveAttribute('aria-expanded', 'true')
	await input.fill('member-2'); await input.press('End')
	await expect.poll(() => requested).toBe(true)
	await expect(users(page).locator('.control')).toHaveClass(/is-loading/)
	await page.screenshot({path: info.outputPath('membership-loading.png'), animations: 'disabled'})
	// Open preload results make Escape a picker interaction in both versions.
	await expect(input).toHaveAttribute('aria-expanded', 'true')
	await input.press('Escape')
	release()
	await page.waitForTimeout(350)
	await expect(input).toBeFocused()
	await expect(input).toHaveValue('member-2')
	await expect(input).toHaveAttribute('aria-expanded', 'false')
	await expect(users(page).locator('.control')).not.toHaveClass(/is-loading/)
})
