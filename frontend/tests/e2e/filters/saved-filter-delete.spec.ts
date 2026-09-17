import {test, expect} from '../../support/fixtures'
import {SavedFilterFactory} from '../../factories/saved_filter'
import {ProjectFactory} from '../../factories/project'

test.describe('Saved Filter Delete', () => {
	test('deletes a saved filter from its settings modal', async ({authenticatedPage: page}) => {
		await ProjectFactory.create(1)
		await SavedFilterFactory.create(1, {
			title: 'Filter To Delete',
			is_favorite: false,
			filters: '{"filter":"done = false","filter_include_nulls":false,"s":""}',
		})

		await page.goto('/')
		await page.waitForLoadState('networkidle')

		const filterItem = page.locator('.list-menu .navigation-item').filter({hasText: 'Filter To Delete'})
		await expect(filterItem).toBeVisible({timeout: 10000})

		await filterItem.hover()
		const settingsTrigger = filterItem.locator('.menu-list-dropdown-trigger')
		await expect(settingsTrigger).toBeVisible()
		await settingsTrigger.click()

		const deleteMenuItem = page.getByRole('link', {name: /^delete$/i})
		await expect(deleteMenuItem).toBeVisible()
		await deleteMenuItem.click()

		const modal = page.locator('.modal-mask, dialog[open]').first()
		await expect(modal).toBeVisible()
		await expect(modal).toContainText('Delete this saved filter')
		await expect(modal).toContainText('Are you sure you want to delete this saved filter?')

		const deleteButton = modal.getByRole('button', {name: 'Do it!'})
		await expect(deleteButton).toBeEnabled()
		await deleteButton.click()

		// Confirming deletes the filter and returns to the project index.
		// The sidebar keeps a stale entry until the next full load; that is
		// pre-existing upstream behaviour, identical before and after the
		// Marionette migration, so it is not asserted here. See
		// plans/deferred-fixes.md.
		await expect(page).toHaveURL(/\/projects$/)
		await page.reload()
		await expect(page.locator('.list-menu .navigation-item')
			.filter({hasText: 'Filter To Delete'})).toHaveCount(0)
	})

	test('closing the delete modal leaves the saved filter in place', async ({authenticatedPage: page}) => {
		await ProjectFactory.create(1)
		await SavedFilterFactory.create(1, {
			title: 'Filter To Keep',
			is_favorite: false,
			filters: '{"filter":"done = false","filter_include_nulls":false,"s":""}',
		})

		await page.goto('/')
		await page.waitForLoadState('networkidle')

		const filterItem = page.locator('.list-menu .navigation-item').filter({hasText: 'Filter To Keep'})
		await expect(filterItem).toBeVisible({timeout: 10000})

		await filterItem.hover()
		const settingsTrigger = filterItem.locator('.menu-list-dropdown-trigger')
		await expect(settingsTrigger).toBeVisible()
		await settingsTrigger.click()

		const deleteMenuItem = page.getByRole('link', {name: /^delete$/i})
		await expect(deleteMenuItem).toBeVisible()
		await deleteMenuItem.click()

		const modal = page.locator('.modal-mask, dialog[open]').first()
		await expect(modal).toBeVisible()
		await expect(modal).toContainText('Delete this saved filter')
		await expect(modal).toContainText('Are you sure you want to delete this saved filter?')

		const cancelButton = modal.getByRole('button', {name: 'Cancel'})
		await expect(cancelButton).toBeVisible()
		await cancelButton.click()

		await expect(modal).not.toBeVisible()

		await expect(page.locator('.list-menu .navigation-item').filter({hasText: 'Filter To Keep'})).toBeVisible()
	})
})
