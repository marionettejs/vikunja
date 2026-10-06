import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {faker} from '@faker-js/faker'

faker.seed(42)
const original = 'Prepare migration checkpoint'

test.beforeEach(async ({authenticatedPage: page}) => {
	await ProjectFactory.create(1, {title: 'Migration project', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: original, description: 'Review the representative pilot.', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
})

for (const width of [1440, 390]) {
	test(`list, detail, keyboard save, reload and cancel at ${width}`, async ({authenticatedPage: page}, testInfo) => {
		await page.setViewportSize({width, height: 900})
		const writes: unknown[] = []
		page.on('request', request => {
			if (request.method() === 'POST' && /\/tasks\/1$/.test(request.url())) writes.push(request.postDataJSON())
		})
		await page.goto('/projects/1/1')
		await expect(page.locator('.tasks .task .tasktext').first()).toContainText(original)
		await page.screenshot({path: testInfo.outputPath('list.png'), animations: 'disabled'})
		await page.locator('.tasks .task .tasktext').first().click()
		const title = page.locator('.task-view h1.title.input')
		await expect(title).toHaveText(original)
		await expect(title).toHaveAttribute('contenteditable', 'true')
		await expect(page.locator('.vue-notification.error')).toHaveCount(0)
		await page.screenshot({path: testInfo.outputPath('detail.png'), animations: 'disabled'})
		await title.fill('Reviewed pilot')
		await expect(title).toBeFocused()
		await title.press('Enter')
		await expect(page.locator('.heading')).toContainText('Saved!')
		await expect(title).not.toBeFocused()
		expect(writes).toHaveLength(1)
		expect(writes[0]).toMatchObject({title: 'Reviewed pilot'})
		await page.reload()
		await expect(title).toHaveText('Reviewed pilot')
		await title.fill('Discard this draft')
		await title.press('Escape')
		await expect(title).toHaveText('Reviewed pilot')
		expect(writes).toHaveLength(1)
		await testInfo.attach('writes', {body: JSON.stringify(writes), contentType: 'application/json'})
	})
}

test('delayed save displays loading and preserves title node and focus', async ({authenticatedPage: page}, testInfo) => {
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(original)
	let release!: () => void
	const pending = new Promise<void>(resolve => { release = resolve })
	await page.route('**/tasks/1', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		await pending
		await route.fulfill({response})
	})
	await title.fill('Delayed title')
	await title.press('Enter')
	await expect(page.locator('.heading')).toContainText('Saving…')
	await title.focus()
	const node = await title.elementHandle()
	await page.screenshot({path: testInfo.outputPath('saving.png'), animations: 'disabled'})
	release()
	await expect(page.locator('.heading')).toContainText('Saved!')
	await expect(title).toBeFocused()
	expect(await title.evaluate((element, old) => element === old, node)).toBe(true)
})

test('failed save retains draft and permits retry', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(original)
	await page.route('**/tasks/1', route => route.request().method() === 'POST'
		? route.fulfill({status: 500, json: {message: 'Fixture failure'}})
		: route.continue())
	await title.fill('Retry this title')
	await title.press('Enter')
	await expect(page.locator('.global-notification')).toBeVisible()
	await expect(title).toHaveText('Retry this title')
	await page.unroute('**/tasks/1')
	await title.focus()
	await title.press('Enter')
	await expect(page.locator('.heading')).toContainText('Saved!')
})

test('empty title and composing Enter never publish a write', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(original)
	const writes: string[] = []
	page.on('request', request => {
		if (request.method() === 'POST' && /\/tasks\/1$/.test(request.url())) writes.push(request.url())
	})
	await title.fill('Composition draft')
	await title.dispatchEvent('keydown', {key: 'Enter', isComposing: true})
	await expect(title).toBeFocused()
	await title.press('Escape')
	await expect(title).toHaveText(original)
	await title.fill(' ')
	await title.press('Enter')
	await expect(title).toHaveText(original)
	await expect(page.locator('.global-notification')).toContainText('title')
	expect(writes).toHaveLength(0)
})

test('navigation destroys the pending editor and a late response cannot replace the next task', async ({authenticatedPage: page}) => {
	await TaskFactory.create(1, {id: 2, title: 'Second task'}, false)
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(original)
	let release!: () => void
	let settled!: () => void
	const delivered = new Promise<void>(resolve => { settled = resolve })
	const pending = new Promise<void>(resolve => { release = resolve })
	await page.route('**/tasks/1', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		await pending
		await route.fulfill({response}).catch(() => {})
		settled()
	})
	await title.fill('Late task one title')
	await title.press('Enter')
	await expect(page.locator('.heading')).toContainText('Saving…')
	await page.getByRole('button', {name: 'Back to project'}).click()
	await page.locator('.tasks .task .tasktext').filter({hasText: 'Second task'}).click()
	await expect(title).toHaveText('Second task')
	release()
	await delivered
	await expect(page.locator('.heading')).not.toContainText('Saved!')
	await expect(title).toHaveText('Second task')
})

test('a second changed-title blur during a delayed save publishes the second edit', async ({authenticatedPage: page}, testInfo) => {
	await page.goto('/tasks/1')
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(original)
	const writes: unknown[] = []
	let release!: () => void
	let settled!: () => void
	const held = new Promise<void>(resolve => { release = resolve })
	const delivered = new Promise<void>(resolve => { settled = resolve })
	let count = 0
	await page.route('**/tasks/1', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		writes.push(route.request().postDataJSON())
		if (++count !== 1) return route.continue()
		const response = await route.fetch()
		await held
		await route.fulfill({response}).catch(() => {})
		settled()
	})
	await title.fill('First submitted title')
	await title.press('Enter')
	await expect(page.locator('.heading')).toContainText('Saving…')
	await title.fill('Second submitted title')
	await title.press('Enter')
	await expect.poll(() => writes.length).toBe(2)
	expect(writes[0]).toMatchObject({title: 'First submitted title'})
	expect(writes[1]).toMatchObject({title: 'Second submitted title'})
	await expect(page.locator('.heading')).toContainText('Saved!')
	release()
	await delivered
	await testInfo.attach('title-after-late-response', {body: await title.innerText(), contentType: 'text/plain'})
	await page.reload()
	await expect(title).toHaveText('Second submitted title')
})
