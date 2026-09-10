import {readFileSync} from 'node:fs'
import {test, expect} from '../../frontend/tests/support/fixtures'

const {VERSION: frontendVersion} = JSON.parse(readFileSync(new URL('../../frontend/src/version.json', import.meta.url), 'utf8'))

for (const closeWith of ['footer', 'escape'] as const) {
	test(`About preserves version content and ${closeWith} close navigation`, async ({authenticatedPage: page, apiContext}, testInfo) => {
		const response = await apiContext.get('info')
		expect(response.ok()).toBe(true)
		const {version: apiVersion} = await response.json()
		await page.goto('/')
		await expect(page.locator('main h1')).toBeVisible()
		await page.locator('.username-dropdown-trigger').click()
		await page.getByRole('link', {name: 'About', exact: true}).click()
		const dialog = page.locator('dialog.hint-modal')
		await expect(dialog).toBeVisible()
		await expect(dialog.locator('.card-header-title')).toHaveText('About')
		await expect(dialog.locator('.card-content p')).toHaveText(apiVersion === frontendVersion
			? [`Version: ${apiVersion}`]
			: [`Frontend version: ${frontendVersion}`, `API version: ${apiVersion}`])
		await page.screenshot({path: testInfo.outputPath('about.png'), animations: 'disabled'})
		if (closeWith === 'footer') {
			await dialog.locator('.card-footer').getByRole('button', {name: 'Close', exact: true}).click()
		} else {
			await page.keyboard.press('Escape')
		}
		await expect(page).toHaveURL(/\/$/)
		await expect(dialog).toHaveCount(0)
	})
}
