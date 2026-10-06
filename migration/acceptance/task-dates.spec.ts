import {test, expect} from './fixtures'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'Task dates'})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: index => index === 1 ? 'Alpha task' : 'Beta task', priority: 2, percent_done: 0.3, due_date: '2026-10-20T12:30:00Z', start_date: '2026-10-19T12:30:00Z', end_date: '2026-10-21T12:30:00Z'})
})
function dateColumn(page, name: string) { return page.locator('.details .column').filter({has: page.locator('.detail-title', {hasText: name})}) }
function write(page) { return page.waitForResponse(response => /\/api\/v[12]\/tasks\/1$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST') }
for (const width of [1440, 390]) {
	test(`date calendar time, confirm, clear and reload at ${width}`, async ({authenticatedPage: page}, info) => {
		await page.setViewportSize({width, height: 900})
		await page.goto('/tasks/1')
		const due = dateColumn(page, 'Due Date')
		await expect(page.locator('.details.content.description .tiptap__editor')).toBeVisible()
		await due.locator('.datepicker .show').click()
		const popup = page.getByRole('dialog', {name: 'Click here to set a due date'})
		await expect(popup).toBeVisible()
		await expect(popup.locator('.flatpickr-calendar')).toBeVisible()
		await popup.locator('.flatpickr-minute').fill('42')
		await page.screenshot({path: info.outputPath('task-date-calendar.png'), animations: 'disabled'})
		const saving = write(page)
		await popup.getByRole('button', {name: 'Confirm', exact: true}).click()
		const response = await saving
		expect(response.ok()).toBe(true)
		expect(new Date(response.request().postDataJSON().due_date).getUTCMinutes()).toBe(42)
		await expect(popup).toHaveCount(0)
		await page.reload()
		await due.locator('.datepicker .show').click()
		await expect(popup.locator('.flatpickr-minute')).toHaveValue('42')
		await popup.press('Escape')
		await expect(due.locator('.datepicker .show')).toBeFocused()
		await expect(popup).toHaveCount(0)
		const clearing = write(page)
		await due.getByRole('button', {name: 'Remove due date', exact: true}).click()
		const cleared = await clearing
		expect(cleared.ok()).toBe(true)
		expect(cleared.request().postDataJSON().due_date).toBe(null)
		await page.reload()
		await expect(due).toHaveCount(0)
		await page.getByRole('button', {name: 'Set Due Date', exact: true}).click()
		await expect(due.getByRole('button', {name: 'Click here to set a due date', exact: true})).toBeVisible()
	})
}

test('an open calendar survives another field save without replacing its time input', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const due = dateColumn(page, 'Due Date')
	await due.locator('.datepicker .show').click()
	const popup = page.getByRole('dialog', {name: 'Click here to set a due date'})
	const minute = popup.locator('.flatpickr-minute'), node = await minute.elementHandle()
	await minute.fill('43')
	// Use keyboard selection so the date dialog is not dismissed by an outside click.
	const saving = write(page)
	await page.getByRole('combobox', {name: 'Priority', exact: true}).selectOption('4')
	expect((await saving).ok()).toBe(true)
	await expect(popup).toBeVisible()
	expect(await minute.evaluate((el, old) => el === old, node)).toBe(true)
	await expect(minute).toHaveValue('43')
	const dateSave = write(page)
	await popup.getByRole('button', {name: 'Confirm', exact: true}).click()
	const response = await dateSave
	expect(response.request().postDataJSON().priority).toBe(4)
	expect(new Date(response.request().postDataJSON().due_date).getUTCMinutes()).toBe(43)
})


test('a queued priority write includes the accepted title instead of an older whole-task snapshot', async ({authenticatedPage: page}, info) => {
	let release!: () => void
	const gate = new Promise<void>(resolve => { release = resolve })
	const bodies: Record<string, unknown>[] = []
	await page.route('**/api/*/tasks/1', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		bodies.push(route.request().postDataJSON())
		if (bodies.length === 1) { const response = await route.fetch(); await gate; await route.fulfill({response}) }
		else await route.continue()
	})
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await title.fill('Accepted concurrent title')
	await title.press('Enter')
	await expect.poll(() => bodies.length).toBe(1)
	await page.getByRole('combobox', {name: 'Priority', exact: true}).selectOption('4')
	release()
	await expect.poll(() => bodies.length).toBe(2)
	await test.step('request bodies retain both accepted fields', async () => {
		await info.attach('writes', {body: JSON.stringify(bodies), contentType: 'application/json'})
		expect(bodies[1]).toMatchObject({title: 'Accepted concurrent title', priority: 4})
	})
	await expect(page.locator('.heading')).toContainText('Saved!')
	await page.reload()
	await expect(title).toHaveText('Accepted concurrent title')
	await expect(page.getByRole('combobox', {name: 'Priority', exact: true})).toHaveValue('4')
})

test('description drafts survive another field save and modal close flushes through the task destination', async ({authenticatedPage: page}) => {
	await BucketFactory.create(1, {id: 1, project_view_id: 4})
	await TaskBucketFactory.create(1, {task_id: 1, bucket_id: 1, project_view_id: 4})
	await page.goto('/projects/1/4')
	await page.locator('.kanban .task[data-task-id="1"]').click()
	await expect(page.getByRole('button', {name: 'Close dialog', exact: true})).toBeVisible()
	const editor = page.locator('.details.content.description .tiptap__editor .tiptap.ProseMirror')
	await expect(editor).toBeVisible()
	await editor.fill('A description draft that must survive')
	const prioritySave = write(page)
	await page.getByRole('combobox', {name: 'Priority', exact: true}).selectOption('4')
	expect((await prioritySave).ok()).toBe(true)
	await expect(editor).toContainText('A description draft that must survive')
	const descriptionSave = write(page)
	await page.getByRole('button', {name: 'Close dialog', exact: true}).click()
	const response = await descriptionSave
	expect(response.ok()).toBe(true)
	expect(response.request().postDataJSON()).toMatchObject({priority: 4})
	expect(response.request().postDataJSON().description).toContain('A description draft that must survive')
	await page.goto('/tasks/1')
	await expect(page.locator('.details.content.description')).toContainText('A description draft that must survive')
})


test('a date save preserves a previously accepted task favorite', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const favoriteSave = write(page)
	await page.getByRole('button', {name: 'Add to Favorites', exact: true}).click()
	expect((await favoriteSave).ok()).toBe(true)
	await expect(page.getByRole('button', {name: 'Remove from Favorites', exact: true})).toBeVisible()
	const due = dateColumn(page, 'Due Date')
	await due.locator('.datepicker .show').click()
	const popup = page.getByRole('dialog', {name: 'Click here to set a due date'})
	await popup.locator('.flatpickr-minute').fill('44')
	const dateSave = write(page)
	await popup.getByRole('button', {name: 'Confirm', exact: true}).click()
	expect((await dateSave).request().postDataJSON().is_favorite).toBe(true)
	await page.reload()
	await expect(page.getByRole('button', {name: 'Remove from Favorites', exact: true})).toBeVisible()
})
