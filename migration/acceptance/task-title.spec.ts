import {test, expect} from '../../frontend/tests/support/fixtures'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {UserFactory} from '../../frontend/tests/factories/user'
import {LinkShareFactory} from '../../frontend/tests/factories/link_sharing'
import {createProjects} from '../../frontend/tests/e2e/project/prepareProjects'
import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'

async function createTask() {
	const [project] = await createProjects()
	const [task] = await TaskFactory.create(1, {
		project_id: project.id,
		title: 'Review the project plan',
	})
	return {project, task}
}

for (const width of [1440, 390]) {
	test(`Task title saves on Enter and persists at ${width}px`, async ({authenticatedPage: page}, testInfo) => {
		const {task} = await createTask()
		await page.setViewportSize({width, height: 900})
		await page.goto(`/tasks/${task.id}`)
		const title = page.locator('.task-view h1.title.input')
		await expect(title).toHaveText(task.title)
		await title.fill('Updated project plan')
		const saved = page.waitForResponse(response => response.url().endsWith(`/tasks/${task.id}`) && response.request().method() === 'POST')
		await title.press('Enter')
		expect((await saved).ok()).toBe(true)
		await expect(page.locator('.heading')).toContainText('Saved')
		await page.reload()
		await expect(title).toHaveText('Updated project plan')
		const box = await title.boundingBox()
		expect(box).not.toBeNull()
		expect(box!.x).toBeGreaterThanOrEqual(0)
		expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
		await page.screenshot({path: testInfo.outputPath(`task-title-${width}.png`), animations: 'disabled'})
	})
}

test('Task title cancels on Escape and rejects an empty blur without saving', async ({authenticatedPage: page}) => {
	const {task} = await createTask()
	await page.goto(`/tasks/${task.id}`)
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(task.title)
	const writes: string[] = []
	page.on('request', request => {
		if (request.url().endsWith(`/tasks/${task.id}`) && request.method() === 'POST') writes.push(request.postData() ?? '')
	})
	await title.fill('Discard this draft')
	await title.press('Escape')
	await expect(title).toHaveText(task.title)
	await expect(page.locator('.task-view')).toBeVisible()
	await title.fill('   ')
	await title.press('Tab')
	await expect(title).toHaveText(task.title)
	await expect(page.locator('.global-notification')).toContainText('title')
	expect(writes).toEqual([])
	await page.reload()
	await expect(title).toHaveText(task.title)
})

test('Task title retains a failed draft and can retry saving it', async ({authenticatedPage: page}) => {
	const {task} = await createTask()
	await page.goto(`/tasks/${task.id}`)
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(task.title)
	await page.route(`**/tasks/${task.id}`, async route => {
		if (route.request().method() === 'POST') {
			await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Title save unavailable'})})
		} else {
			await route.continue()
		}
	})
	await title.fill('Keep this draft')
	await title.press('Enter')
	await expect(page.locator('.global-notification')).toContainText('Title save unavailable')
	await expect(title).toHaveText('Keep this draft')
	await page.unroute(`**/tasks/${task.id}`)
	await title.focus()
	const saved = page.waitForResponse(response => response.url().endsWith(`/tasks/${task.id}`) && response.request().method() === 'POST')
	await title.press('Enter')
	expect((await saved).ok()).toBe(true)
	await expect(page.locator('.heading')).toContainText('Saved')
	await page.reload()
	await expect(title).toHaveText('Keep this draft')
})

test('An earlier save response preserves the next draft, focus and selection', async ({authenticatedPage: page}) => {
	const {task} = await createTask()
	await page.goto(`/tasks/${task.id}`)
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(task.title)
	let releaseResponse!: () => void
	const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
	let requestStarted!: () => void
	const requestGate = new Promise<void>(resolve => { requestStarted = resolve })
	await page.route(`**/tasks/${task.id}`, async route => {
		if (route.request().method() !== 'POST') return route.continue()
		const response = await route.fetch()
		requestStarted()
		await responseGate
		await route.fulfill({response})
	})
	try {
		await title.fill('First saved draft')
		await title.press('Enter')
		await requestGate
		await title.fill('Second unsaved draft')
		const original = await title.elementHandle()
		await title.evaluate(el => {
			const range = document.createRange()
			range.setStart(el.firstChild!, 2)
			range.setEnd(el.firstChild!, 6)
			const selection = window.getSelection()!
			selection.removeAllRanges()
			selection.addRange(range)
		})
		releaseResponse()
		await expect(page.locator('.heading')).toContainText('Saved')
		await expect(title).toHaveText('Second unsaved draft')
		expect(await title.evaluate((el, previous) => el === previous, original)).toBe(true)
		await expect(title).toBeFocused()
		expect(await title.evaluate(el => {
			const selection = window.getSelection()!
			return {
				owned: selection.anchorNode === el.firstChild && selection.focusNode === el.firstChild,
				start: selection.anchorOffset,
				end: selection.focusOffset,
			}
		})).toEqual({owned: true, start: 2, end: 6})
		await title.press('Escape')
		await expect(title).toHaveText('First saved draft')
	} finally {
		releaseResponse()
	}
})

test('Read-only task shares keep the title non-editable', async ({page}) => {
	await setupApiUrl(page)
	await UserFactory.create()
	const {project, task} = await createTask()
	const [share] = await LinkShareFactory.create(1, {project_id: project.id, permission: 0})
	await page.goto(`/tasks/${task.id}#share-auth-token=${share.hash}`)
	const title = page.locator('.task-view h1.title.input')
	await expect(title).toHaveText(task.title)
	await expect(title).toHaveClass(/disabled/)
	await expect(title).not.toHaveAttribute('contenteditable')
	await expect(title).not.toHaveAttribute('tabindex')
})
