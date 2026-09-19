import {test, expect} from '../../support/fixtures'

test.describe('About dialog', () => {
	test.beforeEach(async ({authenticatedPage: page}) => {
		await page.goto('/about')
	})

	test('shows dialog with about title', async ({authenticatedPage: page}) => {
		await expect(page.locator('.card-header-title')).toHaveText('About')
	})

	test('shows version information', async ({authenticatedPage: page}) => {
		const firstLine = page.locator('.card-content p').first()
		await expect(firstLine).toBeVisible()
		await expect(firstLine).not.toBeEmpty()
	})

	test('closes on footer button click and navigates back', async ({authenticatedPage: page}) => {
		await page.locator('.card-footer').getByRole('button', {name: 'Close'}).click()
		await expect(page).not.toHaveURL(/\/about/)
	})
})
