import { test, expect } from './fixtures'
import { ProjectFactory } from '../../frontend/tests/factories/project'
import { TaskFactory } from '../../frontend/tests/factories/task'
import { createDefaultViews } from '../../frontend/tests/e2e/project/prepareProjects'
import { TaskReminderFactory } from '../../frontend/tests/factories/task_reminders'
import { UserFactory } from '../../frontend/tests/factories/user'
import { UserProjectFactory } from '../../frontend/tests/factories/users_project'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const file = {
	name: 'local-fixture.txt',
	mimeType: 'text/plain',
	buffer: Buffer.from('Isolated Vikunja attachment fixture\n'),
}
const attachments = (page) =>
	page
		.locator('.task-view .attachments')
		.filter({ has: page.locator('.files') })
		.last()
const row = (page, name = file.name) =>
	page.locator('.attachment').filter({has:page.locator('.filename').filter({hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))})})
const reminderPopup = (page) =>
	page.locator('.reminder-options-popup').filter({ visible: true }).last()
const repeat = (page) => page.locator('.repeat-after-input')
async function headers(page) {
	return {
		Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`,
	}
}
async function task(page, apiContext, id = 1) {
	const r = await apiContext.get(`tasks/${id}`, {
		headers: await headers(page),
	})
	expect(r.ok()).toBe(true)
	const data = await r.json()
	data.attachments ??= []
	data.reminders ??= []
	return data
}
async function upload(page, files = file) {
	const chooser = page.waitForEvent('filechooser')
	await page
		.getByRole('button', { name: 'Add Attachments', exact: true })
		.click()
	await (await chooser).setFiles(files)
}
async function reminder(page) {
	await page.getByRole('button', { name: 'Set Reminders', exact: true }).click()
	await page
		.getByRole('button', { name: 'Add a reminder…', exact: true })
		.click()
}
async function openRepeat(page) {
	await page
		.getByRole('button', { name: 'Set Repeating Interval', exact: true })
		.click()
	await expect(repeat(page)).toBeVisible()
}
const api = (response, path, method) =>
	new URL(response.url()).pathname === `/api/v1${path}` &&
	response.request().method() === method
const error = (page) =>
	page.getByRole('alert').or(page.locator('.vue-notification.error'))
test.beforeEach(async () => {
	await ProjectFactory.create(1, { title: 'Task completeness' })
	await createDefaultViews(1)
	await TaskFactory.create(2, {
		title: (id) => (id === 1 ? 'Completeness task' : 'Next task'),
		description: '<p>Preserved task description</p>',
		priority: 3,
	})
})
for (const width of [1440, 390])
	test(`attachment upload download bytes reload delete and cancel ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 })
		await page.goto('/tasks/1')
		await upload(page)
		await expect(row(page)).toBeVisible()
		const saved = await task(page, apiContext)
		expect(saved.attachments).toHaveLength(1)
		expect(saved.attachments[0]).toMatchObject({
			task_id: 1,
			file: { name: file.name, size: file.buffer.length },
		})
		const download = page.waitForEvent('download')
		await row(page)
			.getByRole('button', { name: 'Download this attachment', exact: true })
			.click()
		const downloaded = await download
		expect(downloaded.suggestedFilename()).toBe(file.name)
		expect(await readFile((await downloaded.path())!)).toEqual(file.buffer)
		await page.reload()
		await expect(row(page)).toBeVisible()
		await info.attach(`attachments-${width}`, {
			body: await page.screenshot(),
			contentType: 'image/png',
		})
		await row(page)
			.getByRole('button', { name: 'Delete this attachment', exact: true })
			.click()
		await page
			.getByRole('dialog')
			.last()
			.getByRole('button', { name: 'Cancel', exact: true })
			.click()
		expect((await task(page, apiContext)).attachments).toHaveLength(1)
		await row(page)
			.getByRole('button', { name: 'Delete this attachment', exact: true })
			.click()
		await page
			.getByRole('dialog')
			.last()
			.getByRole('button', { name: 'Do it!', exact: true })
			.click()
		await expect(row(page)).toHaveCount(0)
		expect((await task(page, apiContext)).attachments).toEqual([])
	})
test('attachment rejection retries and failed deletion retains the real file', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let failed = false
	await page.route('**/api/v1/tasks/1/attachments', (route) => {
		if (!failed && route.request().method() === 'PUT') {
			failed = true
			return route.fulfill({
				status: 503,
				json: { message: 'Fixture upload rejected' },
			})
		}
		return route.continue()
	})
	await page.goto('/tasks/1')
	await upload(page)
	await expect(
		error(page).filter({ hasText: 'Fixture upload rejected' }).first(),
	).toBeVisible()
	expect((await task(page, apiContext)).attachments).toEqual([])
	await upload(page)
	await expect(row(page)).toBeVisible()
	const attachment = (await task(page, apiContext)).attachments[0]
	await page.route(`**/api/v1/tasks/1/attachments/${attachment.id}`, (route) =>
		route.request().method() === 'DELETE'
			? route.fulfill({
					status: 503,
					json: { message: 'Fixture delete rejected' },
				})
			: route.continue(),
	)
	await row(page)
		.getByRole('button', { name: 'Delete this attachment', exact: true })
		.click()
	await page
		.getByRole('dialog')
		.last()
		.getByRole('button', { name: 'Do it!', exact: true })
		.click()
	await expect(
		error(page).filter({ hasText: 'Fixture delete rejected' }).first(),
	).toBeVisible()
	expect((await task(page, apiContext)).attachments).toHaveLength(1)
	await page.unroute(`**/api/v1/tasks/1/attachments/${attachment.id}`)
	await page
		.getByRole('dialog')
		.last()
		.getByRole('button', { name: 'Do it!', exact: true })
		.click()
	await expect(row(page)).toHaveCount(0)
})
test('image attachment preview keyboard zoom cover and description draft persist', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	const image = {
		name: 'local-fixture.jpg',
		mimeType: 'image/jpeg',
		buffer: await readFile(
			resolve(import.meta.dirname, '../../frontend/tests/fixtures/image.jpg'),
		),
	}
	await page.goto('/tasks/1')
	await upload(page, image)
	await expect(row(page, image.name)).toBeVisible()
	await row(page, image.name)
		.getByRole('button', { name: image.name, exact: true })
		.click()
	const dialog = page.getByRole('dialog', {
		name: 'Image preview',
		exact: true,
	})
	await expect(dialog).toBeVisible()
	await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click()
	await expect(dialog.locator('.image-lightbox__level')).not.toHaveText('100%')
	await dialog.press('Escape')
	await expect(dialog).toHaveCount(0)
	await page
		.locator('.tiptap__task-description')
		.getByRole('button', { name: 'Edit', exact: true })
		.click()
	const editor = page
		.locator('.tiptap [contenteditable=true],.tiptap[contenteditable=true]')
		.first()
	await editor.fill('Local description draft')
	await row(page, image.name)
		.getByRole('button', { name: 'Make cover', exact: true })
		.click()
	await expect(row(page, image.name)).toContainText('Cover image')
	await expect(editor).toContainText('Local description draft')
	const saved = await task(page, apiContext)
	expect(saved.cover_image_attachment_id).toBe(saved.attachments[0].id)
	expect(saved.description).toBe('<p>Preserved task description</p>')
	await row(page, image.name)
		.getByRole('button', { name: 'Remove cover', exact: true })
		.click()
	await expect(row(page, image.name)).not.toContainText('Cover image')
	expect((await task(page, apiContext)).cover_image_attachment_id ?? 0).toBe(0)
})
test('navigation during accepted upload cannot attach into next task or notify', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let release!: () => void, ready!: () => void
	const gate = new Promise<void>((r) => (release = r)),
		started = new Promise<void>((r) => (ready = r))
	await page.route('**/api/v1/tasks/1/attachments', async (route) => {
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
	})
	await page.goto('/tasks/1')
	await upload(page)
	await started
	await page.evaluate(() => {
		history.pushState({}, '', '/tasks/2')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	release()
	await page.evaluate(
		() =>
			new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
	)
	await expect(row(page)).toHaveCount(0)
	expect((await task(page, apiContext)).attachments).toHaveLength(1)
	expect((await task(page, apiContext, 2)).attachments).toEqual([])
})
test('readonly attachments allow download but deny upload delete and cover', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto('/tasks/1')
	await upload(page)
	await expect(row(page)).toBeVisible()
	await UserFactory.create(1, { id: 2, username: 'fixture-owner' }, false)
	await ProjectFactory.create(1, {
		id: 1,
		title: 'Task completeness',
		owner_id: 2,
	})
	await UserProjectFactory.create(1, {
		project_id: 1,
		user_id: 1,
		permission: 0,
	})
	await page.reload()
	await expect(row(page)).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Add Attachments', exact: true }),
	).toBeHidden()
	await expect(
		page.getByRole('button', { name: 'Upload attachment', exact: true }),
	).toBeHidden()
	await expect(
		row(page).getByRole('button', {
			name: 'Delete this attachment',
			exact: true,
		}),
	).toHaveCount(0)
	const saved = await task(page, apiContext)
	const denied = await apiContext.delete(
		`tasks/1/attachments/${saved.attachments[0].id}`,
		{ headers: await headers(page) },
	)
	expect(denied.status()).toBe(403)
})
test('relative reminder preset custom start date remove and reload persist', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await TaskFactory.create(1, {
		id: 1,
		title: 'Completeness task',
		due_date: '2026-12-04T15:00:00Z',
		start_date: '2026-12-02T15:00:00Z',
		description: '<p>Preserved task description</p>',
	})
	await page.goto('/tasks/1')
	await reminder(page)
	await reminderPopup(page)
		.getByRole('button', { name: '1 day before Due Date', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: '1 day before Due Date', exact: true }),
	).toBeVisible()
	expect((await task(page, apiContext)).reminders[0]).toMatchObject({
		relative_to: 'due_date',
		relative_period: -86400,
		reminder: '2026-12-03T15:00:00Z',
	})
	await page
		.getByRole('button', { name: 'Add a reminder…', exact: true })
		.click()
	await reminderPopup(page)
		.getByRole('button', { name: 'Custom', exact: true })
		.click()
	const form = reminderPopup(page).locator('.reminder-period')
	await form.locator('input').fill('2')
	await form
		.getByRole('combobox', { name: 'Time unit', exact: true })
		.selectOption('hours')
	await form
		.getByRole('combobox', { name: 'Relative to', exact: true })
		.selectOption('start_date')
	await reminderPopup(page)
		.getByRole('button', { name: 'Confirm', exact: true })
		.click()
	await expect(
		page.getByRole('button', {
			name: '2 hours before Start Date',
			exact: true,
		}),
	).toBeVisible()
	expect((await task(page, apiContext)).reminders).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				relative_to: 'start_date',
				relative_period: -7200,
				reminder: '2026-12-02T13:00:00Z',
			}),
		]),
	)
	await page.reload()
	await expect(
		page.getByRole('button', {
			name: '2 hours before Start Date',
			exact: true,
		}),
	).toBeVisible()
	await page
		.locator('.reminder-input')
		.filter({has:page.getByRole('button',{name:'1 day before Due Date',exact:true})})
		.getByRole('button', { name: 'Remove this reminder', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: '1 day before Due Date', exact: true }),
	).toHaveCount(0)
	expect((await task(page, apiContext)).reminders).toHaveLength(1)
})
test('repeat presets modes remove reload and completion advance real dates', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	const due = new Date()
	due.setUTCDate(due.getUTCDate() + 2)
	due.setUTCHours(15, 0, 0, 0)
	await TaskFactory.create(1, {
		id: 1,
		title: 'Completeness task',
		due_date: due.toISOString(),
		description: '<p>Preserved task description</p>',
	})
	await page.goto('/tasks/1')
	await openRepeat(page)
	const saved = page.waitForResponse((r) => api(r, '/tasks/1', 'POST'))
	await repeat(page)
		.getByRole('button', { name: 'Every Day', exact: true })
		.click()
	expect((await saved).request().postDataJSON()).toMatchObject({
		repeat_after: 86400,
		repeat_mode: 0,
	})
	await page.reload()
	await expect(repeat(page).locator('input')).toHaveValue('1')
	await page
		.getByRole('button', { name: 'Mark task done!', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: 'Mark task done!', exact: true }),
	).toBeVisible()
	const result = await task(page, apiContext)
	expect(result.done).toBe(false)
	expect(new Date(result.due_date).getTime()).toBe(due.getTime() + 86400000)
	await repeat(page).locator('#repeatMode').selectOption('1')
	await expect(repeat(page).locator('input')).toBeHidden()
	await page.reload()
	expect((await task(page, apiContext)).repeat_mode).toBe(1)
	await page
		.getByRole('button', { name: 'Remove repeat interval', exact: true })
		.click()
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_after)
		.toBe(0)
	expect((await task(page, apiContext)).repeat_mode).toBe(0)
})
test.describe('absolute reminders in a non-UTC browser', () => {
	test.use({ timezoneId: 'America/New_York' })
	test('absolute calendar confirms local time once and Escape discards a later draft', async ({
		authenticatedPage: page,
		apiContext,
	}) => {
		await page.goto('/tasks/1')
		await reminder(page)
		const popup = reminderPopup(page)
		await expect(popup.locator('.flatpickr-calendar')).toBeVisible()
		await popup
			.getByRole('button')
			.filter({ hasText: 'Tomorrow' })
			.first()
			.click()
		const hour = popup.locator('.flatpickr-hour'),
			minute = popup.locator('.flatpickr-minute')
		await hour.fill('10')
		await hour.press('Tab')
		await minute.fill('30')
		await minute.press('Tab')
		const selected = await popup
			.locator('.flatpickr-calendar')
			.evaluate((el) =>
				(
					el.querySelector('.flatpickr-day.selected') as HTMLElement
				)?.getAttribute('aria-label'),
			)
		expect(selected).toBeTruthy()
		expect((await task(page, apiContext)).reminders).toEqual([])
		const saved = page.waitForResponse((r) => api(r, '/tasks/1', 'POST'))
		await popup
			.getByRole('button', { name: 'Confirm', exact: true })
			.last()
			.click()
		expect((await saved).request().postDataJSON().reminders[0]).toMatchObject({
			relative_to: null,
			relative_period: 0,
		})
		const actual = (await task(page, apiContext)).reminders[0]
		const local = await page.evaluate((value) => {
			const d = new Date(value)
			return [d.getHours(), d.getMinutes()]
		}, actual.reminder)
		expect(local).toEqual([10, 30])
		await page
			.getByRole('button', { name: 'Add a reminder…', exact: true })
			.click()
		await reminderPopup(page)
			.getByRole('button')
			.filter({ hasText: 'Tomorrow' })
			.first()
			.click()
		await reminderPopup(page).locator('.flatpickr-hour').press('Escape')
		await expect(reminderPopup(page)).toHaveCount(0)
		expect((await task(page, apiContext)).reminders).toHaveLength(1)
		await page.reload()
		expect((await task(page, apiContext)).reminders).toHaveLength(1)
	})
})
test('repeat error retry retains amount and later field draft during accepted write', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	let failed = false
	await page.route('**/api/v1/tasks/1', (route) => {
		if (!failed && route.request().method() === 'POST') {
			failed = true
			return route.fulfill({
				status: 503,
				json: { message: 'Fixture repeat rejected' },
			})
		}
		return route.continue()
	})
	await page.goto('/tasks/1')
	await openRepeat(page)
	await repeat(page)
		.getByRole('button', { name: 'Every Week', exact: true })
		.click()
	await expect(
		error(page).filter({ hasText: 'Fixture repeat rejected' }).first(),
	).toBeVisible()
	await expect(repeat(page).locator('input')).toHaveValue('1')
	expect((await task(page, apiContext)).repeat_after).toBe(0)
	await repeat(page)
		.getByRole('button', { name: 'Every Week', exact: true })
		.click()
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_after)
		.toBe(604800)
	let release!: () => void, ready!: () => void
	const gate = new Promise<void>((r) => (release = r)),
		started = new Promise<void>((r) => (ready = r))
	await page.route('**/api/v1/tasks/1', async (route) => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
	})
	await repeat(page)
		.getByRole('button', { name: 'Every Day', exact: true })
		.click()
	await started
	const amount = repeat(page).locator('input')
	await amount.fill('5')
	release()
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_after)
		.toBe(86400)
	await expect(amount).toHaveValue('5')
	await expect(amount).toBeFocused()
	await amount.press('Tab')
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_after)
		.toBe(432000)
})
test('reminder rejection keeps editable draft and navigation cancels pending timing publication', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await TaskFactory.create(2, {
		title: (id) => (id === 1 ? 'Completeness task' : 'Next task'),
		due_date: '2026-12-04T15:00:00Z',
	})
	let failed = false
	await page.route('**/api/v1/tasks/1', (route) => {
		if (!failed && route.request().method() === 'POST') {
			failed = true
			return route.fulfill({
				status: 503,
				json: { message: 'Fixture reminder rejected' },
			})
		}
		return route.continue()
	})
	await page.goto('/tasks/1')
	await reminder(page)
	await reminderPopup(page)
		.getByRole('button', { name: '1 day before Due Date', exact: true })
		.click()
	await expect(
		error(page).filter({ hasText: 'Fixture reminder rejected' }).first(),
	).toBeVisible()
	await page
		.getByRole('button', { name: '1 day before Due Date', exact: true })
		.click()
	await reminderPopup(page)
		.getByRole('button', { name: '1 day before Due Date', exact: true })
		.click()
	await expect
		.poll(async () => (await task(page, apiContext)).reminders.length)
		.toBe(1)
	await expect(page.locator('.vue-notification.success')).toHaveCount(0, {
		timeout: 8000,
	})
	let release!: () => void, ready!: () => void
	const gate = new Promise<void>((r) => (release = r)),
		started = new Promise<void>((r) => (ready = r))
	await page.route('**/api/v1/tasks/1', async (route) => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
	})
	await page
		.getByRole('button', { name: 'Add a reminder…', exact: true })
		.click()
	await reminderPopup(page)
		.getByRole('button', { name: '2 hours before Due Date', exact: true })
		.click()
	await started
	await page.evaluate(() => {
		history.pushState({}, '', '/tasks/2')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	release()
	await page.evaluate(
		() =>
			new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
	)
	expect((await task(page, apiContext)).reminders).toHaveLength(2)
	expect((await task(page, apiContext, 2)).reminders).toEqual([])
	await expect(page.locator('.vue-notification.success')).toHaveCount(0)
})
test('readonly repeat and reminders cannot mutate through keyboard or presets', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await TaskFactory.create(2, {
		title: (id) => (id === 1 ? 'Completeness task' : 'Next task'),
		repeat_after: 86400,
		repeat_mode: 0,
		due_date: '2026-12-04T15:00:00Z',
	})
	await UserFactory.create(1, { id: 2, username: 'fixture-owner' }, false)
	await ProjectFactory.create(1, {
		id: 1,
		title: 'Task completeness',
		owner_id: 2,
	})
	await UserProjectFactory.create(1, {
		project_id: 1,
		user_id: 1,
		permission: 0,
	})
	await TaskReminderFactory.create(1, {
		task_id: 1,
		relative_to: 'due_date',
		relative_period: -86400,
		reminder: '2026-12-03T15:00:00Z',
	})
	await page.goto('/tasks/1')
	await expect(
		page.getByRole('button', { name: '1 day before Due Date', exact: true }),
	).toBeDisabled()
	await expect(
		page.getByRole('button', { name: 'Add a reminder…', exact: true }),
	).toBeDisabled()
	await expect(repeat(page).locator('input')).toBeDisabled()
	await expect(repeat(page).locator('#repeatMode')).toBeDisabled()
	await expect(
		repeat(page).getByRole('button', { name: 'Every Day', exact: true }),
	).toBeDisabled()
	const denied = await apiContext.post('tasks/1', {
		headers: await headers(page),
		data: { ...(await task(page, apiContext)), repeat_after: 172800 },
	})
	expect(denied.status()).toBe(403)
	expect((await task(page, apiContext)).repeat_after).toBe(86400)
})
test('failed binary download reports error and retries with original bytes', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto('/tasks/1')
	await upload(page)
	await expect(row(page)).toBeVisible()
	const a = (await task(page, apiContext)).attachments[0]
	await page.route(`**/api/v1/tasks/1/attachments/${a.id}`, (route) =>
		route.fulfill({
			status: 503,
			json: { message: 'Fixture download rejected' },
		}),
	)
	await row(page)
		.getByRole('button', { name: 'Download this attachment', exact: true })
		.click()
	await expect(
		error(page)
			.filter({ hasText: /Fixture download rejected|503/ })
			.first(),
	).toBeVisible()
	await page.unroute(`**/api/v1/tasks/1/attachments/${a.id}`)
	const download = page.waitForEvent('download')
	await row(page)
		.getByRole('button', { name: 'Download this attachment', exact: true })
		.click()
	expect(await readFile((await (await download).path())!)).toEqual(file.buffer)
})
test('pending binary response cannot download after task navigation', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto('/tasks/1')
	await upload(page)
	await expect(row(page)).toBeVisible()
	const a = (await task(page, apiContext)).attachments[0]
	let release!: () => void, ready!: () => void, finished!: () => void
	const gate = new Promise<void>((r) => (release = r)),
		started = new Promise<void>((r) => (ready = r)),
		done = new Promise<void>((r) => (finished = r))
	const downloads: string[] = []
	page.on('download', (d) => downloads.push(d.suggestedFilename()))
	await page.route(`**/api/v1/tasks/1/attachments/${a.id}`, async (route) => {
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
		finished()
	})
	await row(page)
		.getByRole('button', { name: 'Download this attachment', exact: true })
		.click()
	await started
	await page.evaluate(() => {
		history.pushState({}, '', '/tasks/2')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	release()
	await done
	await page.evaluate(
		() =>
			new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
	)
	expect(downloads).toEqual([])
	await expect(page.locator('.vue-notification.error')).toHaveCount(0)
})
test('repeat from current date uses backend time and monthly completion shifts one calendar month', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await TaskFactory.create(1, {
		id: 1,
		title: 'Completeness task',
		due_date: '2026-01-15T15:00:00Z',
	})
	await page.goto('/tasks/1')
	await openRepeat(page)
	await repeat(page)
		.getByRole('button', { name: 'Every Day', exact: true })
		.click()
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_after)
		.toBe(86400)
	await repeat(page).locator('#repeatMode').selectOption('2')
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_mode)
		.toBe(2)
	const before = Date.now()
	const saved = page.waitForResponse((r) => api(r, '/tasks/1', 'POST'))
	await page
		.getByRole('button', { name: 'Mark task done!', exact: true })
		.click()
	await saved
	const current = await task(page, apiContext)
	expect(current.done).toBe(false)
	expect(new Date(current.due_date).getTime()).toBeGreaterThanOrEqual(
		before + 86400000 - 1000,
	)
	expect(new Date(current.due_date).getTime()).toBeLessThanOrEqual(
		Date.now() + 86400000 + 1000,
	)
	await repeat(page).locator('#repeatMode').selectOption('1')
	await expect
		.poll(async () => (await task(page, apiContext)).repeat_mode)
		.toBe(1)
	const previous = await task(page, apiContext)
	const completion = page.waitForResponse((r) => api(r, '/tasks/1', 'POST'))
	await page
		.getByRole('button', { name: 'Mark task done!', exact: true })
		.click()
	await completion
	const monthly = await task(page, apiContext),
		expected = new Date(previous.due_date)
	expected.setUTCMonth(expected.getUTCMonth() + 1)
	expect(new Date(monthly.due_date).getTime()).toBe(expected.getTime())
	expect(monthly.done).toBe(false)
})
test('dropping local files uploads once and leaves the description intact', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto('/tasks/1')
	await expect(page.locator('.task-view h1')).toHaveText('Completeness task')
	const response = page.waitForResponse((r) =>
		api(r, '/tasks/1/attachments', 'PUT'),
	)
	await page.locator('.task-view .subtitle').evaluate((el) => {
		const data = new DataTransfer()
		data.items.add(
			new File(['Isolated drag fixture'], 'local-drop.txt', {
				type: 'text/plain',
			}),
		)
		el.dispatchEvent(
			new DragEvent('dragover', { bubbles: true, dataTransfer: data }),
		)
		el.dispatchEvent(
			new DragEvent('drop', { bubbles: true, dataTransfer: data }),
		)
	})
	expect((await response).ok()).toBe(true)
	await expect(row(page, 'local-drop.txt')).toBeVisible()
	const saved = await task(page, apiContext)
	expect(saved.attachments).toHaveLength(1)
	expect(saved.description).toBe('<p>Preserved task description</p>')
})
test('local PDF preview closes and pending preview cannot reopen after navigation', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	const pdf = {
		name: 'local-fixture.pdf',
		mimeType: 'application/pdf',
		buffer: await readFile(
			resolve(import.meta.dirname, '../../frontend/tests/fixtures/test.pdf'),
		),
	}
	await page.goto('/tasks/1')
	await upload(page, pdf)
	await expect(row(page, pdf.name)).toBeVisible()
	await row(page, pdf.name)
		.getByRole('button', { name: pdf.name, exact: true })
		.click()
	const iframe = page.locator('.pdf-preview-iframe')
	await expect(iframe).toHaveAttribute('src', /^blob:/)
	await page
		.getByRole('dialog')
		.last()
		.getByRole('button', { name: 'Close dialog', exact: true })
		.click()
	await expect(iframe).toHaveCount(0)
	const a = (await task(page, apiContext)).attachments[0]
	let release!: () => void, ready!: () => void, finished!: () => void
	const gate = new Promise<void>((r) => (release = r)),
		started = new Promise<void>((r) => (ready = r)),
		done = new Promise<void>((r) => (finished = r))
	await page.route(`**/api/v1/tasks/1/attachments/${a.id}`, async (route) => {
		const response = await route.fetch()
		ready()
		await gate
		await route.fulfill({ response }).catch(() => {})
		finished()
	})
	await row(page, pdf.name)
		.getByRole('button', { name: pdf.name, exact: true })
		.click()
	await started
	await page.evaluate(() => {
		history.pushState({}, '', '/tasks/2')
		window.dispatchEvent(new PopStateEvent('popstate'))
	})
	await expect(page.locator('.task-view h1')).toHaveText('Next task')
	release()
	await done
	await page.evaluate(
		() =>
			new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
	)
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(iframe).toHaveCount(0)
})
test('multiple local uploads retain the second attachment and avatar after deleting the first', async ({
	authenticatedPage: page,
	apiContext,
}) => {
	const second = {
		name: 'second-local-fixture.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('Second isolated fixture\n'),
	}
	await page.goto('/tasks/1')
	await upload(page, [file, second])
	await expect(row(page)).toBeVisible()
	await expect(row(page, second.name)).toBeVisible()
	expect((await task(page, apiContext)).attachments).toHaveLength(2)
	await row(page)
		.getByRole('button', { name: 'Delete this attachment', exact: true })
		.click()
	await page
		.getByRole('dialog')
		.last()
		.getByRole('button', { name: 'Do it!', exact: true })
		.click()
	await expect(row(page)).toHaveCount(0)
	await expect(row(page, second.name)).toBeVisible()
	await expect(
		row(page, second.name).locator('.avatar-wrapper > *').first(),
	).toBeVisible()
	const download = page.waitForEvent('download')
	await row(page, second.name)
		.getByRole('button', { name: 'Download this attachment', exact: true })
		.click()
	expect(await readFile((await (await download).path())!)).toEqual(
		second.buffer,
	)
	expect(
		(await task(page, apiContext)).attachments.map((a) => a.file.name),
	).toEqual([second.name])
})
