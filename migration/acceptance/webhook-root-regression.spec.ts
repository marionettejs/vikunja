import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for (const colorScheme of ['light', 'dark'] as const) test('webhook root fix mutation, print and editor return ' + colorScheme, async ({authenticatedPage: page, currentUser}, info) => {
 await page.setViewportSize({width: 390, height: 900}); await page.emulateMedia({colorScheme})
 await ProjectFactory.create(1, {title: 'Webhook regression', owner_id: currentUser.id}); await createDefaultViews(1)
 await TaskFactory.create(1, {created_by_id: currentUser.id, description: '<p>Original description</p>'}); await TaskCommentFactory.create(1, {task_id: 1, author_id: currentUser.id, comment: '<p>Original comment</p>'})
 await page.goto('/tasks/1'); await expect(page.locator('.description .ProseMirror')).toHaveText('Original description')
 await page.goto('/projects/1/settings/webhooks')
 const field = page.getByRole('textbox', {name: 'Target URL', exact: true}), dialog = page.locator('dialog[open]')
 await expect(field).toBeVisible(); await field.fill('https://fixture.invalid/retained'); await expect(field).toBeFocused()
 const mutation = await page.addStyleTag({content: 'body:has(dialog[open].native-project-dialog) #app {display:none!important}'})
 await expect(field).not.toBeVisible(); await mutation.evaluate(node => node.remove()); await expect(field).toBeVisible(); await expect(field).toHaveValue('https://fixture.invalid/retained')
 await page.emulateMedia({media: 'print'}); await expect(field).toBeVisible(); await expect(field).toHaveValue('https://fixture.invalid/retained'); await page.emulateMedia({media: 'screen'})
 await info.attach('webhook-fixed', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
 await dialog.getByRole('button', {name: 'Cancel', exact: true}).click(); await expect(page.locator('dialog[open]')).toHaveCount(0); await expect(page.locator('#app')).toBeVisible(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
 await page.goto('/tasks/1'); const row = page.locator('#comment-1'), editor = row.locator('.ProseMirror')
 await row.getByRole('button', {name: 'Edit', exact: true}).click(); await expect(editor).toBeFocused(); await editor.press('ControlOrMeta+A'); await editor.pressSequentially('Draft after webhook'); await expect(editor).toHaveText('Draft after webhook'); await editor.press('Escape'); await expect(editor).toHaveText('Original comment')
})
