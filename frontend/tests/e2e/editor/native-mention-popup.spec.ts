import {test, expect} from '../../support/fixtures'
import {ProjectFactory} from '../../factories/project'
import {TaskFactory} from '../../factories/task'
import {createDefaultViews} from '../project/prepareProjects'

// Supplemental: the frozen mention spec only asserts that typing '@' logs no errors, which a popup
// that never renders would also satisfy. These check the list itself.
test.describe('Native mention popup', () => {
	test.beforeEach(async () => {
		await ProjectFactory.create(1)
		await createDefaultViews(1)
		await TaskFactory.create(1, {id: 1})
	})

	async function commentEditor(page) {
		await page.goto('/tasks/1')
		await page.waitForLoadState('networkidle')

		const editor = page.locator('.task-view .comments .media.comment .tiptap__editor .tiptap.ProseMirror[contenteditable="true"]')
		await expect(editor).toBeVisible({timeout: 10000})
		await editor.click()
		return editor
	}

	test('lists project users with their avatars and inserts the chosen one', async ({authenticatedPage: page}) => {
		const editor = await commentEditor(page)

		await editor.pressSequentially('@', {delay: 50})

		const popup = page.locator('.mention-items')
		await expect(popup).toBeVisible({timeout: 10000})

		const first = popup.locator('.mention-item').first()
		await expect(first).toHaveClass(/is-selected/)
		await expect(first.locator('.mention-avatar img')).toBeVisible({timeout: 10000})

		const chosen = (await first.locator('.mention-name').innerText()).trim()

		await page.keyboard.press('Enter')

		await expect(popup).toBeHidden()
		await expect(editor.locator('.mention-user .mention__label')).toContainText(chosen)
	})

	test('closes on Escape without inserting a mention', async ({authenticatedPage: page}) => {
		const editor = await commentEditor(page)

		await editor.pressSequentially('@', {delay: 50})
		await expect(page.locator('.mention-items')).toBeVisible({timeout: 10000})

		await page.keyboard.press('Escape')

		await expect(page.locator('.mention-items')).toBeHidden()
		await expect(editor.locator('.mention-user')).toHaveCount(0)
	})
})
