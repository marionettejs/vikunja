import {Factory} from '../../frontend/tests/support/factory'
import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
const reactions = page => page.locator('.task-view .reactions.details')
const add = page => reactions(page).getByRole('button', {name: 'Add your reaction', exact: true})
test.beforeEach(async ({currentUser}) => {
	await ProjectFactory.create(1, {title: 'Reaction project', owner_id: currentUser.id})
	await createDefaultViews(1)
	await TaskFactory.create(2, {title: id => 'Reaction task ' + id, description: '<p>Original description</p>', created_by_id: currentUser.id})
})
for (const width of [1440, 390]) test('task reaction keyboard picker add reload remove ' + width, async ({authenticatedPage: page}, info) => {
	await page.setViewportSize({width, height: 900}); await page.goto('/tasks/1')
	await add(page).focus(); await page.keyboard.press('Enter')
	const picker = reactions(page).locator('emoji-picker'); await expect(picker).toBeVisible()
	const emoji = picker.locator('button[title="grinning face"]'); await emoji.focus(); await page.keyboard.press('Enter')
	await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toBeVisible(); await expect(picker).toHaveCount(0)
	await page.screenshot({path: info.outputPath('task-reactions-' + width + '.png'), animations: 'disabled'})
	await page.reload(); const reaction = reactions(page).getByRole('button', {name: '😀 1', exact: true})
	await expect(reaction).toBeVisible(); await reaction.focus(); await page.keyboard.press('Enter'); await expect(reaction).toHaveCount(0)
	await page.reload(); await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toHaveCount(0)
})
test('reaction failure preserves picker and description draft for retry', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1'); const description = page.locator('.description .ProseMirror'); await page.locator('.description').getByRole('button', {name: 'Edit', exact: true}).click(); await description.fill('Unsaved description draft')
	await page.route('**/api/v1/tasks/1/reactions', route => route.request().method() === 'PUT' ? route.fulfill({status: 500, json: {message: 'Reaction fixture rejection'}}) : route.continue())
	await add(page).click(); const picker = reactions(page).locator('emoji-picker'); await picker.locator('button[title="grinning face"]').click()
	await expect(page.locator('.vue-notification.error')).toContainText('Reaction fixture rejection'); await expect(picker).toBeVisible(); await expect(description).toHaveText('Unsaved description draft')
	await page.unroute('**/api/v1/tasks/1/reactions'); await picker.locator('button[title="grinning face"]').click()
	await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toBeVisible(); await expect(description).toHaveText('Unsaved description draft')
	await page.locator('.description').getByRole('button', {name: 'Save', exact: true}).click(); await page.reload(); await expect(description).toContainText('Unsaved description draft'); await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toBeVisible()
})
test('reaction request cancels on navigation without publishing into another task', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1'); let release, seen; const gate = new Promise<void>(done => {release = done}), requested = new Promise<void>(done => {seen = done}), failures: string[] = []
	page.on('requestfailed', request => {if (/\/tasks\/1\/reactions$/.test(new URL(request.url()).pathname)) failures.push(request.failure()?.errorText || '')})
	await page.route('**/api/v1/tasks/1/reactions', async route => {if (route.request().method() === 'PUT') {seen(); await gate}; try {await route.continue()} catch {/* View cancellation ends interception. */}})
	await add(page).click(); await reactions(page).locator('emoji-picker button[title="grinning face"]').click(); await requested
	await page.getByRole('link', {name: 'Reaction project', exact: true}).first().click(); await expect(page).toHaveURL(/\/projects\/1/); await expect.poll(() => failures.length).toBe(1); release()
	await page.goto('/tasks/2'); await expect(add(page)).toBeVisible(); await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toHaveCount(0); await expect(page.locator('emoji-picker')).toHaveCount(0)
})
test('reader sees reactions but cannot write and the backend rejects a forged reaction', async ({authenticatedPage: page, currentUser, apiContext, userToken}) => {
	const [owner] = await UserFactory.create(1, {id: 101, username: 'reaction-owner'}, false)
	await ProjectFactory.create(1, {id: 2, title: 'Reader reactions', owner_id: owner.id}, false); await UserProjectFactory.create(1, {project_id: 2, user_id: currentUser.id, permission: 0})
	await TaskFactory.create(1, {id: 3, project_id: 2, created_by_id: owner.id}, false)
	await Factory.seed('reactions', [{id: 1, user_id: owner.id, entity_id: 3, entity_kind: 0, value: '😀', created: '2026-01-01T00:00:00Z'}])
	const writes: string[] = []; page.on('request', request => {if (/\/tasks\/3\/reactions/.test(request.url()) && request.method() !== 'GET') writes.push(request.url())})
	await page.goto('/tasks/3'); await expect(page.locator('.task-view h1')).toBeVisible(); await expect(add(page)).toHaveCount(0); await expect(reactions(page).getByRole('button', {name: '😀 1', exact: true})).toBeDisabled(); expect(writes).toEqual([])
	const rejected = await apiContext.put('tasks/3/reactions', {headers: {Authorization: 'Bearer ' + userToken}, data: {value: '😀'}}); expect(rejected.status()).toBe(403)
})
