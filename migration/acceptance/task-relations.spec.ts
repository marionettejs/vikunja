import { test, expect } from './fixtures'
import { ProjectFactory } from '../../frontend/tests/factories/project'
import { TaskFactory } from '../../frontend/tests/factories/task'
import { TaskRelationFactory } from '../../frontend/tests/factories/task_relation'
import { BucketFactory } from '../../frontend/tests/factories/bucket'
import { TaskBucketFactory } from '../../frontend/tests/factories/task_buckets'
import { UserFactory } from '../../frontend/tests/factories/user'
import { UserProjectFactory } from '../../frontend/tests/factories/users_project'
import { createDefaultViews } from '../../frontend/tests/e2e/project/prepareProjects'
const section = (page) => page.locator('.task-relations')
const row = (page, title: string) =>
	section(page).locator('.related-tasks .task').filter({ hasText: title })
async function headers(page) {
	return {
		Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`,
	}
}
async function task(page, apiContext, id = 1) {
	const response = await apiContext.get(`tasks/${id}`, {
		headers: await headers(page),
	})
	expect(response.ok()).toBe(true)
	return response.json()
}
async function activate(page) {
	await page.getByRole('button', { name: 'Add Relation', exact: true }).click()
	await expect(section(page).getByRole('combobox').first()).toBeFocused()
}
async function choose(page, title = 'Existing child') {
	const input = section(page).getByPlaceholder(
		'Type search for a task to add as related…',
	)
	await input.fill(title)
	await input.press('ArrowLeft')
	const existing = section(page).getByRole('option').filter({hasText: `#2 ${title}`}).first()
	await expect(existing).toBeVisible()
	await existing.press('Enter')
}
async function add(page) {
	await section(page)
		.getByRole('button', { name: 'Add a New Task Relation', exact: true })
		.last()
		.click()
}
const confirm = (page) =>
	page
		.getByRole('dialog')
		.last()
		.getByRole('button', { name: 'Do it!', exact: true })
		.click()
test.beforeEach(async () => {
	await ProjectFactory.create(1, { title: 'Relation project' })
	await createDefaultViews(1)
	await TaskFactory.create(3, {
		title: (id: number) =>
			['Parent task', 'Existing child', 'Next task'][id - 1],
		description: '<p>Preserved relation description</p>',
		priority: 3,
	})
})
for (const width of [1440, 390])
	test(`task subtask relation keyboard completion removal and inverse persist ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 })
		await page.goto('/tasks/1')
		await activate(page)
		await choose(page)
		await section(page)
			.getByRole('combobox', { name: 'Select a relation kind', exact: true })
			.selectOption('subtask')
		await add(page)
		await expect(row(page, 'Existing child')).toBeVisible()
		expect((await task(page, apiContext)).related_tasks.subtask).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 2 })]),
		)
		expect((await task(page, apiContext, 2)).related_tasks.parenttask).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 1 })]),
		)
		await page.reload()
		await expect(row(page, 'Existing child')).toBeVisible()
		await row(page, 'Existing child').locator('.base-checkbox__label').click()
		await expect(
			row(page, 'Existing child').locator('input[type=checkbox]'),
		).toBeChecked()
		expect(await task(page, apiContext, 2)).toMatchObject({
			done: true,
			priority: 3,
			description: '<p>Preserved relation description</p>',
		})
		await info.attach(`relations-${width}`, {
			body: await page.screenshot(),
			contentType: 'image/png',
		})
		await row(page, 'Existing child')
			.getByRole('button', { name: 'Delete Task Relation', exact: true })
			.click()
		await page
			.getByRole('dialog')
			.last()
			.getByRole('button', { name: 'Cancel', exact: true })
			.click()
		expect((await task(page, apiContext)).related_tasks.subtask).toHaveLength(1)
		await row(page, 'Existing child')
			.getByRole('button', { name: 'Delete Task Relation', exact: true })
			.click()
		await confirm(page)
		await expect(row(page, 'Existing child')).toHaveCount(0)
		expect((await task(page, apiContext)).related_tasks.subtask ?? []).toEqual(
			[],
		)
		expect(
			(await task(page, apiContext, 2)).related_tasks.parenttask ?? [],
		).toEqual([])
	})
test('create-and-relate magic task retries rejected relation without duplicating accepted task', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let failed = false
	await page.route('**/api/v1/tasks/1/relations', (route) => {
		if (!failed && route.request().method() === 'PUT') {
			failed = true
			return route.fulfill({
				status: 503,
				json: { message: 'Fixture relation unavailable' },
			})
		}
		return route.continue()
	})
	await page.goto('/tasks/1')
	await activate(page)
	await section(page)
		.getByRole('combobox', { name: 'Select a relation kind', exact: true })
		.selectOption('subtask')
	const input = section(page).getByPlaceholder(
		'Type search for a task to add as related…',
	)
	await input.fill('Created relation child !3 *relationlabel')
	await input.press('ArrowLeft')
	await input.press('Escape')
	await add(page)
	await expect(
		page
			.getByRole('alert')
			.filter({ hasText: 'Fixture relation unavailable' })
			.first(),
	).toBeVisible()
	const response = await apiContext.get('tasks', {
		headers: await headers(page),
		params: { s: 'Created relation child' },
	})
	expect(response.ok()).toBe(true)
	const created = await response.json()
	expect(created).toHaveLength(1)
	expect(created[0]).toMatchObject({ project_id: 1, priority: 3 })
	expect(created[0].labels).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ title: 'relationlabel' }),
		]),
	)
	await add(page)
	await expect(row(page, 'Created relation child')).toBeVisible()
	expect(
		(await task(page, apiContext)).related_tasks.subtask.map((item) => item.id),
	).toEqual([created[0].id])
	const retried = await apiContext.get('tasks', {
		headers: await headers(page),
		params: { s: 'Created relation child' },
	})
	expect(await retried.json()).toHaveLength(1)
})
test('delayed accepted relation retains later focused search and selected kind', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let release!: () => void, ready!: () => void
	const gate = new Promise<void>((resolve) => (release = resolve)),
		started = new Promise<void>((resolve) => (ready = resolve))
	await page.route('**/api/v1/tasks/1/relations', async (route) => {
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
	})
	await page.goto('/tasks/1')
	await activate(page)
	await choose(page)
	const kind = section(page).getByRole('combobox', {
		name: 'Select a relation kind',
		exact: true,
	})
	await kind.selectOption('subtask')
	await add(page)
	await started
	const input = section(page).getByPlaceholder(
		'Type search for a task to add as related…',
	)
	await input.fill('Later relation draft')
	await kind.selectOption('blocking')
	await input.focus()
	release()
	await expect(row(page, 'Existing child')).toBeVisible()
	await expect(input).toHaveValue('Later relation draft')
	await expect(input).toBeFocused()
	await expect(kind).toHaveValue('blocking')
	expect((await task(page, apiContext)).related_tasks.subtask).toHaveLength(1)
})
test('stopping task detail during accepted relation prevents next task publication', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let release!: () => void, ready!: () => void, finished!: () => void
	const gate = new Promise<void>((resolve) => (release = resolve)),
		started = new Promise<void>((resolve) => (ready = resolve)),
		done = new Promise<void>((resolve) => (finished = resolve))
	await page.route('**/api/v1/tasks/1/relations', async (route) => {
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
		finished()
	})
	await page.goto('/tasks/1')
	await activate(page)
	await choose(page)
	await add(page)
	await started
	await page.evaluate(() => {
		history.pushState({}, '', '/tasks/3')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	release()
	await done
	await page.evaluate(
		() =>
			new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			),
	)
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	await expect(section(page)).toHaveCount(0)
	expect((await task(page, apiContext)).related_tasks.related).toHaveLength(1)
})
test('readonly task relations display without controls and backend denies mutation', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 2, username: 'relation-owner' }, false)
	await ProjectFactory.create(1, {
		id: 1,
		title: 'Relation project',
		owner_id: 2,
	})
	await UserProjectFactory.create(1, {
		project_id: 1,
		user_id: 1,
		permission: 0,
	})
	await TaskRelationFactory.create(2, {
		id: (id: number) => id,
		task_id: (id: number) => id,
		other_task_id: (id: number) => (id === 1 ? 2 : 1),
		relation_kind: (id: number) => (id === 1 ? 'subtask' : 'parenttask'),
	})
	await page.goto('/tasks/1')
	await expect(row(page, 'Existing child')).toBeVisible()
	await expect(
		row(page, 'Existing child').locator('input[type=checkbox]'),
	).toBeDisabled()
	await expect(
		section(page).getByRole('button', {
			name: 'Delete Task Relation',
			exact: true,
		}),
	).toHaveCount(0)
	await expect(
		page.getByRole('button', { name: 'Add Relation', exact: true }),
	).toBeHidden()
	const denied = await apiContext.put('tasks/1/relations', {
		headers: await headers(page),
		data: { other_task_id: 3, relation_kind: 'related' },
	})
	expect(denied.status()).toBe(403)
	expect((await task(page, apiContext)).related_tasks.subtask).toHaveLength(1)
})
test('related task navigation from modal preserves the project backdrop', async ({
	authenticatedPage: page,
}) => {
	await TaskRelationFactory.create(2, {
		id: (id: number) => id,
		task_id: (id: number) => id,
		other_task_id: (id: number) => (id === 1 ? 2 : 1),
		relation_kind: (id: number) => (id === 1 ? 'subtask' : 'parenttask'),
	})
	await BucketFactory.create(1, {
		title: 'Relation bucket',
		project_view_id: 4,
	})
	await TaskBucketFactory.create(3, {
		task_id: (id) => id,
		bucket_id: 1,
		project_view_id: 4,
	})
	await page.goto('/projects/1/4')
	await page
		.locator('.kanban-card__title-link')
		.filter({ hasText: 'Parent task' })
		.click()
	await expect(page.getByRole('dialog').last()).toBeVisible()
	await row(page, 'Existing child').getByRole('link').click()
	await expect(page.getByRole('dialog').last().locator('.task-view h1')).toHaveText('Existing child')
	await expect(page.getByRole('dialog').last()).toBeVisible()
	await page
		.getByRole('button', { name: 'Close dialog', exact: true })
		.last()
		.click()
	await expect(page.getByRole('dialog').last().locator('.task-view h1')).toHaveText('Parent task')
	await expect(page.getByRole('dialog').last()).toBeVisible()
	await page.getByRole('button', {name: 'Close dialog', exact: true}).last().click()
	await expect(page).toHaveURL(/\/projects\/1\/4$/)
	await expect(page.locator('.kanban')).toContainText('Parent task')
})
