import {setupApiUrl} from '../../frontend/tests/support/authenticateUser'
import {writeFile, unlink} from 'node:fs/promises'
import {resolve} from 'node:path'
import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
test.use({serviceWorkers: 'allow'})
for (const width of [1440, 390]) test('install banner visibility dismissal persistence and navigation ' + width, async ({authenticatedPage: page, currentUser}, info) => {
	await ProjectFactory.create(1, {title: 'Install project', owner_id: currentUser.id}); await createDefaultViews(1); await TaskFactory.create(1, {title: 'Install task', created_by_id: currentUser.id})
	await page.setViewportSize({width, height: 900}); await page.goto('/tasks/1'); await expect(page.locator('.task-view h1')).toBeVisible(); const banner = page.locator('.add-to-home-screen')
	if (width === 1440) {await expect(banner).not.toBeVisible(); return}
	await expect(banner).toBeVisible(); await page.screenshot({path: info.outputPath('install-' + width + '.png'), animations: 'disabled'}); await banner.getByRole('button', {name: 'Close banner', exact: true}).focus(); await page.keyboard.press('Enter'); await expect(banner).toHaveCount(0)
	await page.getByRole('navigation', {name: 'Breadcrumb'}).getByRole('link', {name: 'Install project', exact: true}).click(); await expect(page).toHaveURL(/\/projects\/1/); await expect(banner).toHaveCount(0); await page.reload(); await expect(banner).toHaveCount(0); expect(await page.evaluate(() => localStorage.getItem('hideAddToHomeScreenMessage'))).toBe('true')
})
test('real fixture worker first claim preserves login draft and accepted update reloads once', async ({page}, info) => {
	// Mage serves this generated output. The fixture never enters source or a release build.
	const path = resolve(import.meta.dirname, '../../frontend/dist-dev/migration-worker.js')
	const source = version => `/* Fixture version ${version} */\nself.addEventListener('activate', event => event.waitUntil(self.clients.claim()));\nself.addEventListener('message', event => {if(event.data === 'skipWaiting') self.skipWaiting()});\n`
	await writeFile(path, source(1))
	try {
		await setupApiUrl(page); await page.setViewportSize({width: 390, height: 900}); await page.goto('/login'); const username = page.locator('#username'); await username.fill('Retained login draft')
		let navigations = 0; page.on('request', request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++})
		await page.evaluate(async () => {await navigator.serviceWorker.register('/migration-worker.js', {updateViaCache: 'none'}); await navigator.serviceWorker.ready})
		await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true); expect(navigations).toBe(0); await expect(username).toHaveValue('Retained login draft')
		await writeFile(path, source(2)); await page.evaluate(async () => {const registration = await navigator.serviceWorker.getRegistration(); await registration!.update()})
		await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed')
		await page.evaluate(async () => document.dispatchEvent(new CustomEvent('swUpdated', {detail: await navigator.serviceWorker.getRegistration()})))
		await expect(page.locator('.update-notification')).toBeVisible(); await expect(username).toHaveValue('Retained login draft'); await page.screenshot({path: info.outputPath('worker-update-mobile.png'), animations: 'disabled'})
		await page.locator('.update-notification button').focus(); await page.keyboard.press('Enter'); await expect.poll(() => navigations).toBe(1); await expect(username).toHaveValue(''); await expect(page.locator('.update-notification')).toHaveCount(0)
		await page.evaluate(async () => {for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()})
	} finally {await unlink(path).catch(() => {})}
})
