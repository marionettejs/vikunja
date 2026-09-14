import {test, expect} from '../../support/fixtures'
import {TeamFactory} from '../../factories/team'
import {TeamMemberFactory} from '../../factories/team_member'

test('Marionette team toolbar preserves formatting through validation and saving', async ({authenticatedPage: page}) => {
	await TeamFactory.create(1, {id: 1, description: '<p>Original description</p>'})
	await TeamMemberFactory.create(1, {team_id: 1, admin: true})
	await page.goto('/teams/1/edit')

	const toolbar = page.locator('.mn-editor-toolbar[role="toolbar"]')
	const editor = page.locator('.rich-text-editor .ProseMirror')
	await expect(toolbar).toBeVisible()
	await expect(editor).toBeVisible()
	const first = toolbar.locator('button[data-command="heading1"]')
	await first.focus()
	await page.keyboard.press('ArrowRight')
	await expect(toolbar.locator('button[data-command="heading2"]')).toBeFocused()
	await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1)
	await page.keyboard.press('Tab')
	await expect(toolbar.locator('button[data-command="heading2"]')).not.toBeFocused()

	await editor.fill('Preserved toolbar text')
	await editor.selectText()
	await toolbar.locator('button[data-command="bold"]').click()
	await expect(editor.locator('strong')).toHaveText('Preserved toolbar text')

	await expect(editor).toBeFocused()
	const name = page.locator('input#teamtext')
	await name.fill('')
	await expect(name).toHaveValue('')
	await expect(editor.locator('strong')).toHaveText('Preserved toolbar text')
	await page.locator('.save-button').click()
	await expect(page.locator('.error-message')).toBeVisible()
	await expect(toolbar).toBeVisible()
	await expect(editor.locator('strong')).toHaveText('Preserved toolbar text')

	await name.fill('Toolbar verification team')
	await page.locator('.save-button').click()
	await expect(page.locator('.global-notification')).toContainText('Success')
	await page.reload()
	await expect(name).toHaveValue('Toolbar verification team')
	await expect(editor.locator('strong')).toHaveText('Preserved toolbar text')
	await page.goto('/teams')
	await expect(toolbar).toHaveCount(0)
})
