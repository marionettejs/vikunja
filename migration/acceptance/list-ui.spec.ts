import {test, expect} from './fixtures'
import {ProjectFactory} from '../../frontend/tests/factories/project'
import {TaskFactory} from '../../frontend/tests/factories/task'
import {LabelFactory} from '../../frontend/tests/factories/labels'
import {LabelTaskFactory} from '../../frontend/tests/factories/label_task'
import {TaskCommentFactory} from '../../frontend/tests/factories/task_comment'
import {BucketFactory} from '../../frontend/tests/factories/bucket'
import {Factory} from '../../frontend/tests/support/factory'
import {createDefaultViews} from '../../frontend/tests/e2e/project/prepareProjects'

test.beforeEach(async ({authenticatedPage: page}) => {
	void page
	await ProjectFactory.create(1, {title: 'Native surface checkpoint'})
	await createDefaultViews(1)
	await BucketFactory.create(2, {project_view_id: 4})
	await TaskFactory.create(1, {title: 'Existing task', due_date: '2040-06-17T12:00:00Z', description: '<p>A faithful description preview.</p>'})
	await Factory.seed('task_positions', [{task_id: 1, project_view_id: 1, position: 65536}])
})

test('entry creates magic properties and indented subtasks, preserving order after reload', async ({authenticatedPage: page}, info) => {
	await LabelFactory.create(1, {title: 'checkpoint', hex_color: 'eedd00'})
	const writes: unknown[] = []
	page.on('request', request => { if (request.method() === 'POST' && /tasks\/bulk|relations$/.test(request.url())) writes.push({url: new URL(request.url()).pathname, body: request.postDataJSON()}) })
	await page.goto('/projects/1/1')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Magic parent !4 *checkpoint\n  Indented child')
	await entry.press('Enter')
	await expect(page.locator('ul.tasks > div > .single-task').first()).toContainText('Magic parent')
	await expect(page.locator('.subtask-nested .task-link')).toHaveText('Indented child')
	await expect(page.locator('ul.tasks > div > .single-task').first()).toContainText('Urgent')
	await expect(page.locator('ul.tasks > div > .single-task').first().locator('.labels')).toContainText('checkpoint')
	await expect(entry).toHaveValue('')
	await page.reload()
	await expect(page.locator('ul.tasks > div > .single-task').first()).toContainText('Magic parent')
	await expect(page.locator('.subtask-nested .task-link')).toHaveText('Indented child')
	await entry.fill('Duplicate line\nDuplicate line')
	await entry.press('Enter')
	await expect(page.getByRole('link', {name: 'Duplicate line', exact: true})).toHaveCount(2)
	await info.attach('creation-requests', {body: JSON.stringify(writes), contentType: 'application/json'})
})

test('entry failure restores the draft and retry creates one task', async ({authenticatedPage: page}) => {
	let fail = true
	await page.route('**/api/v2/projects/1/tasks/bulk', route => fail ? route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({message: 'Fixture bulk failure'})}) : route.continue())
	await page.goto('/projects/1/1')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Retry creation')
	await entry.press('Enter')
	await expect(page.locator('.vue-notification.error')).toContainText('Fixture bulk failure')
	await expect(entry).toHaveValue('Retry creation')
	fail = false
	await entry.press('Enter')
	await expect(page.getByRole('link', {name: 'Retry creation', exact: true})).toHaveCount(1)
	await expect(entry).toHaveValue('')
})

test('checkbox and undo preserve row identity; favorite persists without navigating', async ({authenticatedPage: page}) => {
	await page.goto('/projects/1/1')
	const row = page.locator('ul.tasks > div').first(), original = await row.elementHandle()
	const checkbox = row.getByRole('checkbox', {name: "Mark 'Existing task' as done"})
	await row.locator('.base-checkbox__label').click()
	await expect(checkbox).toBeChecked()
	await expect(page.locator('.vue-notification.success')).toContainText('The task was successfully marked as done.')
	await page.getByRole('button', {name: 'Undo', exact: true}).click()
	await expect(checkbox).not.toBeChecked()
	expect(await row.evaluate((element, prior) => element === prior, original)).toBe(true)
	await row.getByRole('button', {name: 'Add to Favorites', exact: true}).click()
	await expect(row.locator('.favorite')).toHaveClass(/is-favorite/)
	await expect(page).toHaveURL(/\/projects\/1\/1$/)
	await page.reload()
	await expect(row.locator('.favorite')).toHaveClass(/is-favorite/)
	await expect(checkbox).not.toBeChecked()
})

test('due-date popup saves a one-day defer and reload retains the date', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const row = page.locator('ul.tasks > div').first()
	await row.locator('.dueDate').click()
	await expect(row.locator('.defer-task')).toBeVisible()
	const response = page.waitForResponse(value => /\/tasks\/1$/.test(value.url()) && value.request().method() === 'POST')
	await page.getByRole('button', {name: '1 day', exact: true}).click()
	const saved = await response
	expect(saved.ok()).toBe(true)
	await expect(row.locator('time')).toHaveAttribute('datetime', '2040-06-18T12:00:00.000Z')
	await page.getByPlaceholder('Add a task…').click()
	await page.reload()
	await expect(row.locator('time')).toHaveAttribute('datetime', '2040-06-18T12:00:00.000Z')
	await info.attach('defer-request', {body: saved.request().postData() ?? '', contentType: 'application/json'})
})

test('glance tooltip exposes metadata on keyboard focus and Escape restores the link', async ({authenticatedPage: page}, info) => {
	await LabelFactory.create(1, {title: 'visible label', hex_color: 'eedd00'})
	await LabelTaskFactory.create(1)
	await TaskCommentFactory.create(2, {task_id: 1})
	await page.goto('/projects/1/1')
	const link = page.getByRole('link', {name: 'Existing task', exact: true})
	await link.focus()
	const tooltip = page.getByRole('tooltip')
	await expect(tooltip).toContainText('A faithful description preview.')
	await expect(tooltip).toContainText('visible label')
	await expect(tooltip.locator('.comment-count-badge')).toHaveText('2')
	await expect(link).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') ?? '')
	await info.attach('glance-geometry', {body: JSON.stringify(await page.locator('.task-glance-trigger, .task-glance-tooltip, .task-glance-created, .tasktext .dueDate, .tasktext time, .tasktext .project-task-icon, .quick-add-magic-trigger-btn').evaluateAll(elements => elements.map(element => ({className: element.className, color: getComputedStyle(element).color, rect: element.getBoundingClientRect().toJSON(), children: Array.from(element.childNodes).map(node => ({type: node.nodeType, text: node.textContent}))})))), contentType: 'application/json'})
	await page.screenshot({path: info.outputPath('glance.png'), animations: 'disabled'})
	await page.keyboard.press('Escape')
	await expect(tooltip).toHaveCount(0)
	await expect(link).toBeFocused()
	await expect(link).not.toHaveAttribute('aria-describedby')
})

test('quick-add help retains entry draft, closes by Escape and returns focus to its trigger', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	const entry = page.getByPlaceholder('Add a task…')
	await entry.fill('Keep help draft')
	const help = page.getByRole('button', {name: 'Use magic prefixes to define due dates, assignees and other task properties.', exact: true})
	await help.click()
	const dialog = page.locator('dialog[open]')
	await expect(dialog).toContainText('Quick Add Magic')
	await expect(dialog).toContainText('Every 3 days')
	await page.screenshot({path: info.outputPath('quick-add-help.png'), animations: 'disabled'})
	await page.keyboard.press('Escape')
	await expect(dialog).toHaveCount(0)
	await expect(help).toBeFocused()
	await expect(entry).toHaveValue('Keep help draft')
})

test('empty state focuses the entry and existing view tabs preserve ordinary navigation', async ({authenticatedPage: page}) => {
	await TaskFactory.create(0)
	await page.goto('/projects/1/1')
	await page.getByRole('button', {name: 'Create a task.', exact: true}).click()
	await expect(page.getByPlaceholder('Add a task…')).toBeFocused()
	await page.locator('.switch-view-button[href="/projects/1/3"]').click()
	await expect(page).toHaveURL(/\/projects\/1\/3$/)
	await page.locator('.switch-view-button[href="/projects/1/1"]').click()
	await expect(page).toHaveURL(/\/projects\/1\/1$/)
})

test('closed sort stays hidden and responsive view menu returns focus before navigation', async ({authenticatedPage: page}, info) => {
	await page.goto('/projects/1/1')
	await expect(page.getByRole('link', {name: 'Existing task', exact: true})).toBeVisible()
	await expect(page.locator('.sort-popup')).toBeHidden()
	await page.setViewportSize({width: 390, height: 844})
	const trigger = page.locator('.switch-view-dropdown-trigger')
	await expect(trigger).toBeVisible()
	await trigger.click()
	await expect(page.locator('.switch-view-dropdown .dropdown-menu')).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.locator('.switch-view-dropdown .dropdown-menu')).toBeHidden()
	await expect(trigger).toBeFocused()
	await trigger.click()
	await expect(page.locator('.switch-view-dropdown .dropdown-menu')).toBeVisible()
	await expect(page.locator('.switch-view-dropdown .dropdown-menu')).toHaveCSS('opacity', '1')
	await page.screenshot({path: info.outputPath('view-menu-mobile.png')})
	await page.locator('.switch-view-dropdown .dropdown-menu a[href="/projects/1/3"]').click()
	await expect(page).toHaveURL(/\/projects\/1\/3$/)
})

test('archived project retains enabled rows while hiding quick-add', async ({authenticatedPage: page}) => {
	await ProjectFactory.create(1, {title: 'Archived checkpoint', is_archived: true})
	await page.goto('/projects/1/1')
	await expect(page.getByRole('link', {name: 'Existing task', exact: true})).toBeVisible()
	await expect(page.locator('ul.tasks').getByRole('checkbox')).toBeEnabled()
	await expect(page.getByPlaceholder('Add a task…')).toHaveCount(0)
	await expect(page.locator('.message.warning')).toBeVisible()
})
