import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
	await ProjectFactory.create(1, {title: 'Single-use Undo'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'Single-use task', done: false})
})
test('double clicking fading Undo sends exactly one accepted write', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.goto('/projects/1/1')
	const banner = page.locator('.add-to-home-screen')
	if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
	const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/tasks/1' && response.request().method() === 'POST')
	await page.locator('.tasks .single-task .base-checkbox__label').click()
	expect((await saved).ok()).toBe(true)
	const notice = page.locator('.global-notification .vue-notification').filter({hasText: 'The task was successfully marked as done.'})
	await expect(notice).toBeVisible()
	await expect.poll(() => notice.evaluate(row => Number(getComputedStyle(row).opacity))).toBe(1)
	let writes = 0
	page.on('request', request => {
		if (new URL(request.url()).pathname === '/api/v1/tasks/1' && request.method() === 'POST' && request.postDataJSON().done === false) writes++
	})
	const accepted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/tasks/1' && response.request().method() === 'POST')
	await notice.getByRole('button', {name: 'Undo', exact: true}).dblclick()
	expect((await accepted).ok()).toBe(true)
	await expect(notice).toHaveCount(0)
	await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
	expect(writes).toBe(1)
	const task = await apiContext.get('tasks/1', {headers: {Authorization: `Bearer ${userToken}`}})
	expect(task.ok()).toBe(true)
	expect((await task.json()).done).toBe(false)
})
