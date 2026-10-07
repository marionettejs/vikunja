import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {proContract} from './pro-contract-fixture'

test.beforeEach(async () => {await ProjectFactory.create(1, {title: 'Recovery project'})})
for (const [path, endpoint] of [['/admin', '/admin/overview'], ['/admin/users', '/admin/users'], ['/admin/projects', '/admin/projects']]) {
	test(`admin recovery hides Retry while pending and after success ${path}`, async ({authenticatedPage: page}, info) => {
		const contract = await proContract(page)
		const retry = page.getByRole('button', {name: 'Retry', exact: true})
		const error = page.getByRole('alert').filter({hasText: 'Isolated frontend contract rejection'})
		contract.rejectNext(endpoint)
		await page.goto(path)
		await expect(retry).toBeVisible()
		await expect(error).toBeVisible()
		const firstCount = contract.calls.filter(call => call.path.endsWith(endpoint)).length
		contract.holdNext(endpoint)
		const accepted = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(endpoint) && response.ok())
		await retry.focus()
		await retry.press('Enter')
		await expect.poll(() => contract.calls.filter(call => call.path.endsWith(endpoint)).length).toBe(firstCount + 1)
		await expect(page.locator('[data-admin-body] [data-loading]')).toBeVisible()
		await expect(error).toBeHidden()
		await expect(retry).toBeHidden()
		contract.release()
		expect((await accepted).status()).toBe(200)
		await expect(page.locator('[data-admin-body] [data-loading]')).toBeHidden()
		await expect(retry).toBeHidden()
		await expect(error).toBeHidden()
		await expect(page.locator(path === '/admin' ? '[data-results] .admin-overview__card' : '[data-admin-body] tbody tr').first()).toBeVisible()
		await page.screenshot({path: info.outputPath('recovered.png'), animations: 'disabled'})
		// A later rejection must offer Retry again; this is not a one-shot hide.
		contract.rejectNext(endpoint)
		await page.reload()
		await expect(error).toBeVisible()
		await expect(retry).toBeVisible()
		const recovered = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(endpoint) && response.ok())
		await retry.click()
		expect((await recovered).status()).toBe(200)
		await expect(error).toBeHidden()
		await expect(retry).toBeHidden()
	})
}
