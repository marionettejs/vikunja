import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async () => {
	await ProjectFactory.create(1, {title: 'Announcement project'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'Announcement task', priority: 3})
})
test('success and error notices use one polite announcement owner', async ({authenticatedPage: page}, info) => {
	await page.goto('/tasks/1')
	const banner = page.locator('.add-to-home-screen')
	if (await banner.isVisible()) await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
	const priority = page.getByRole('combobox', {name: 'Priority', exact: true})
	const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/tasks/1' && response.request().method() === 'POST')
	await priority.selectOption('4')
	expect((await response).ok()).toBe(true)
	const success = page.locator('.global-notification .vue-notification.success')
	await expect(success).toContainText('The task was saved successfully.')
	await expect(success).toBeVisible()
	for (const notice of [success]) {
		expect(await notice.getAttribute('role')).toBeNull()
		await expect(notice.locator('xpath=ancestor::*[@role="status"]').last()).toHaveAttribute('aria-live', 'polite')
	}
	await success.click()
	await expect(success).toHaveCount(0)
	await page.route('**/api/v1/tasks/1', route => route.request().method() === 'POST'
		? route.fulfill({status: 503, json: {message: 'Isolated announcement rejection'}}) : route.continue())
	const rejected = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/tasks/1' && response.request().method() === 'POST')
	await priority.selectOption('5')
	expect((await rejected).status()).toBe(503)
	const error = page.locator('.global-notification .vue-notification.error')
	await expect(error).toContainText('Isolated announcement rejection')
	await expect(error).toBeVisible()
	expect(await error.getAttribute('role')).toBeNull()
	await expect(error.locator('xpath=ancestor::*[@role="status"]').last()).toHaveAttribute('aria-live', 'polite')
	await page.screenshot({path: info.outputPath('error-announcement.png'), animations: 'disabled'})
	await error.click()
	await expect(error).toHaveCount(0)
})
