import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {ProjectViewFactory} from '../../frontend/tests/factories/project_view'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {TaskBucketFactory} from '../../frontend/tests/factories/task_buckets'
import {UserFactory} from '../../frontend/tests/factories/user'
import {UserProjectFactory} from '../../frontend/tests/factories/users_project'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'
const selector = page => page.getByRole('button', {name: /Kanban bucket:/})
test.beforeEach(async ({currentUser}) => {
	await ProjectFactory.create(2, {title: id => id === 1 ? 'Bucket project' : 'Parent project', owner_id: currentUser.id, parent_project_id: id => id === 1 ? 2 : 0})
	await createDefaultViews(1); await createDefaultViews(2, 5)
	await TaskFactory.create(1, {title: 'Bucket task', description: '<p>Original description</p>', created_by_id: currentUser.id})
	await BucketFactory.create(2, {title: id => id === 1 ? 'Backlog' : 'Doing', project_view_id: 4, position: id => id * 65536})
	await TaskBucketFactory.create(1, {task_id: 1, bucket_id: 1, project_view_id: 4})
})
for (const width of [1440, 390]) test('bucket breadcrumb keyboard selection and reload ' + width, async ({authenticatedPage: page}, info) => {
	await page.setViewportSize({width, height: 900}); await page.goto('/tasks/1'); await expect(page.getByRole('navigation', {name: 'Breadcrumb'})).toContainText('Parent project'); await expect(selector(page)).toContainText('Backlog')
	await selector(page).focus(); await page.keyboard.press('Enter'); const doing = page.locator('.task-view .dropdown-item').filter({hasText: /^Doing$/}); await expect(doing).toBeVisible(); await doing.focus()
	const moved = page.waitForResponse(response => /\/views\/4\/buckets\/2\/tasks$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST'); await page.keyboard.press('Enter'); expect((await moved).ok()).toBe(true)
	await expect(selector(page)).toContainText('Doing'); await expect(selector(page)).toHaveAttribute('aria-expanded', 'true'); await expect(doing).toBeVisible(); await expect(doing).toBeFocused(); await page.keyboard.press('Escape'); await expect(selector(page)).toHaveAttribute('aria-expanded', 'false'); await expect(selector(page)).toBeFocused(); await page.screenshot({path: info.outputPath('bucket-task-' + width + '.png'), animations: 'disabled'}); await page.reload(); await expect(selector(page)).toContainText('Doing')
})
test('bucket modal selection moves the retained board card without losing task drafts', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/4'); await page.locator('.kanban-card__title-link').click(); const description = page.locator('.description .ProseMirror'); await page.locator('.description').getByRole('button', {name: 'Edit', exact: true}).click(); await description.fill('Retained bucket draft')
	await selector(page).click(); await page.locator('.task-view .dropdown-item').filter({hasText: /^Doing$/}).click(); await expect(selector(page)).toContainText('Doing'); await expect(description).toHaveText('Retained bucket draft')
	await page.locator('.description').getByRole('button', {name: 'Save', exact: true}).click(); await page.getByRole('button', {name: 'Close dialog', exact: true}).last().click(); await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(page.locator('.kanban .bucket[data-bucket-id="1"] .kanban-card__title-link')).toHaveCount(0); await expect(page.locator('.kanban .bucket[data-bucket-id="2"] .kanban-card__title-link')).toHaveText('Bucket task'); await page.reload(); await expect(page.locator('.kanban .bucket[data-bucket-id="2"] .kanban-card__title-link')).toHaveText('Bucket task')
})
test('multiple manual views expose only the active view selector', async ({authenticatedPage: page}) => {
	await ProjectViewFactory.create(1, {id: 9, project_id: 1, title: 'Second board', view_kind: 3, bucket_configuration_mode: 1}, false)
	await BucketFactory.create(1, {id: 3, title: 'Other view', project_view_id: 9}, false); await TaskBucketFactory.create(1, {task_id: 1, bucket_id: 3, project_view_id: 9}, false)
	await page.goto('/tasks/1'); await expect(page.locator('.task-view h1')).toBeVisible(); await expect(selector(page)).toHaveCount(0)
	await page.goto('/projects/1/9'); await page.locator('.kanban-card__title-link').click(); await expect(selector(page)).toContainText('Other view')
})
test('bucket failure retries with permission and unrelated task fields intact', async ({authenticatedPage: page}) => {
	await page.goto('/tasks/1'); await page.route('**/api/v1/projects/1/views/4/buckets/2/tasks', route => route.fulfill({status: 500, json: {message: 'Bucket fixture rejection'}}))
	await selector(page).click(); await page.locator('.task-view .dropdown-item').filter({hasText: /^Doing$/}).click(); await expect(page.locator('.vue-notification.error')).toContainText('Bucket fixture rejection'); await expect(selector(page)).toContainText('Backlog')
	await page.unroute('**/api/v1/projects/1/views/4/buckets/2/tasks'); if (await selector(page).getAttribute('aria-expanded') !== 'true') await selector(page).click(); await page.locator('.task-view .dropdown-item').filter({hasText: /^Doing$/}).click(); await expect(selector(page)).toContainText('Doing'); await expect(page.getByRole('button', {name: 'Set Color', exact: true})).toBeVisible()
})
test('reader sees bucket membership but cannot select it or forge a move', async ({authenticatedPage: page, currentUser, apiContext, userToken}) => {
	const [owner] = await UserFactory.create(1, {id: 101, username: 'bucket-owner'}, false)
	await ProjectFactory.create(1, {id: 3, owner_id: owner.id, title: 'Read only board'}, false); await createDefaultViews(3, 9); await UserProjectFactory.create(1, {project_id: 3, user_id: currentUser.id, permission: 0})
	await TaskFactory.create(1, {id: 2, project_id: 3, created_by_id: owner.id}, false); await BucketFactory.create(1, {id: 3, title: 'Protected bucket', project_view_id: 12}, false); await TaskBucketFactory.create(1, {task_id: 2, bucket_id: 3, project_view_id: 12}, false)
	await page.goto('/tasks/2'); await expect(page.getByRole('navigation', {name: 'Breadcrumb'})).toContainText('Protected bucket'); await expect(selector(page)).toHaveCount(0)
	const rejected = await apiContext.post('projects/3/views/12/buckets/3/tasks', {headers: {Authorization: 'Bearer ' + userToken}, data: {task_id: 2, bucket_id: 3, project_view_id: 12, project_id: 3}}); expect(rejected.status()).toBe(403)
})
test('pending bucket move cancels on navigation and cannot publish into another task', async ({authenticatedPage: page}) => {
	await TaskFactory.create(1, {id: 2, project_id: 1, title: 'Next task'}, false); await page.goto('/tasks/1')
	let release, seen; const gate = new Promise<void>(done => {release = done}), requested = new Promise<void>(done => {seen = done}), failures: string[] = []
	page.on('requestfailed', request => {if (/\/views\/4\/buckets\/2\/tasks$/.test(new URL(request.url()).pathname)) failures.push(request.failure()?.errorText || '')})
	await page.route('**/api/v1/projects/1/views/4/buckets/2/tasks', async route => {seen(); await gate; try {await route.continue()} catch {/* Owner cancellation ends interception. */}})
	await selector(page).click(); await page.locator('.task-view .dropdown-item').filter({hasText: /^Doing$/}).click(); await requested
	await page.getByRole('navigation', {name: 'Breadcrumb'}).getByRole('link', {name: 'Parent project', exact: true}).click(); await expect(page).toHaveURL(/\/projects\/2/); await expect.poll(() => failures.length).toBe(1); release()
	await page.goto('/tasks/2'); await expect(page.locator('.task-view h1')).toContainText('Next task'); await expect(selector(page)).not.toContainText('Doing'); await expect(page.locator('.vue-notification.success')).toHaveCount(0)
})
