import {test, expect} from './cookie-fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

async function seed() {
	await ProjectFactory.create(1, {title: 'Bootstrap project'})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'Bootstrap task', project_id: 1})
}

for (const width of [1280, 390]) test('slow bootstrap preserves the pinned logo loading contract and latest deep link ' + width, async ({authenticatedPage: page}, info) => {
	await seed()
	await page.setViewportSize({width, height: 720})
	let release!: () => void, started!: () => void
	const gate = new Promise<void>(done => {release = done}), seen = new Promise<void>(done => {started = done})
	await page.route('**/api/v1/info', async route => {started(); await gate; await route.continue().catch(() => {})})
	try {
		await page.goto('/projects/1/1', {waitUntil: 'domcontentloaded'}); await seen
		await expect(page.getByText('Vikunja is loading…', {exact: true})).toBeVisible()
		await expect(page.locator('.add-to-home-screen')).toHaveCount(0)
		await expect(page.locator('.vikunja-loading .logo')).toBeVisible()
		await expect.poll(() => page.locator('.vikunja-loading .loader-container').evaluate(element => {
			const spinner = getComputedStyle(element, '::after')
			return {width: spinner.width, height: spinner.height, border: spinner.borderTopWidth, animated: spinner.animationName !== 'none'}
		})).toEqual({width: '24px', height: '24px', border: '2px', animated: true})
		await page.screenshot({path: info.outputPath('boot-pending.png'), animations: 'disabled'})
		await page.evaluate(() => {history.pushState({}, '', '/tasks/1'); window.dispatchEvent(new PopStateEvent('popstate'))})
	} finally {release()}
	await expect(page.locator('.task-view h1')).toContainText('Bootstrap task')
	await expect(page.locator('.vikunja-loading')).toHaveCount(0)
	await expect(page).toHaveURL(/\/tasks\/1$/)
	if (width === 390) await expect(page.locator('.add-to-home-screen')).toBeVisible()
})

test('failed bootstrap shows API recovery and successful public retry reaches the original deep link', async ({authenticatedPage: page}) => {
	await seed()
	const unavailable = (route: import('@playwright/test').Route) => route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({message: 'Fixture temporarily unavailable'})})
	await page.route('**/api/v1/info', unavailable)
	await page.goto('/projects/1/1')
	await expect(page.getByText('An error occurred:', {exact: false})).toBeVisible()
	await expect(page.locator('.vikunja-loading')).toHaveCount(0)
	await page.unroute('**/api/v1/info', unavailable)
	await page.locator('#api-url').fill(process.env.API_URL!)
	await page.locator('.api-config').getByRole('button', {name: 'change', exact: true}).click()
	await expect(page.locator('.tasks')).toContainText('Bootstrap task')
	await expect(page.locator('#api-url')).toHaveCount(0)
	await expect(page).toHaveURL(/\/projects\/1\/1$/)
})

test('leaving a pending bootstrap cancels the old document and cannot publish into the new task document', async ({authenticatedPage: page}) => {
	await seed()
	let release!: () => void, started!: () => void
	const gate = new Promise<void>(done => {release = done}), seen = new Promise<void>(done => {started = done})
	await page.route('**/api/v1/info', async route => {started(); await gate; await route.continue().catch(() => {})}, {times: 1})
	try {
		await page.goto('/projects/1/1', {waitUntil: 'domcontentloaded'}); await seen
		await expect(page.getByText('Vikunja is loading…', {exact: true})).toBeVisible()
		await page.goto('/tasks/1', {waitUntil: 'domcontentloaded'})
	} finally {release()}
	await expect(page.locator('.task-view h1')).toContainText('Bootstrap task')
	await expect(page.locator('.tasks')).toHaveCount(0)
	await expect(page).toHaveURL(/\/tasks\/1$/)
})
