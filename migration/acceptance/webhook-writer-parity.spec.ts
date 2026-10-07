import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
for (const width of [1440, 390]) test('project writer can create and delete supported webhooks ' + width, async ({authenticatedPage: page, currentUser}, info) => {
 await UserFactory.create(1, {id: 101, username: 'webhook-owner'}, false)
 await ProjectFactory.create(1, {title: 'Writer project', owner_id: 101}); await createDefaultViews(1)
 await UserProjectFactory.create(1, {user_id: currentUser.id, project_id: 1, permission: 1})
 await TaskFactory.create(1, {created_by_id: 101, description: '<p>Writer task</p>'})
 await page.setViewportSize({width, height: 900}); await page.goto('/projects/1/settings/webhooks')
 const field = page.getByRole('textbox', {name: 'Target URL', exact: true})
 await expect(field).toBeVisible(); await field.fill('https://fixture.invalid/writer')
 const event = page.getByRole('checkbox', {name: /^(?:Checkbox\s+)?task\.updated$/}); await event.focus(); await event.press('Space'); await expect(event).toBeChecked(); await expect(event).toBeFocused()
 const created = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/v1/projects/1/webhooks')
 await page.getByRole('button', {name: 'Create webhook', exact: true}).click(); const response = await created; expect(response.ok()).toBe(true)
 expect(response.request().postDataJSON()).toMatchObject({target_url: 'https://fixture.invalid/writer', events: ['task.updated']})
 await expect(page.getByRole('cell', {name: 'https://fixture.invalid/writer', exact: true})).toBeVisible(); await page.reload(); await expect(page.getByRole('cell', {name: 'https://fixture.invalid/writer', exact: true})).toBeVisible()
 const creator = page.getByRole('row').filter({has: page.getByRole('cell', {name: 'https://fixture.invalid/writer', exact: true})}).getByRole('cell').nth(3)
 await expect(creator).toContainText(currentUser.username)
 const avatar = creator.locator('img.avatar'); await expect(avatar).toBeVisible()
 await expect.poll(() => avatar.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
 const avatarBox = await avatar.boundingBox(); expect(avatarBox?.width).toBe(25); expect(avatarBox?.height).toBe(25)
 await info.attach('writer-webhook', {body: await page.screenshot({animations: 'disabled'}), contentType: 'image/png'})
 await page.getByRole('button', {name: 'Delete this webhook', exact: true}).click()
 const deleted = page.waitForResponse(response => response.request().method() === 'DELETE' && /\/api\/v1\/projects\/1\/webhooks\/\d+$/.test(new URL(response.url()).pathname))
 await page.getByRole('button', {name: 'Do it!', exact: true}).click(); expect((await deleted).ok()).toBe(true); await expect(field).toBeVisible(); await page.reload(); await expect(field).toBeVisible(); await expect(page.getByRole('cell', {name: 'https://fixture.invalid/writer', exact: true})).toHaveCount(0)
 await info.attach('writer-api', {body: JSON.stringify({createStatus: response.status(), payload: response.request().postDataJSON()}, null, 2), contentType: 'application/json'})
})
