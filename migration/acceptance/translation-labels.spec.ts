import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
import {proContract} from './pro-contract-fixture'

test.beforeEach(async () => {
	await ProjectFactory.create(2, {title: id => `Label project ${id}`})
	await createDefaultViews(1)
	await TaskFactory.create(1, {title: 'Label task', done: true})
	await BucketFactory.create(1, {title: 'Label bucket', project_view_id: 4})
	await TaskBucketFactory.create(1, {task_id: 1, bucket_id: 1, project_view_id: 4})
})

test('Done badge bucket removal and project search render translated labels', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/4')
	await expect(page.locator('.kanban-card .is-done')).toHaveText('Done')
	await page.goto('/projects/1/settings/views')
	await page.getByRole('button', {name: 'Create view', exact: true}).click()
	const form = page.locator('form').filter({has: page.getByRole('textbox', {name: 'Title', exact: true})}).last()
	await form.getByRole('combobox', {name: 'Kind', exact: true}).selectOption('kanban')
	await form.locator('input[value=filter]').check()
	await form.getByRole('button', {name: 'Create a bucket', exact: true}).click()
	await expect(form.getByRole('button', {name: 'Delete the bucket', exact: true})).toBeVisible()
	await page.screenshot({path: info.outputPath('bucket-label.png'), animations: 'disabled'})
	await page.goto('/tasks/1')
	await page.getByRole('button', {name: 'Move', exact: true}).click()
	await expect(page.getByPlaceholder('Type to search for a project…', {exact: true})).toBeVisible()
	await page.screenshot({path: info.outputPath('move-placeholder.png'), animations: 'disabled'})
})

test('malformed duplicate response renders Error and preserves the form', async ({authenticatedPage: page}, info) => {
	await page.route('**/api/v1/projects/1/duplicate', route => route.fulfill({json: {}}))
	await page.goto('/projects/1/settings/duplicate')
	await page.getByRole('button', {name: 'Duplicate', exact: true}).last().click()
	await expect(page.locator('.native-project-duplicate [data-error]')).toHaveText('Error')
	await expect(page.getByRole('button', {name: 'Duplicate', exact: true}).last()).toBeEnabled()
	await expect(page).toHaveURL(/\/projects\/1\/settings\/duplicate$/)
	await page.screenshot({path: info.outputPath('duplicate-error.png'), animations: 'disabled'})
})

test('avatar canvas failure renders Error without publishing an upload', async ({authenticatedPage: page}, info) => {
	await page.goto('/user/settings/avatar')
	if (info.project.use.viewport?.width === 390) {
		const banner = page.locator('.add-to-home-screen')
		await expect(banner).toBeVisible()
		await banner.getByRole('button', {name: 'Close banner', exact: true}).click()
		await expect(banner).toBeHidden()
	}
	await page.getByRole('radio', {name: 'Upload', exact: true}).check()
	const image = await page.evaluate(() => {
		const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80
		canvas.getContext('2d')!.fillRect(0, 0, 160, 80)
		return canvas.toDataURL().split(',')[1]
	})
	await page.locator('input[type=file]').setInputFiles({name: 'label-avatar.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64')})
	const upload = page.getByRole('button', {name: 'Upload Avatar', exact: true})
	await expect(upload).toBeEnabled()
	let writes = 0
	page.on('request', request => {if (request.url().endsWith('/user/settings/avatar/upload') && request.method() === 'PUT') writes++})
	await page.evaluate(() => {HTMLCanvasElement.prototype.toBlob = callback => callback(null)})
	await upload.click()
	await expect(page.getByRole('alert').filter({hasText: /^Error$/})).toBeVisible()
	await expect(upload).toBeEnabled()
	expect(writes).toBe(0)
	await expect(page.locator('body')).not.toContainText('misc.error')
	await page.screenshot({path: info.outputPath('avatar-error.png'), animations: 'disabled'})
})

test('frontend contract admin and time error controls render Retry and recover', async ({authenticatedPage: page}, info) => {
	const contract = await proContract(page)
	for (const [path, endpoint] of [['/admin', '/admin/overview'], ['/admin/users', '/admin/users'], ['/time-tracking', '/time-entries']]) {
		if (path === '/time-tracking') {
			// The shell also requests running timers. Reject the entries list, not that request.
			let reject = true
			await page.route('**/api/v2/time-entries?**', route => {
				if (reject && new URL(route.request().url()).searchParams.get('per_page') === '250') {
					reject = false
					return route.fulfill({status: 503, json: {message: 'Isolated frontend contract rejection'}})
				}
				return route.fallback()
			})
		} else contract.rejectNext(endpoint)
		await page.goto(path)
		const retry = page.getByRole('button', {name: 'Retry', exact: true})
		await expect(retry).toBeVisible()
		await expect(page.getByRole('alert').filter({hasText: 'Isolated frontend contract rejection'})).toBeVisible()
		await page.screenshot({path: info.outputPath(path.replaceAll('/', '-') + '-retry.png'), animations: 'disabled'})
		await retry.click()
		await expect(retry).toBeHidden()
	}
})

test('remaining frontend contract routes render Retry and complete a successful request', async ({authenticatedPage: page}, info) => {
	const contract = await proContract(page)
	for (const [path, endpoint] of [['/admin/users', '/admin/users'], ['/time-tracking', '/time-entries']]) {
		if (path === '/time-tracking') {
			// The shell also requests running timers. Reject the entries list, not that request.
			let reject = true
			await page.route('**/api/v2/time-entries?**', route => {
				if (reject && new URL(route.request().url()).searchParams.get('per_page') === '250') {
					reject = false
					return route.fulfill({status: 503, json: {message: 'Isolated frontend contract rejection'}})
				}
				return route.fallback()
			})
		} else contract.rejectNext(endpoint)
		await page.goto(path)
		const retry = page.getByRole('button', {name: 'Retry', exact: true})
		const error = page.getByRole('alert').filter({hasText: 'Isolated frontend contract rejection'})
		await expect(retry).toBeVisible()
		await expect(error).toBeVisible()
		await page.screenshot({path: info.outputPath(path.replaceAll('/', '-') + '-retry.png'), animations: 'disabled'})
		const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(endpoint) && response.request().method() === 'GET' && response.ok())
		await retry.click()
		expect((await response).status()).toBe(200)
		await expect(error).toBeHidden()
		await expect(retry).toBeHidden()
	}
})

test('import status rejection renders Retry and recovers', async ({authenticatedPage: page}, info) => {
	let reject = true
	await page.route('**/api/v2/migration/planka/status', route => reject ? route.fulfill({status: 503, json: {message: 'Label status failure'}}) : route.fulfill({json: {started_at: null, finished_at: null}}))
	await page.goto('/migrate/planka')
	const retry = page.getByRole('button', {name: 'Retry', exact: true})
	await expect(retry).toBeVisible()
	await page.screenshot({path: info.outputPath('import-retry.png'), animations: 'disabled'})
	reject = false
	await retry.click()
	await expect(retry).toBeHidden()
})

test('successful attachment clipboard copy is silent in original and current app', async ({authenticatedPage: page}, info) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
	await page.goto('/tasks/1')
	const chooser = page.waitForEvent('filechooser')
	await page.getByRole('button', {name: 'Add Attachments', exact: true}).click()
	await (await chooser).setFiles({name: 'label-copy.txt', mimeType: 'text/plain', buffer: Buffer.from('Isolated clipboard label fixture')})
	const copy = page.getByRole('button', {name: 'Copy the url of this attachment for usage in text', exact: true})
	await expect(copy).toBeVisible()
	await expect(page.locator('.vue-notification.success')).toHaveCount(0, {timeout: 10000})
	await copy.click()
	await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/tasks\/1\/attachments\/\d+$/)
	await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
	await expect(page.locator('.vue-notification.success')).toHaveCount(0)
	await expect(page.locator('body')).not.toContainText('misc.copied')
	await page.screenshot({path: info.outputPath('clipboard-silent.png'), animations: 'disabled'})
})
